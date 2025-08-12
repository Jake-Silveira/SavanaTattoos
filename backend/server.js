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
  if (auth && auth.split(' ')[0] === 'Bearer') return auth.split(' ')[1];
  return req.cookies.access_token || req.query.token || null;
}

// Middleware to verify admin
const verifyAdmin = async (req, res, next) => {
  const token = getTokenFromHeaderOrCookie(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(403).json({ error: 'Forbidden: Invalid token' });
  if (data.user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });

  req.adminUser = data.user;
  next();
};

// Middleware to verify regular user
const verifyUser = async (req, res, next) => {
  const token = getTokenFromHeaderOrCookie(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Forbidden: Invalid token' });

  req.user = data.user;
  next();
};

// POST /sign-in
app.post('/sign-in', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const { user, session } = data;
  res.cookie('access_token', session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: session.expires_in * 1000,
    path: '/',
    domain: '.ravensnest.ink'
  });

  res.json({ user, access_token: session.access_token });
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

// Admin dashboard page
app.get('/admin/dashboard', verifyAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Upload image - Admin only
app.post('/auth/api/upload-image', upload.single('file'), verifyAdmin, async (req, res) => {
  try {
    const { bucket } = req.body; // 'gallery' or 'flash'
    if (!['gallery', 'flash'].includes(bucket)) return res.status(400).json({ error: 'Invalid bucket' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filename, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filename);
    const url = publicData.publicUrl;

    // Store metadata
    const { error: dbError } = await supabase.from('images').insert({ bucket, path: filename, url });
    if (dbError) throw dbError;

    res.json({ message: 'Image uploaded', url });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// Delete image - Admin only
app.delete('/auth/api/delete-image', verifyAdmin, async (req, res) => {
  try {
    const { bucket, path: filePath } = req.body;
    if (!['gallery', 'flash'].includes(bucket)) return res.status(400).json({ error: 'Invalid bucket' });
    if (!filePath) return res.status(400).json({ error: 'No file path provided' });

    const { error: deleteError } = await supabase.storage.from(bucket).remove([filePath]);
    if (deleteError) throw deleteError;

    // Remove metadata
    const { error: dbError } = await supabase.from('images').delete().eq('bucket', bucket).eq('path', filePath);
    if (dbError) throw dbError;

    res.json({ message: 'Image deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

// List images (public)
app.get('/api/images/:bucket', async (req, res) => {
  const { bucket } = req.params;
  if (!['gallery', 'flash'].includes(bucket)) return res.status(400).json({ error: 'Invalid bucket' });

  const { data, error } = await supabase.from('images').select('url').eq('bucket', bucket).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(item => item.url));
});

// Root route
app.get('/', async (req, res) => {
  const token = getTokenFromHeaderOrCookie(req);
  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const role = data.user.app_metadata?.role;
  const redirectUrl = role === 'admin' && req.path !== '/admin/dashboard'
    ? 'https://www.ravensnest.ink/admin/dashboard'
    : 'https://www.ravensnest.ink/index.html';
  res.redirect(302, `${redirectUrl}?token=${token}`);
});

// Abuse logging
async function logAbuse(ip, reason) {
  const { error } = await supabase.from('abuse_logs').insert([{ ip_address: ip, reason }]);
  if (error) throw new Error(`Failed to log abuse: ${error.message}`);
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

app.post('/submit-form', upload.single('file'), formLimiter, verifyUser, async (req, res) => {
  try {
    const { placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo, 'g-recaptcha-response': token } = req.body;

    if (!token) return res.status(400).json({ message: 'reCAPTCHA not completed.' });

    const captchaRes = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: process.env.RECAPTCHA_SECRET_KEY, response: token }
    });
    if (!captchaRes.data.success || captchaRes.data.score < 0.5) return res.status(400).json({ message: 'Failed reCAPTCHA verification.' });

    const sanitizeText = (str) => str.trim().replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));

    if (!placement || !size || !desc || !firstName || !lastName || !validator.isEmail(email)) {
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
    if (isNaN(from) || isNaN(to) || from < today || to < from || (to - from) / (1000 * 60 * 60 * 24) > 60) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    let fileUrl = null;
    if (req.file) {
      if (!['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only JPG or PNG images are allowed.' });
      }

      const ext = path.extname(req.file.originalname);
      const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype, metadata: { owner: req.user.id } });

      if (!uploadError) {
        const { data: publicData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(filename);
        fileUrl = publicData?.publicUrl || null;
      }
    }

    const { error: insertError } = await supabase
      .from('inquiries')
      .insert([{ first_name: cleanData.first_name, last_name: cleanData.last_name, email: cleanData.email, phone: phone ? sanitizeText(phone) : null, placement: cleanData.placement, size: cleanData.size, description: cleanData.description, date_from: dateFrom, date_to: dateTo, image_url: fileUrl, user_id: req.user.id }]);

    if (insertError) throw new Error(`Database insert failed: ${insertError.message}`);

    await axios.post('https://api.resend.com/emails', {
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject: `New Inquiry from ${firstName} ${lastName}`,
      html: `<h2>New Tattoo Inquiry</h2><p><strong>Name:</strong> ${firstName} ${lastName}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone || 'N/A'}</p><p><strong>Placement:</strong> ${placement}</p><p><strong>Size:</strong> ${size}</p><p><strong>Description:</strong> ${desc}</p><p><strong>Availability:</strong> ${dateFrom} - ${dateTo}</p>${fileUrl ? `<p><strong>Image:</strong> <a href="${fileUrl}" target="_blank">View Uploaded Image</a></p>` : ''}`
    }, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } });

    await axios.post('https://api.resend.com/emails', {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: `Thanks for your inquiry, ${firstName}!`,
      html: `<p>Hey ${firstName},</p><p>Thanks for reaching out! I’ve received your inquiry and will get back to you shortly.</p><p><strong>Your Submission:</strong></p><ul><li><strong>Placement:</strong> ${placement}</li><li><strong>Size:</strong> ${size}</li><li><strong>Description:</strong> ${desc}</li><li><strong>Availability:</strong> ${dateFrom} – ${dateTo}</li></ul><p>– Raven's Nest Co.</p>`
    }, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } });

    res.status(200).json({ message: 'Inquiry submitted successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error. Please try again later.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Error handling for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});