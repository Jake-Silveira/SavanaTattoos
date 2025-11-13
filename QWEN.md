# Raven's Nest Co. - Tattoo Studio Website

## Project Overview

Raven's Nest Co. is a professional tattoo studio website built with Node.js/Express backend and HTML/CSS/JavaScript frontend. The site serves as an online presence for Savana Tattoos, featuring a gallery of work, flash sheets, artist information, and an inquiry form for booking tattoo consultations.

The application uses Supabase for authentication and database operations, with rate limiting, file uploads, and email notifications functionality. The site is hosted on Render and serves content from the `backend/public` directory.

## Architecture

- **Backend**: Node.js/Express server with REST API endpoints
- **Database**: Supabase (PostgreSQL) for data storage and authentication
- **Frontend**: HTML/CSS/JavaScript with responsive modal-based interface
- **Authentication**: Supabase authentication for admin users
- **File Storage**: Supabase storage for image uploads (gallery/flash sheets)
- **Email Service**: Resend API for sending notifications

## Key Features

1. **Public Inquiry Form**: Allows customers to submit tattoo consultation requests with image uploads, date availability, and contact information
2. **Admin Authentication**: Secure admin sign-in with role-based access control
3. **Image Management**: Admin can upload and delete gallery and flash sheet images
4. **Inquiry Management**: Admin dashboard to view submitted inquiries
5. **Responsive Design**: Mobile-friendly modal interface for navigation
6. **Rate Limiting**: Prevents spam submissions with IP-based rate limiting
7. **Abuse Logging**: Monitors and logs potential abuse attempts
8. **reCAPTCHA Integration**: Prevents automated form submissions

## File Structure

```
SavanaTattoos/
├── backend/
│   ├── public/
│   │   ├── css/
│   │   ├── images/
│   │   ├── dashboard.html
│   │   ├── index.html
│   │   ├── scripts.js
│   │   ├── signIn.html
│   │   └── styles.css
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── toDo.txt
└── QWEN.md
```

## Building and Running

### Prerequisites
- Node.js 18+ installed
- Supabase project with authentication and storage configured
- Resend API key for email notifications
- Google reCAPTCHA site and secret keys

### Environment Variables
Create a `.env` file in the backend directory with the following:
```
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
FROM_EMAIL=your_email
TO_EMAIL=recipient_email
RESEND_API_KEY=your_resend_api_key
SUPABASE_BUCKET=your_bucket_name
ADMIN_SECRET_KEY=your_admin_secret_key (optional)
ADMIN_SECRET_ACCESS=your_admin_secret_access (optional, now removed)
```

### Installation and Running
```bash
cd SavanaTattoos/backend
npm install
node server.js
```

## Development Conventions

- Server routes follow RESTful patterns with `/api/` prefix for public endpoints and `/auth/api/` for authenticated endpoints
- Client-side code uses vanilla JavaScript with DOM manipulation
- Form validation occurs both client-side and server-side
- Images are limited to 5MB with JPG/PNG format restrictions
- Authentication tokens are stored in HTTP-only secure cookies
- All user inputs are sanitized to prevent injection attacks

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

## Known TODO Items

- Dashboard database edits
- Booking/Calendar feature with admin right to block off days
- Testimonials - Google reviews integration

## Deployment

The application is designed for deployment on Render with automatic builds triggered by Git pushes. The Express server handles static file serving from the `public` directory and API requests.

## Security Measures

- Rate limiting on form submissions
- reCAPTCHA validation
- Input sanitization
- HTTPS enforcement
- Secure cookie settings
- Role-based access control
- IP address logging for abuse prevention