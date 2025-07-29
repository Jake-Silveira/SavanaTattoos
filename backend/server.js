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
    const filetypes = /jpeg|jpg|png|gif/;
    const isValid = filetypes.test(path.extname(file.originalname).toLowerCase()) && filetypes.test(file.mimetype);
    cb(isValid ? null : new Error('Only image files allowed'), isValid);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// === Middleware ===
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Submit Form Endpoint ===
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

    if (!token) {
      return res.status(400).json({ message: 'reCAPTCHA not completed.' });
    }

    // === Verify reCAPTCHA ===
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`;
    const captchaRes = await axios.post(verifyURL);

    if (!captchaRes.data.success || captchaRes.data.score < 0.5) {
      return res.status(400).json({ message: 'Failed reCAPTCHA verification.' });
    }

    // === Sanitize ===
    const clean = (val) => validator.escape(val.trim());
    const validEmail = validator.isEmail(email);
    if (!placement || !size || !desc || !firstName || !lastName || !email || !validEmail) {
      return res.status(400).json({ message: 'Missing or invalid required fields.' });
    }

    const today = new Date();
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (isNaN(from) || isNaN(to) || from < today || to < from || (to - from) / (1000 * 60 * 60 * 24) > 60) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    // === Handle File Upload ===
    let fileUrl = null;
    if (req.file) {
      const timestamp = Date.now();
      const filename = `${timestamp}-${req.file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filename);

      fileUrl = publicUrlData.publicUrl;
    }

    // === Insert Record to Supabase Table ===
    const { error: insertError } = await supabase
      .from('inquiries') // <- your table name
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
        },
      ]);

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

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

    return res.status(200).json({ message: 'Inquiry submitted successfully!' });

  } catch (err) {
    console.error('Error handling /submit-form:', err.message);
    return res.status(500).json({ message: 'Something went wrong with your submission.' });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
