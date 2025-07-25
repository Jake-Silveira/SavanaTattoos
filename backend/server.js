require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const validator = require('validator');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/submit-form', async (req, res) => {
  try {
    let { placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo } = req.body;

    // Trim & sanitize
    placement = validator.escape(placement.trim());
    size = validator.escape(size.trim());
    desc = validator.escape(desc.trim());
    firstName = validator.escape(firstName.trim());
    lastName = validator.escape(lastName.trim());
    email = email.trim();
    phone = phone ? validator.escape(phone.trim()) : '';

    // Validation
    if (
      !placement || !size || !desc || !firstName || !lastName || !email ||
      !validator.isEmail(email)
    ) {
      return res.status(400).json({ message: 'Invalid or missing required fields.' });
    }

    // Date validation
    const today = new Date();
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }

    if (from < today || to < from || (to - from) / (1000 * 60 * 60 * 24) > 60) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    // Send email via Resend
    const response = await axios.post('https://api.resend.com/emails', {
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
      `
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Email sent via Resend:', response.data);
    res.json({ message: 'Inquiry submitted!' });

  } catch (err) {
    console.error('Error handling submission:', err.response?.data || err.message);
    res.status(500).json({ message: 'Submission failed. Try again later.' });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
