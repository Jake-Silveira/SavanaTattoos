require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const validator = require('validator');
const multer = require('multer');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// === Multer setup ===
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const token = req.body['g-recaptcha-response'];
    if (!token) {
      return res.status(400).json({ message: 'reCAPTCHA not completed.' });
    }

    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`;
    const captchaRes = await axios.post(verifyURL);
    if (!captchaRes.data.success || captchaRes.data.score < 0.5) {
      return res.status(400).json({ message: 'Failed reCAPTCHA verification.' });
    }

    // === Sanitize and validate form fields ===
    let { placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo } = req.body;
    placement = validator.escape(placement.trim());
    size = validator.escape(size.trim());
    desc = validator.escape(desc.trim());
    firstName = validator.escape(firstName.trim());
    lastName = validator.escape(lastName.trim());
    email = email.trim();
    phone = phone ? validator.escape(phone.trim()) : '';

    if (!placement || !size || !desc || !firstName || !lastName || !email || !validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid or missing required fields.' });
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const today = new Date();

    if (isNaN(from) || isNaN(to)) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }
    if (from < today || to < from || (to - from) / (1000 * 60 * 60 * 24) > 60) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    // === Upload file to Supabase ===
    let fileUrl = null;
    const file = req.file;

    if (file) {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;

      const { data, error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: 'File upload failed.', error: error.message });
      }

      // Generate public URL
      const { data: publicURL, error: urlError } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filename);

      if (urlError) {
        console.error('Supabase URL error:', urlError);
        return res.status(500).json({ message: 'Could not generate public URL.' });
      }

      fileUrl = publicURL.publicUrl;
    }

    // === Email content ===
    const emailBody = `
      <h2>New Tattoo Inquiry</h2>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <p><strong>Placement:</strong> ${placement}</p>
      <p><strong>Size:</strong> ${size}</p>
      <p><strong>Description:</strong> ${desc}</p>
      <p><strong>Availability:</strong> ${dateFrom} - ${dateTo}</p>
      ${fileUrl ? `<p><strong>Image:</strong> <a href="${fileUrl}" target="_blank">View Uploaded Image</a></p>` : ''}
    `;

    // === Send email via Resend ===
    const emailRes = await axios.post('https://api.resend.com/emails', {
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject: `New Inquiry from ${firstName} ${lastName}`,
      html: emailBody
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Email sent:', emailRes.data);
    res.status(200).json({ message: 'Inquiry submitted successfully!' });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Something went wrong with your submission.', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
