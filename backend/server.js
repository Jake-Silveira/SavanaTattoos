require('dotenv').config();
const sgMail = require('@sendgrid/mail');
console.log('ENV API KEY:', process.env.SENDGRID_API_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);



const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/submit-form', async (req, res) => {
  const { placement, size, desc, firstName, lastName, email, phone, dateFrom, dateTo } = req.body;

  if (!placement || !size || !desc || !firstName || !lastName || !email || !dateFrom || !dateTo) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

   const message = {
    to: process.env.TO_EMAIL,
    from: process.env.FROM_EMAIL,
    subject: `New Tattoo Inquiry from ${firstName} ${lastName}`,
    text: `
New Tattoo Inquiry:

Name: ${firstName} ${lastName}
Email: ${email}
Phone: ${phone || 'Not provided'}

Placement: ${placement}
Size: ${size}
Description: ${desc}
Availability: ${dateFrom} - ${dateTo}
    `
  };

  try {
    await sgMail.send(message);
    console.log("✅ Email sent");
    res.json({ message: 'Form submitted and email sent successfully!' });
  } catch (error) {
    console.error("❌ Email failed:", error.response?.body || error.message);
    res.status(500).json({ message: 'Failed to send email' });
  }
});


app.listen(PORT, () => {
  console.log(`Node server running at http://localhost:${PORT}`);
  console.log('TO:', process.env.TO_EMAIL);
console.log('FROM:', process.env.FROM_EMAIL);

});

