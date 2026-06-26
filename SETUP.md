# SavanaTattoos — Setup Guide

This guide walks you through creating and configuring a new Supabase project for SavanaTattoos.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New Project**
3. Choose a name (e.g., "SavanaTattoos"), select your organization, pick a region closest to your target audience
4. Set a strong **Database Password** and save it
5. Wait ~2 minutes for the project to provision

---

## 2. Set Environment Variables

After provisioning, go to **Project Settings > API** and copy:

- **Project URL** → paste as `SUPABASE_URL`
- **anon public** key → paste as `SUPABASE_ANON_KEY`

Then go to **Project Settings > Service Role** and copy:

- **service_role secret** → paste as `SUPABASE_SERVICE_ROLE_KEY`

Create a `.env` file in the project root:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

For email functionality (optional):

```
RESEND_API_KEY=your_resend_key
FROM_EMAIL=your@email.com
ADMIN_EMAIL=admin@email.com
```

For Discord notifications (optional):

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
```

---

## 3. Create Admin User

### Step A: Create Auth User

Go to **Authentication > Users > Add User**:

- Email: your admin email
- Password: a strong password
- Check "Auto Confirm User"

### Step B: Create Admin Profile Record

Go to **SQL Editor** and paste:

```sql
-- Replace with the UUID from the user you just created
INSERT INTO admin_profiles (id, email, role)
VALUES ('YOUR_AUTH_USER_UUID', 'admin@example.com', 'admin');
```

To find your auth user UUID, run:

```sql
SELECT id, email FROM auth.users;
```

---

## 4. Run the Database Schema

Go to **SQL Editor > New Query** and paste the entire schema below, then **Run**:

```sql
-- ============================================
-- SAVANATATTOOS DATABASE SCHEMA
-- ============================================

-- 1. Admin Profiles (links auth users to admin roles)
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clients (studio clients)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    client_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Client Profiles (individual client records, can be linked to a client group)
CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_ref_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_id TEXT,
    name TEXT NOT NULL,
    category TEXT,
    size_category TEXT,
    custom_size TEXT,
    owner_name TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    special_notes TEXT,
    profile_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Leads (inquiries and bookings)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_ref_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
    service TEXT NOT NULL,
    body_placement TEXT,
    size TEXT,
    requested_date DATE,
    requested_time TIME,
    confirmed_time TIME,
    duration_minutes INT DEFAULT 60,
    name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Blocked Slots (studio closures, holidays, days off)
CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_full_day BOOLEAN DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Gallery Items (tattoo portfolio — single images with optional categories)
CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    image_url TEXT,
    category TEXT DEFAULT 'portfolio',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Flash Gallery (pre-designed flash tattoo pieces)
CREATE TABLE IF NOT EXISTS flash_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    image_url TEXT,
    description TEXT,
    price TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Reviews (public testimonials)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_text TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    rating INT DEFAULT 5,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Site Feedback (internal tracker for website feedback)
CREATE TABLE IF NOT EXISTS site_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high', 'complete')),
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_leads_requested_date ON leads(requested_date);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_client_ref_id ON leads(client_ref_id);
CREATE INDEX idx_leads_profile_id ON leads(profile_id);
CREATE INDEX idx_blocked_slots_date ON blocked_slots(date);
CREATE INDEX idx_reviews_display_order ON reviews(display_order);
CREATE INDEX idx_gallery_items_display_order ON gallery_items(display_order);
CREATE INDEX idx_flash_gallery_display_order ON flash_gallery(display_order);
CREATE INDEX idx_client_profiles_client_ref ON client_profiles(client_ref_id);
CREATE INDEX idx_client_profiles_client_id ON client_profiles(client_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_feedback ENABLE ROW LEVEL SECURITY;

-- admin_profiles: public SELECT (for auth checks), authenticated full access
CREATE POLICY "Public select admin_profiles" ON admin_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated full admin_profiles" ON admin_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- clients: authenticated only
CREATE POLICY "Authenticated full clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_profiles: authenticated only
CREATE POLICY "Authenticated full client_profiles" ON client_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- leads: public can INSERT inquiries; authenticated full access
CREATE POLICY "Public insert leads" ON leads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public select leads" ON leads FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated full leads" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- blocked_slots: authenticated only
CREATE POLICY "Authenticated full blocked_slots" ON blocked_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- gallery_items: public can view active items; authenticated full access
CREATE POLICY "Public select active gallery" ON gallery_items FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Authenticated full gallery" ON gallery_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- flash_gallery: public can view active items; authenticated full access
CREATE POLICY "Public select active flash" ON flash_gallery FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Authenticated full flash" ON flash_gallery FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- reviews: public can view active and insert; authenticated full access
CREATE POLICY "Public select active reviews" ON reviews FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Public insert reviews" ON reviews FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated full reviews" ON reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- site_feedback: authenticated only
CREATE POLICY "Authenticated full site_feedback" ON site_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 5. Create Storage Buckets

Go to **Storage > New Bucket**. Create **3 public buckets**:

| Bucket Name | Public | Description |
|---|---|---|
| `portfolio` | Yes | Tattoo portfolio images |
| `flash` | Yes | Flash tattoo design images |
| `inquiries` | Yes | User-submitted reference images from inquiry form |

For each bucket:
1. Create the bucket with the name above
2. Toggle **Public Bucket** to ON
3. No public access rules needed — RLS handles it via the table constraints

---

## 6. Verify Everything Works

Run this in the SQL Editor to confirm all tables exist:

```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg%' 
  AND tablename NOT LIKE 'sql%'
ORDER BY tablename;
```

You should see: `admin_profiles`, `blocked_slots`, `clients`, `client_profiles`, `flash_gallery`, `gallery_items`, `leads`, `reviews`, `site_feedback`.

---

## 7. Deploy

1. Push your code to GitHub
2. Connect your repo to [Vercel](https://vercel.com)
3. Add the environment variables in Vercel project settings
4. Deploy — Vercel will run `node build.js` automatically

---

## Troubleshooting

- **"Missing Supabase configuration" in browser**: Make sure you run `npm run build` before testing locally, or deploy to Vercel.
- **RLS blocking serverless functions**: Serverless functions use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. Never put the service role key in frontend code.
- **Storage uploads failing**: Verify the bucket name matches exactly and the bucket is marked as public.
- **Admin login failing**: Verify the user exists in Authentication > Users and that the `admin_profiles` row exists with `role = 'admin'`.
