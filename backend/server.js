require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const validator = require('validator');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// === Supabase Client ===
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

// === Serve index.html ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Form Submission Endpoint ===
app.post('/submit-form', upload.single('file'), async (req, res) => {
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
      const timestamp = Date.now();
      const filename = `${timestamp}-${req.file.originalname}`;

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
