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

const app = express();
const PORT = process.env.PORT || 3000;

// === Supabase client ===
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// === Middleware ===
app.use(cors({
  origin: 'https://ravensnest.ink', 
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', true); // For req.ip behind proxy

// Multer Setup for file uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png'];
  const allowedExts = ['.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG files are allowed.'));
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Helper to extract Bearer token from Authorization header
function getTokenFromHeader(req) {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

// Middleware to verify admin by token from header
const verifyAdmin = async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || data.user.app_metadata?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  req.adminUser = data.user;
  next();
};

// Middleware to verify regular user by token from header
const verifyUser = async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || data.user.app_metadata?.role !== 'user') {
    return res.status(403).json({ error: 'Forbidden: User access required' });
  }

  req.user = data.user;
  next();
};

// Debug route
app.get('/debug/headers', (req, res) => {
  res.json({ headers: req.headers });
});

// POST /sign-in - Authenticate user and return session info to frontend (no cookies)
app.post('/sign-in', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const { user, session } = data;

  // Return session and user info to frontend for client to store token & redirect
  res.json({
    session,
    user,
  });
});

// Serve signIn page
app.get('/signIn', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signIn.html'));
});

// Get inquiries - Admin only
app.get('/auth/api/inquiries', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('inquiries')
    .select('first_name, last_name, email, phone, placement, size, description, date_from, date_to, image_url, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

// Get abuse logs - Admin only
app.get('/auth/api/abuse-logs', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('abuse_logs')
    .select('ip_address, reason, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

// Admin dashboard page (protected)
app.get('/admin/dashboard', verifyAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Root route redirects based on token + role
app.get('/', async (req, res) => {
  // Try to get token from Authorization header, fallback to none
  const token = getTokenFromHeader(req);

  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const role = data.user.app_metadata?.role;

  if (role === 'admin') {
    return res.redirect('/admin/dashboard');
  } else {
    return res.sendFile(path.join(__dirname, 'public', 'user-dashboard.html'));
  }
});

// Abuse logging and rate limiting remain unchanged
async function logAbuse(ip, reason) {
  const { error } = await supabase
    .from('abuse_logs')
    .insert([{ ip_address: ip, reason }]);
  if (error) {
    console.error('[ERROR] Failed to log abuse:', error.message);
  }
}

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
  message: { message: "Too many submissions from this IP, try again later." },
  handler: (req, res) => {
    logAbuse(req.ip, 'Rate limit exceeded');
    res.status(429).json({ message: "Too many submissions from this IP, try again later." });
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

// === Field Validation & Sanitization ===

// Safer custom sanitizer: strips script injection risks, keeps quotes
function sanitizeText(str) {
  return str
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;'); // optional, for consistency
}

const validEmail = validator.isEmail(email);
if (!placement || !size || !desc || !firstName || !lastName || !email || !validEmail) {
  console.warn('[WARN] Missing or invalid fields');
  return res.status(400).json({ message: 'Missing or invalid required fields.' });
}

// Use sanitized values (no escaping quotes!)
const cleanData = {
  placement: sanitizeText(placement),
  size: sanitizeText(size),           // ✅ size will keep its "quotes"
  description: sanitizeText(desc),
  first_name: sanitizeText(firstName),
  last_name: sanitizeText(lastName),
  email: email.trim().toLowerCase(),  // email doesn't need html sanitization
};


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

// === Upload File to Supabase (if file exists) ===
let fileUrl = null;
if (req.file) {
  const allowedTypes = ['image/jpeg', 'image/png'];

  if (!allowedTypes.includes(req.file.mimetype)) {
    console.warn('[WARN] Disallowed file type:', req.file.mimetype);
    return res.status(400).json({
      message: 'Invalid file type. Only JPG or PNG images are allowed.',
    });
  }

  console.log('[INFO] Valid image detected, uploading...');
  const ext = path.extname(req.file.originalname);
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET)
    .upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
    });

  if (uploadError) {
    console.error('[ERROR] Image upload failed:', uploadError.message);
    return res.status(500).json({
      message: `Image upload failed: ${uploadError.message}`,
    });
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
      first_name: cleanData.first_name,
      last_name: cleanData.last_name,
      email: cleanData.email,
      phone: phone ? sanitizeText(phone) : null, // use sanitizeText directly here
      placement: cleanData.placement,
      size: cleanData.size,
      description: cleanData.description,
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
    console.warn('[WARN] Email failed to send:', emailErr.message, emailErr.response?.data || '');
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

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});