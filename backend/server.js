require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const validator = require('validator');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// === Supabase client ===
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// === Middleware ===
app.use(cors({
  origin: ['https://ravensnest.ink', 'https://www.ravensnest.ink', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1); // Trust Render's proxy

// Redirect non-www to www
app.use((req, res, next) => {
  if (req.headers.host === 'ravensnest.ink') {
    console.log('[INFO] Redirecting non-www to www', { path: req.path, ip: req.ip });
    return res.redirect(301, `https://www.ravensnest.ink${req.originalUrl}`);
  }
  next();
});

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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper to extract Bearer token from Authorization header, cookie, or query param
function getTokenFromHeaderOrCookie(req) {
  const auth = req.headers['authorization'];
  if (auth) {
    const parts = auth.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      console.log('[DEBUG] Token found in Authorization header', { path: req.path, ip: req.ip });
      return parts[1];
    }
  }
  if (req.cookies.access_token) {
    console.log('[DEBUG] Token found in cookie', { path: req.path, ip: req.ip, cookie: req.cookies.access_token });
    return req.cookies.access_token;
  }
  if (req.query.token) {
    console.log('[DEBUG] Token found in query param', { path: req.path, ip: req.ip });
    return req.query.token;
  }
  return null;
}

// Middleware to verify admin
const verifyAdmin = async (req, res, next) => {
  const token = getTokenFromHeaderOrCookie(req);
  if (!token) {
    console.warn('[WARN] No token provided', { path: req.path, ip: req.ip, headers: req.headers, cookies: req.cookies, query: req.query });
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.warn('[WARN] Invalid token or user not found', { error: error?.message, path: req.path, ip: req.ip });
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
  if (data.user.app_metadata?.role !== 'admin') {
    console.warn('[WARN] Non-admin user attempted access', { userId: data.user.id, path: req.path, ip: req.ip });
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  console.log('[INFO] Admin verified', { userId: data.user.id, path: req.path, ip: req.ip });
  req.adminUser = data.user;
  next();
};

// Middleware to verify regular user
const verifyUser = async (req, res, next) => {
  const token = getTokenFromHeaderOrCookie(req);
  if (!token) {
    console.warn('[WARN] No token provided', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized: No token' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.warn('[WARN] Invalid token or user not found', { error: error?.message, path: req.path });
    return res.status(401).json({ error: 'Forbidden: Invalid token' });
  }

  console.log('[INFO] User verified', { userId: data.user.id, path: req.path });
  req.user = data.user;
  next();
};

// Debug route
app.get('/debug/headers', (req, res) => {
  console.log('[DEBUG] Headers and cookies received', { path: req.path, ip: req.ip, headers: req.headers, cookies: req.cookies, query: req.query });
  res.json({ headers: req.headers, cookies: req.cookies, query: req.query });
});

// POST /sign-in
app.post('/sign-in', async (req, res) => {
  const { email, password } = req.body;

  console.log('[INFO] Sign-in attempt', { email, path: req.path, ip: req.ip });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    console.warn('[WARN] Sign-in failed', { error: error?.message, email, path: req.path, ip: req.ip });
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const { user, session } = data;

  // Set HttpOnly cookie
  try {
    res.cookie('access_token', session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: session.expires_in * 1000,
      path: '/',
      domain: '.ravensnest.ink'
    });
    console.log('[INFO] Cookie set successfully', { userId: user.id, email, path: req.path, ip: req.ip, token: session.access_token });
  } catch (cookieError) {
    console.error('[ERROR] Failed to set cookie', { error: cookieError.message, path: req.path, ip: req.ip });
  }

  res.json({ user, access_token: session.access_token });
});

// Serve signIn page
app.get('/signIn', (req, res) => {
  console.log('[INFO] Serving signIn.html', { path: req.path, ip: req.ip });
  res.sendFile(path.join(__dirname, 'public', 'signIn.html'));
});

// Get inquiries - Admin only
app.get('/auth/api/inquiries', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('inquiries')
    .select('first_name, last_name, email, phone, placement, size, description, date_from, date_to, image_url, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ERROR] Failed to fetch inquiries', { error: error.message, path: req.path });
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Get abuse logs - Admin only
app.get('/auth/api/abuse-logs', verifyAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('abuse_logs')
    .select('ip_address, reason, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ERROR] Failed to fetch abuse logs', { error: error.message, path: req.path });
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Admin dashboard page
app.get('/admin/dashboard', verifyAdmin, (req, res) => {
  console.log('[INFO] Serving admin dashboard', { userId: req.adminUser.id, path: req.path, ip: req.ip });
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Root route
app.get('/', async (req, res) => {
  const token = getTokenFromHeaderOrCookie(req);
  if (!token) {
    console.log('[INFO] No token, serving index.html', { path: req.path, ip: req.ip });
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.log('[INFO] Invalid token, serving index.html', { path: req.path, ip: req.ip });
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const role = data.user.app_metadata?.role;
  if (role === 'admin' && req.path !== '/admin/dashboard') {
    console.log('[INFO] Admin user, redirecting to dashboard', { userId: data.user.id, path: req.path, ip: req.ip });
    return res.redirect(302, `https://www.ravensnest.ink/admin/dashboard?token=${token}`);
  } else {
    console.log('[INFO] Non-admin user or already on dashboard, serving index.html', { userId: data.user.id, path: req.path, ip: req.ip });
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Abuse logging
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
  message: { message: 'Too many submissions from this IP, try again later.' },
  handler: (req, res) => {
    logAbuse(req.ip, 'Rate limit exceeded');
    res.status(429).json({ message: 'Too many submissions from this IP, try again later.' });
  }
});

// Form submission endpoint
app.post('/submit-form', upload.single('file'), formLimiter, verifyUser, async (req, res) => {
  try {
    const {
      placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo, 'g-recaptcha-response': token
    } = req.body;

    console.log('[INFO] Received form submission from:', email, { userId: req.user.id });

    if (!token) {
      console.warn('[WARN] Missing reCAPTCHA token');
      return res.status(400).json({ message: 'reCAPTCHA not completed.' });
    }

    const captchaRes = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
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

    function sanitizeText(str) {
      return str
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&/g, '&amp;');
    }

    const validEmail = validator.isEmail(email);
    if (!placement || !size || !desc || !firstName || !lastName || !email || !validEmail) {
      console.warn('[WARN] Missing or invalid fields');
      return res.status(400).json({ message: 'Missing or invalid required fields.' });
    }

    const cleanData = {
      placement: sanitizeText(placement),
      size: sanitizeText(size),
      description: sanitizeText(desc),
      first_name: sanitizeText(firstName),
      last_name: sanitizeText(lastName),
      email: email.trim().toLowerCase()
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

    let fileUrl = null;
    if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/png'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        console.warn('[WARN] Disallowed file type:', req.file.mimetype);
        return res.status(400).json({ message: 'Invalid file type. Only JPG or PNG images are allowed.' });
      }

      console.log('[INFO] Valid image detected, uploading...');
      const ext = path.extname(req.file.originalname);
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: {
        owner: req.user.id // Set owner to user_id
        }
      });

      if (uploadError) {
        console.warn('[WARN] Image upload failed, proceeding without image:', uploadError.message);
      } else {
        const { data: publicData } = supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .getPublicUrl(filename);
        fileUrl = publicData?.publicUrl || null;
        console.log('[INFO] File uploaded successfully:', fileUrl);
      }

      const { data: publicData } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filename);

      fileUrl = publicData?.publicUrl || null;
      console.log('[INFO] File uploaded successfully:', fileUrl);
    }

    const { error: insertError } = await supabase
      .from('inquiries')
      .insert([
        {
          first_name: cleanData.first_name,
          last_name: cleanData.last_name,
          email: cleanData.email,
          phone: phone ? sanitizeText(phone) : null,
          placement: cleanData.placement,
          size: cleanData.size,
          description: cleanData.description,
          date_from: dateFrom,
          date_to: dateTo,
          image_url: fileUrl,
          user_id: req.user.id // Store user ID
        }
      ]);

    if (insertError) {
      console.error('[ERROR] Failed to insert into Supabase:', insertError.message);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log('[INFO] Inquiry saved to Supabase.');

    try {
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
          `
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('[INFO] Email sent successfully.');
    } catch (emailErr) {
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
          `
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
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

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});