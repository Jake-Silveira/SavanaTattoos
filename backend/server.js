require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

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
  const { placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo } = req.body;

  if (!placement || !size || !desc || !firstName || !lastName || !email) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
    // 1. Insert into Supabase
    const { data, error } = await supabase
      .from('inquiries')
      .insert([{
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        placement,
        size,
        desc,
        date_from: dateFrom,
        date_to: dateTo
      }]);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ message: 'Failed to save inquiry to database.' });
    }

    // 2. Send email via Resend
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
    res.json({ message: 'Inquiry submitted, email sent, and data saved!' });

  } catch (err) {
    console.error('Error handling submission:', err.response?.data || err.message);
    res.status(500).json({ message: 'Submission failed. Try again later.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
