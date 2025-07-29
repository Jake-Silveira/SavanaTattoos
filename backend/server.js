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

// === Multer setup for image uploads ===
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Root Route ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === POST: Form Submission ===
app.post('/submit-form', (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: 'File upload failed: ' + err.message });
    } else if (err) {
      console.error('Unknown multer error:', err);
      return res.status(400).json({ message: err.message });
    }
    next(); // continue to the next middleware
  });
}, async (req, res) => {
  try {
    const token = req.body['g-recaptcha-response'];
    if (!token) return res.status(400).json({ message: 'reCAPTCHA not completed.' });

    // === Verify reCAPTCHA ===
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`;
    const captchaRes = await axios.post(verifyURL);

    if (!captchaRes.data.success || captchaRes.data.score < 0.5) {
      return res.status(400).json({ message: 'Failed reCAPTCHA verification.' });
    }

    // === Destructure and validate form fields ===
    let {
      placement, size, desc,
      firstName, lastName, email,
      phone, dateFrom, dateTo
    } = req.body;

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

    // === Date validation ===
    const today = new Date();
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }

    if (from < today || to < from || (to - from) / (1000 * 60 * 60 * 24) > 60) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    // === Handle uploaded file ===
    let fileUrl = null;
    const file = req.file;

    if (file) {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.originalname}`;

      const uploadResult = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadResult.error) {
        console.error('Supabase upload error:', uploadResult.error.message);
        throw new Error(`Failed to upload image: ${uploadResult.error.message}`);
      }

      // Get public URL
      const { data: publicURL } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filename);

      fileUrl = publicURL.publicUrl;
    }

    // === Send email via Resend ===
    const emailRes = await axios.post('https://api.resend.com/emails', {
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
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Email sent via Resend:', emailRes.data);
    res.json({ message: 'Inquiry submitted successfully!' });

  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ message: 'Something went wrong with your submission.' });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
