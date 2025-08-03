require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const validator = require('validator');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// === Supabase client ===
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Required to parse JSON bodies (admin login form)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// === Multer Setup ===
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (allowed.test(ext) && allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true); // Allows req.ip to be accurate behind a reverse proxy
app.use((req, res, next) => {
  const forwarded = req.headers['x-forwarded-for'];
  req.clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip) || 'unknown';
  next();
});
app.use(cookieParser());



// === Admin Login Route ===
app.post('/admin/login', async (req, res) => {
  console.log("Incoming login body:", req.body);
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.session) {
    console.warn('[ADMIN LOGIN FAILED]', error?.message);
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Check if user is admin
  const { user } = data;
  if (user?.app_metadata?.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // Set session cookie
  res.cookie('admin_token', data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  });

  res.json({ message: 'Logged in' });
});

const verifyAdmin = async (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) return res.redirect('/admin.html');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || data?.user?.app_metadata?.role !== 'admin') {
    return res.redirect('/admin.html');
  }

  req.adminUser = data.user;
  next();
};

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Get inquiries
app.get('/admin/api/inquiries', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('inquiries')
    .select('name, email, message, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get abuse logs
app.get('/admin/api/abuse-logs', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('abuse_logs')
    .select('ip, reason, timestamp')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


// Route: Serve admin dashboard page
app.get('/admin/dashboard', verifyAdmin, (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

// === Serve index.html ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Log abuse attempts to supabase
async function logAbuse(ip, reason) {
  const { error } = await supabase
    .from('abuse_logs')
    .insert([
      { ip_address: ip, reason: reason }
    ]);

  if (error) {
    console.error('[ERROR] Failed to log abuse to Supabase:', error.message);
  }
}

// Rate limit: 5 submissions per hour per IP
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2,
  message: { message: "Too many submissions from this IP, try again later." },
  handler: (req, res, next, options) => {
    logAbuse(req.clientIp, 'Rate limit exceeded');
    res.status(429).json(options.message);
  }
});



// === Form Submission Endpoint ===
app.post('/submit-form', upload.single('file'), formLimiter, async (req, res) => {
  try {
    const {
      placement,
      size,
      desc,
      firstName,
      lastName,
      email,
      phone,
      dateFrom,
      dateTo,
      'g-recaptcha-response': token
    } = req.body;

    console.log('[INFO] Received form submission from:', email);

    if (!token) {
      console.warn('[WARN] Missing reCAPTCHA token');
      return res.status(400).json({ message: 'reCAPTCHA not completed.' });
    }

    // === reCAPTCHA Verification ===
    const captchaRes = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token
        }
      }
    );

    if (!captchaRes.data.success || captchaRes.data.score < 0.5) {
      console.warn('[WARN] Failed reCAPTCHA verification:', captchaRes.data);
      return res.status(400).json({ message: 'Failed reCAPTCHA verification.' });
    }

    // === Field Validation ===
    const clean = (val) => validator.escape(val.trim());
    const validEmail = validator.isEmail(email);
    if (!placement || !size || !desc || !firstName || !lastName || !email || !validEmail) {
      console.warn('[WARN] Missing or invalid fields');
      return res.status(400).json({ message: 'Missing or invalid required fields.' });
    }

    const today = new Date();
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (
      isNaN(from) || isNaN(to) ||
      from < today || to < from ||
      (to - from) / (1000 * 60 * 60 * 24) > 60
    ) {
      console.warn('[WARN] Invalid date range:', { dateFrom, dateTo });
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    // === Upload File to Supabase (if exists) ===
    let fileUrl = null;
    if (req.file) {
      console.log('[INFO] File detected, uploading...');
      const ext = path.extname(req.file.originalname);
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (uploadError) {
        console.error('[ERROR] Image upload failed:', uploadError.message);
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const { data: publicData } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filename);

      fileUrl = publicData?.publicUrl || null;
      console.log('[INFO] File uploaded successfully:', fileUrl);
    }

    // === Insert to Supabase Table ===
    const { error: insertError } = await supabase
      .from('inquiries')
      .insert([
        {
          first_name: clean(firstName),
          last_name: clean(lastName),
          email: email.trim(),
          phone: phone ? clean(phone) : null,
          placement: clean(placement),
          size: clean(size),
          description: clean(desc),
          date_from: dateFrom,
          date_to: dateTo,
          image_url: fileUrl,
        }
      ]);

    if (insertError) {
      console.error('[ERROR] Failed to insert into Supabase:', insertError.message);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log('[INFO] Inquiry saved to Supabase.');

    // === Send Email via Resend ===
  try{
    await axios.post(
      'https://api.resend.com/emails',
      {
        from: process.env.FROM_EMAIL,
        to: process.env.TO_EMAIL,
        subject: `New Inquiry from ${firstName} ${lastName}`,
        html: `
          <h2>New Tattoo Inquiry</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
          <p><strong>Placement:</strong> ${placement}</p>
          <p><strong>Size:</strong> ${size}</p>
          <p><strong>Description:</strong> ${desc}</p>
          <p><strong>Availability:</strong> ${dateFrom} - ${dateTo}</p>
          ${fileUrl ? `<p><strong>Image:</strong> <a href="${fileUrl}" target="_blank">View Uploaded Image</a></p>` : ''}
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[INFO] Email sent successfully.');
  } catch(emailErr) {
    console.warn('[WARN] Email failed to send:', emailErr.message);
  }
try {
  await axios.post(
    'https://api.resend.com/emails',
    {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: `Thanks for your inquiry, ${firstName}!`,
      html: `
        <p>Hey ${firstName},</p>
        <p>Thanks for reaching out! I’ve received your inquiry and will get back to you shortly.</p>
        <p><strong>Your Submission:</strong></p>
        <ul>
          <li><strong>Placement:</strong> ${placement}</li>
          <li><strong>Size:</strong> ${size}</li>
          <li><strong>Description:</strong> ${desc}</li>
          <li><strong>Availability:</strong> ${dateFrom} – ${dateTo}</li>
        </ul>
        <p>– Raven's Nest Co.</p>
      `,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  console.log('[INFO] Auto-responder email sent.');
} catch (autoResErr) {
  console.warn('[WARN] Auto-responder failed:', autoResErr.message);
}

    return res.status(200).json({ message: 'Inquiry submitted successfully!' });

  } catch (err) {
    console.error('[FATAL] Submission failed:', err.message);
    return res.status(500).json({ message: 'Internal Server Error. Please try again later.' });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
