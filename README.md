# Raven's Nest Co. - Tattoo Studio Website

Raven's Nest Co. is a professional tattoo studio website built with Node.js/Express backend and HTML/CSS/JavaScript frontend. The site serves as an online presence for Savana Tattoos, featuring a gallery of work, flash sheets, artist information, and an inquiry form for booking tattoo consultations.

## Features

- **Online Inquiry Form**: Customers can submit tattoo consultation requests with image uploads, date availability, and contact information
- **Gallery & Flash Sheets**: Showcase portfolio work with a responsive gallery system
- **Admin Dashboard**: Secure admin interface for managing inquiries and content
- **Image Management**: Upload and delete functionality for gallery and flash sheet images
- **Email Notifications**: Automated email confirmations for customers and notifications for the studio
- **Security**: Rate limiting, reCAPTCHA, and input sanitization to prevent spam and abuse
- **Responsive Design**: Mobile-friendly interface with modal navigation

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL) for authentication and storage
- **Authentication**: Supabase Auth
- **Frontend**: HTML, CSS, JavaScript
- **File Storage**: Supabase Storage
- **Email Service**: Resend API

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Jake-Silveira/SavanaTattoos.git
   cd SavanaTattoos/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `backend` directory with the required environment variables:
   ```
   PORT=3000
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
   FROM_EMAIL=your_email
   TO_EMAIL=recipient_email
   RESEND_API_KEY=your_resend_api_key
   SUPABASE_BUCKET=your_bucket_name
   ADMIN_SECRET_KEY=your_admin_secret_key
   ```

4. Start the server:
   ```bash
   node server.js
   ```

## Environment Variables

- `PORT`: Port to run the server on (default: 3000)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `RECAPTCHA_SECRET_KEY`: Google reCAPTCHA secret key
- `FROM_EMAIL`: Email address for outgoing emails
- `TO_EMAIL`: Recipient email for inquiry notifications
- `RESEND_API_KEY`: Resend API key
- `SUPABASE_BUCKET`: Name of your Supabase storage bucket
- `ADMIN_SECRET_KEY`: Admin access secret key

## API Endpoints

### Public Endpoints
- `GET /api/images/:bucket` - Retrieve public images from gallery or flash storage
- `POST /submit-form` - Submit consultation form with optional image upload
- `GET /` - Serve main index page
- `GET /signIn` - Serve sign-in page

### Authentication Required
- `POST /admin/sign-in` - Admin authentication endpoint
- `GET /admin/dashboard` - Admin dashboard page
- `GET /auth/api/inquiries` - Retrieve submitted inquiries
- `GET /auth/api/abuse-logs` - Retrieve abuse logs
- `POST /auth/api/upload-image` - Upload images to gallery/flash
- `DELETE /auth/api/delete-image` - Delete images from gallery/flash

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## TODO

- Dashboard database edits
- Booking/Calendar feature with admin right to block off days
- Testimonials - Google reviews integration

## Security Measures

- Rate limiting on form submissions
- reCAPTCHA validation
- Input sanitization to prevent injection attacks
- HTTPS enforcement
- Secure cookie settings
- Role-based access control for admin features
- IP address logging for abuse prevention