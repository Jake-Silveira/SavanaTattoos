require('dotenv').config();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/submit-form', async (req, res) => {
  const { placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo } = req.body;

  if (!placement || !size || !desc || !firstName || !lastName || !email) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
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
    res.json({ message: 'Inquiry submitted and email sent!' });

  } catch (error) {
    console.error('Failed to send email:', error.response?.data || error.message);
    res.status(500).json({ message: 'Submission failed. Try again later.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


