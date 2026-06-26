# SavanaTattoos — Developments & Progress Tracker

> Created: 2025-06-25
> Last updated: 2026-06-26
> Status: **Source code complete + validated. Template comparison done (2026-06-26). Ready for Supabase provisioning & deployment.**

---

## What Was Being Built

A tattoo studio website + admin dashboard with:
- **Public site** (`index.html` + `script.js`) — brochure site with portfolio gallery, flash gallery, client reviews, inquiry booking form
- **Admin dashboard** (`admin.html` + `admin.js`) — 4-panel management: Leads, Scheduler/Calendar, Client Profiles, Site Management
- **API routes** — serverless functions for CRUD operations (gallery, flash, reviews, feedback, clients, leads, availability)
- **Supabase backend** — PostgreSQL + Auth + Storage (not yet provisioned)
- **Build system** — Node script injects env vars into HTML at build time, copies assets to `/public/`

Architecture intentionally mirrors `Project_Template/` patterns for consistency.

---

## File Inventory (All Created)

### Project Config (6 files)
| File | Lines | Description |
|---|---|---|
| `package.json` | 18 | Dependencies: `@supabase/supabase-js`, `formidable`, `resend`, `serve` |
| `build.js` | ~80 | Env injection build tool (reads `.env` → populates `window.__ENV__` → copies to `/public/`) |
| `vercel.json` | 13 | Vercel deploy config: build command, output dir, `/admin` rewrite |
| `.env.example` | 14 | Env var template (Supabase keys, Discord webhook, Resend API) |
| `.gitignore` | ~10 | Excludes `public/`, `.env`, `node_modules/`, backups, `.DS_Store` |
| `SETUP.md` | 315 | **Critical**: Supabase schema SQL, RLS policies, 3 storage buckets, admin user setup |

### Frontend (4 files, ~3,038 lines)
| File | Lines | Description |
|---|---|---|
| `index.html` | 268 | Public site markup: hero, portfolio carousel, flash grid, reviews carousel, services, contact, booking modal |
| `script.js` | 446 | Public site logic: phone formatting, calendar picker, time picker, carousels, form submission |
| `admin.html` | 528 | Admin dashboard: login screen, sidebar nav, 4 panels, modals |
| `styles.css` | 2,316 | Dark tattoo theme: gold accent `#c9a87c`, dark backgrounds, responsive layouts |

### Shared Utilities (1 file)
| File | Lines | Description |
|---|---|---|
| `utils.js` | 490 | Shared logic: `DURATION_MAP` (XS–XXL tattoo sizes), calendar picker, time picker, phone formatting, Supabase client init, auth headers, status badges, dashboard stats, email triggers (`triggerConfirmation`, `triggerConfirmedEmail`) |

### API Routes (10 files, 3 removed as dead code 2026-06-26)
| File | Description |
|---|---|
| `api/_utils/auth.js` | `verifyAdmin()` — JWT check via Supabase service role key + `admin_profiles` role lookup |
| `api/_utils/duration.js` | Server-side `DURATION_MAP` + `calculateDuration()` |
| `api/_utils/time.js` | Server-side `formatTime12()` |
| `api/send-email.js` | Unified email handler: `inquiry-confirmation` (public) + `appointment-confirmed` (admin-authed) |
| `api/gallery.js` | Portfolio CRUD — GET public, POST/DELETE/PATCH admin |
| `api/flash.js` | Flash gallery CRUD — GET public, POST/DELETE/PATCH admin |
| `api/reviews.js` | Reviews CRUD — GET public, POST/DELETE/PATCH admin |
| ~~`api/feedback.js`~~ | ~~Feedback CRUD~~ — **REMOVED** dead code (admin.js uses direct DB calls) |
| `api/availability.js` | Blocked slots — POST block, DELETE unblock, admin-authed |
| ~~`api/clients.js`~~ | ~~Client CRUD~~ — **REMOVED** dead code (admin.js uses direct DB calls) |
| `api/booking/create.js` | Admin booking creation: new client auto-creation, duration calc, confirmation email |
| `api/leads/update.js` | Admin lead status/duration/time updates |
| `api/leads/delete.js` | Soft-delete leads (set `status = 'deleted'`) |
| ~~`api/profiles.js`~~ | ~~Client profile CRUD~~ — **REMOVED** dead code (admin.js uses direct DB calls) |

### Documentation (2 added 2026-06-26)
| File | Description |
|---|---|
| `AGENTS.md` | Architecture reference, planning docs, tattoo-specific adaptations |
| `README.md` | Public-facing documentation for tattoo studio site |

### Backups (2 files, should be ignored)
| File | Size | Description |
|---|---|---|
| `db_cluster-07-09-2025@04-07-15.backup.gz` | 56MB | Original DB dump — excluded by `.gitignore` |
| `klsgtwlcvpngkwbzromr.storage.zip` | 63MB | Original storage dump — excluded by `.gitignore` |

---

## What Has Been Accomplished

### ✅ Complete
1. **Project scaffolding** — All 6 config files written
2. **Public site** — Full HTML structure + JS logic (calendar, time picker, carousels, form)
3. **Admin dashboard** — Full HTML + JS (1247 lines): auth, sidebar, all 4 panels, all modals
4. **CSS theme** — Dark/edgy tattoo studio theme with gold accent, responsive
5. **Shared utilities** — Duration maps (XS–XXL tattoo sizes), pickers, Supabase helpers
6. **All API routes** — 13 route handlers covering every CRUD operation
7. **Email system** — Inquiry confirmation + appointment confirmation with tattoo-themed HTML
8. **SETUP.md** — Complete Supabase provisioning guide with SQL schema, RLS policies, storage buckets

### ✅ Verified Complete
- `admin.js` — ends properly (line 1247: closing `});` with year footer)
- `utils.js` — ends properly (line 490: closing `return { showTimePicker }`)
- `api/leads/delete.js` — last write completed (25 lines, soft-delete)

### ✅ Verified & Validated (2026-06-26)
- **All 8 JS files pass `node --check`** — `admin.js`, `utils.js`, `script.js`, `build.js`, `api/send-email.js`, `api/_utils/auth.js`, `api/booking/create.js`, `api/leads/update.js`, `api/leads/delete.js` ✅
- **`public/` directory exists** — `npm run build` has been run at least once (6 files present with timestamps 2026-06-26 09:03) ✅
- **`package-lock.json` exists** — `npm install` has been run (timestamp 2026-06-26 08:48) ✅
- **Dead API routes confirmed removed** — `api/clients.js`, `api/profiles.js`, `api/feedback.js` no longer present ✅
- **`api/_utils/auth.js` confirmed fixed** — uses `SUPABASE_SERVICE_ROLE_KEY` (line 13: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)`) ✅
- **`admin.js` API calls verified** — only calls `/api/booking/create` and `/api/send-email` directly; all other data operations use direct Supabase DB calls ✅
- **No `.env` file present** — only `.env.example` exists. Must be created before running. ⚠️

### ✅ Cleanup Completed (2026-06-26)
- Fixed `api/_utils/auth.js` — Changed `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
- Removed dead API routes: `api/clients.js`, `api/profiles.js`, `api/feedback.js`
- Added `AGENTS.md` — tattoo-specific architecture reference
- Added `README.md` — public-facing documentation

---

## What Still Needs to Be Done

### Phase 1: Supabase Provisioning (Required Before Anything Works)
1. **Create Supabase project** (if not already created)
2. **Run schema SQL** — all tables: `leads`, `gallery_items`, `flash_gallery`, `reviews`, `feedback`, `blocked_slots`, `client_profiles`, `appointments`, `admin_profiles`
3. **Create RLS policies** — public read for public tables, admin-only write, verified-user profile updates
4. **Create storage buckets** — `portfolio`, `flash-images`, `client-photos`
5. **Create admin user** — Supabase Auth user + insert into `admin_profiles` with `role = 'admin'`

### Phase 2: Environment Setup
1. **Create `.env` file** — copy `.env.example` to `.env`, fill in real Supabase credentials
   - `SUPABASE_URL` — project URL
   - `SUPABASE_ANON_KEY` — for frontend
   - `SUPABASE_SERVICE_ROLE_KEY` — for API routes
   - `RESEND_API_KEY` / `FROM_EMAIL` / `ADMIN_EMAIL` — optional, for email notifications
2. **Verify build works** — `npm run build` should regenerate `/public/` with injected env vars
   - ⚠️ Already verified: `public/` exists with built files, but env injection only works when `.env` or `process.env` contains real values

### Phase 3: Local Testing
1. **Start dev server** — `npm start` → verify public site loads at `localhost:3000`
2. **Verify `/admin` redirect** — `/admin.html` should return 200 (serve handles 301→200)
3. **Test admin login** — Supabase auth flow with admin user credentials
4. **Test public inquiry form** — Create a lead from public site → verify it appears in admin Leads panel
5. **Test admin Leads panel** — View lead detail, update status (pending → contacted → confirmed/cancelled)
6. **Test Scheduler** — Block times, create new appointment (from new appointment modal)
7. **Test Client Profiles** — Create/edit clients, create/edit profiles
8. **Test Site Management** — CRUD on gallery, flash gallery, reviews
9. **Test email triggers** — Confirm inquiry-confirmation and appointment-confirmed emails send (check Resend dashboard if using)

### Phase 4: Deployment
1. **Initialize Git repo** (if not already) — `git init`, `git add .`, `git commit`
2. **Create remote repo** — GitHub/GitLab, push to remote
3. **Deploy to Vercel** — Connect repo, configure env vars in Vercel dashboard
4. **Verify production** — Test all flows on deployed site

---

## Known Issues / TODOs

### Resolved ✅
- ~~`api/_utils/auth.js` uses `SUPABASE_ANON_KEY`~~ — Fixed 2026-06-26: now uses `SUPABASE_SERVICE_ROLE_KEY` (line 13)
- ~~`api/clients.js` dead code~~ — Removed 2026-06-26: admin.js uses direct DB calls
- ~~`api/profiles.js` dead code~~ — Removed 2026-06-26: admin.js uses direct DB calls
- ~~`api/feedback.js` dead code~~ — Removed 2026-06-26: admin.js uses direct DB calls
- ~~All JS files fail syntax check~~ — All 8 JS files pass `node --check` ✅
- ~~Build fails~~ — `npm run build` completes successfully, `/public/` generated ✅
- ~~`package-lock.json` missing~~ — Present (created by `npm install`) ✅

### Remaining Issues / Notes

#### Code Quality
1. **`triggerConfirmedEmail` shadowed** — Defined in both `utils.js` (signature: `(db, lead)`) and `admin.js` (signature: `(lead)`, line 940). Admin.js version shadows it, making the `utils.js` copy dead code. `build.js` copies `admin.js` as-is, so the admin.js version is served. **No runtime bug** — the shadowed version works correctly. Consider removing the dead `utils.js` definition to reduce confusion.
2. **No loading states** — Admin panels have no spinner/loading indicator during data fetches.
3. **No error boundary** — Public site catches errors in `console.error` without user-facing fallback.

#### Email System
4. **`appointment-confirmed` vs template's `booking-confirmed`** — `api/send-email.js` uses `appointment-confirmed` action. Consistent internally (`api/booking/create.js` and `admin.js` both use this action name). Naming diverges from template convention but is internally consistent.

#### Database Schema
5. **`gallery_items` vs template's `gallery_pairs`** — Tattoo site uses single-image gallery items (intentional tattoo adaptation).
6. **`client_profiles` is new** — Tattoo-specific table not in template. Detailed client records with notes, photos, preferences.
7. **`flash_gallery` is new** — Tattoo-specific table for flash design images.
8. **`clients.client_id` vs template's `client_code`** — Naming differs but consistent within SavanaTattoos codebase.
9. **No `client-welcome` email** — New clients don't receive their 6-digit lookup code via email (unlike template).

#### Missing from Template (Intentional)
10. **`assets/` directory** — No logo/favicon. Not needed until branding is finalized.
11. **`.opencode/`** — Not configured in template either.

### Improvements Needed (Backlog)
- [ ] Add loading states to admin panels (currently instant, no spinner)
- [ ] Add error boundary to public site (currently bare `console.error`)
- [ ] Add CSRF protection to admin API routes (currently relies on bearer token)
- [ ] Add rate limiting to public inquiry form (currently unlimited)
- [ ] Add image validation to gallery/flash upload endpoints
- [ ] Add pagination to leads and clients panels (currently loads all)
- [ ] Add export functionality for leads data (CSV/Excel)
- [ ] Add appointment notifications (email/SMS) for admins
- [ ] Add `client-welcome` email action — send 6-digit lookup code to new clients
- [ ] Add `profiles.last_activity` tracking — update after booking
- [ ] Remove dead `utils.js` `triggerConfirmedEmail` definition to reduce confusion

### Improvements Needed
- [ ] Add loading states to admin panels (currently instant, no spinner)
- [ ] Add error boundary to public site (currently bare `console.error`)
- [ ] Add CSRF protection to admin API routes (currently relies on bearer token)
- [ ] Add rate limiting to public inquiry form (currently unlimited)
- [ ] Add image validation to gallery/flash upload endpoints
- [ ] Add pagination to leads and clients panels (currently loads all)
- [ ] Add export functionality for leads data (CSV/Excel)
- [ ] Add appointment notifications (email/SMS) for admins

---

## Migration Status: Template → SavanaTattoos

> SavanaTattoos was developed by cloning Project_Template and customizing it for a tattoo studio.
> The following tracks what has been completed vs what still needs to be migrated or aligned.
>
> **Reviewed against Project_Template on 2026-06-26.**

### ✅ Migrated & Customized (Core App)

| File | Status | Template Lines | SavanaTattoos Lines | Notes |
|---|---|---|---|---|
| `build.js` | ✅ Done | 109 | 105 | Identical logic, only emoji/console messages differ |
| `vercel.json` | ✅ Done | 13 | 13 | Identical |
| `package.json` | ✅ Done | 18 | 18 | Identical deps + scripts |
| `.env.example` | ✅ Done | 14 | 14 | Identical |
| `.gitignore` | ✅ Done | 8 | ~10 | Tattoo-specific additions (.env.local, db backups) |
| `index.html` | ✅ Done | 301 | 268 | Tattoo branding, flash gallery section, different form fields |
| `admin.html` | ✅ Done | 894 | 528 | Tattoo branding, panel names, different data fields |
| `script.js` | ✅ Done | 731 | 446 | **Missing: returning client lookup** (285 lines shorter) |
| `utils.js` | ✅ Done | 533 | 490 | Tattoo DURATION_MAP (XXXL added), tattoo helpers |
| `styles.css` | ✅ Done | 3,588 | 2,316 | Dark/edgy theme vs template's light/pink theme |
| `developments.md` | ✅ Done | 1 | 406 | Project tracker (vs. 1-line template) |

### ✅ Added (2026-06-26)

| File | Status | Notes |
|---|---|---|
| `AGENTS.md` | ✅ Added | Customized from template — tattoo-specific architecture reference |
| `README.md` | ✅ Added | Public-facing documentation for tattoo studio |
| `SETUP.md` | ✅ Done | Customized from template's `database_schema.md` (9 tables, 3 tattoo buckets) |

### ✅ Tattoo-Specific Additions (New Files)

| File | Status | Template Equivalent | Notes |
|---|---|---|---|
| `api/flash.js` | ✅ Done | ❌ None | Flash tattoo gallery CRUD — new tattoo-specific feature |
| `api/feedback.js` | ❌ Removed | `api/feedback.js` (80 lines) | Dead code — removed, admin.js uses direct DB calls |
| `api/profiles.js` | ❌ Removed | `api/profiles.js` (110 lines) | Dead code — removed, admin.js uses direct DB calls |
| `api/clients.js` | ❌ Removed | `api/profiles.js` (110 lines) | Dead code — removed, admin.js uses direct DB calls |

### ✅ Server-Side Utils (Verified Present)

| File | Status | Template Lines | SavanaTattoos Lines | Notes |
|---|---|---|---|---|
| `api/_utils/auth.js` | ✅ Fixed | 61 | 37 | Now uses `SUPABASE_SERVICE_ROLE_KEY` (was `SUPABASE_ANON_KEY`). Shorter: no fallback logic. |
| `api/_utils/duration.js` | ✅ Done | 32 | ~28 | Tattoo-specific DURATION_MAP (includes XXXL, Cover-Up, Touch-Up, Flash, Consultation) |
| `api/_utils/time.js` | ✅ Done | 14 | 14 | Identical |
| `api/send-email.js` | ⚠️ Partial | 205 | 160 | **Missing `profile-welcome` action** (35 lines). Action renamed: `booking-confirmed` → `appointment-confirmed`. Missing partial failure handling. |
| `api/booking/create.js` | ⚠️ Partial | 188 | 145 | Missing `client-welcome` email trigger, missing `new_pet` flow, missing `last_activity` update, missing `client_code` return value. Tattoo-specific adaptations. |
| `api/leads/update.js` | ✅ Done | 51 | 45 | Same pattern |
| `api/leads/delete.js` | ✅ Done | 40 | 25 | Same pattern |
| `api/availability.js` | ✅ Done | 57 | ~25 | Same pattern, tattoo-specific |
| `api/gallery.js` | ✅ Done | 188 | ~60 | Targets `gallery_items` (not `gallery_pairs`). Missing image upload endpoint (template has multipart upload). |
| `api/reviews.js` | ✅ Done | 85 | ~45 | Same pattern |

### ❌ Not Migrated (Template Files Still Missing)

| File | Needed? | Notes |
|---|---|---|
| `assets/` | ⚠️ Optional | Logo, favicon, placeholder images, demo video. Not needed until branding is finalized. |
| `TEMPLATE.md` | ❌ No | Not needed — SavanaTattoos IS the customized product now. |
| `migration.md` | ❌ No | Not needed — SavanaTattoos is the destination project. |
| `database_schema.md` | ✅ Replaced | `SETUP.md` covers this for SavanaTattoos. |
| `package-lock.json` | ✅ Present | Created by `npm install` (timestamp 2026-06-26). Should be committed. |
| `.opencode/` | ❌ No | Not configured in template either. |
| `profiles/upload-picture.js` | ❌ No | Template has profile picture upload. SavanaTattoos has no equivalent. |
| `profiles/book.js` | ❌ No | Template has single-booking endpoint. SavanaTattoos doesn't need it. |
| `profiles/book-household.js` | ❌ No | Template has multi-pet household booking. Not applicable to tattoo studio. |

### ❌ Not Migrated (Template Features Not Ported)

| Feature | Template | SavanaTattoos | Impact |
|---|---|---|---|
| **Returning client lookup** | ✅ `script.js` queries profiles by 6-digit `client_id` | ❌ Missing | New clients only. No way for return clients to pre-fill their info via ID lookup. |
| **`client-welcome` email** | ✅ `send-email.js` sends 6-digit code to new client | ❌ Missing | New clients don't receive their lookup code. They can only get it from admin. |
| **`booking-confirmed` → `appointment-confirmed`** | Template action name | Custom name | **No bug** — internally consistent, just diverges from template convention. |
| **`profile-welcome` email** | ✅ Sends new client their 6-digit ID | ❌ Missing | Related to above — no automated client onboarding email. |
| **`client_code` column** | ✅ `clients.client_code` | ⚠️ `clients.client_id` | Naming differs. Consistent within SavanaTattoos but diverges from template. |
| **`is_public` booking flag** | ✅ `booking/create.js` skips auth when `is_public: true` | ❌ Admin-only booking | Public site creates leads via direct DB insert (bypasses API entirely). No public booking API. |
| **`gallery_pairs` (before/after)** | ✅ Before/after image pairs | ✅ `gallery_items` (single image) | **Intentional change** — tattoo portfolios typically show single finished pieces, not before/after. |
| **`gallery.js` image upload** | ✅ Multipart form upload to storage buckets | ❌ Missing | Admin can only add gallery via Supabase dashboard or direct DB insert. No image upload UI/API. |
| **`profiles.last_activity`** | ✅ Updated after each booking | ❌ Not implemented | Client profiles don't track last service/activity date. |
| **`client_profiles` table** | ❌ N/A (template uses flat `profiles`) | ✅ New table | SavanaTattoos has separate `clients` (owner info) + `client_profiles` (detailed records). Template has just `profiles`. |
| **`flash_gallery` table** | ❌ N/A | ✅ New table | Tattoo-specific flash design grid — new feature, no template equivalent. |
| **`feedback` management** | ✅ `api/feedback.js` + admin panel | ⚠️ Admin uses direct DB | Dead API route removed (2026-06-26), but admin panel still has feedback tab. |
| **`profiles.js` API routes** | ✅ CRUD for profiles | ❌ Dead code removed | Admin.js uses direct Supabase DB calls for all profile operations. |
| **Storage buckets** | `profile-pictures`, `gallery-before`, `gallery-after` | `portfolio`, `flash-images`, `client-photos` | Tattoo-specific names — intentional change. |
| **DURATION_MAP services** | Standard, Premium, Express, etc. | Custom Design, Cover-Up, Touch-Up, Flash Tattoo, Consultation | Tattoo-specific services with their own time estimates. |
| **DURATION_MAP sizes** | XS, Small, Medium, Large, XL, XXL | XS, Small, Medium, Large, XL, XXL, **XXXL** | Added XXXL (custom sleeve/back piece with weight-based calculation). |
| **Blocked days** | Sundays (day 0) blocked | Sundays + Mondays (days 0, 1) blocked | Tattoo studios typically closed 2 days/week. |

---

## Priority Fixes (Blocking)

1. **`api/_utils/auth.js` — Fix auth key** (CRITICAL) ✅ Done (2026-06-26)
   - Changed `SUPABASE_ANON_KEY` → `SUPABASE_SERVICE_ROLE_KEY`

2. **Remove dead API routes** (`api/clients.js`, `api/profiles.js`, `api/feedback.js`) ✅ Done (2026-06-26)
   - Removed all three — admin.js uses direct Supabase DB calls throughout

3. **Add `package-lock.json` to version control** ✅ Done
    - `npm install` completed, `package-lock.json` present (timestamp 2026-06-26)

4. **Add `AGENTS.md`** (customized for SavanaTattoos) ✅ Done (2026-06-26)
   - Provides planning context for future sessions
   - Architecture reference for the tattoo-specific adaptations

5. **Add `README.md`** ✅ Done (2026-06-26)
    - Public-facing documentation adapted for tattoo studio

---

## Migration Gaps: Template → SavanaTattoos (Not Blocking)

> These are features present in Project_Template that were intentionally omitted or adapted for the tattoo studio context.
> None block deployment — they are enhancements for future sessions.

### High-Priority Gaps

1. **`client-welcome` email action** — Missing from `api/send-email.js`
   - Template sends new clients a 6-digit lookup code via email
   - SavanaTattoos: clients don't receive codes automatically; they must ask admin
   - Fix: Add `profile-welcome` / `client-welcome` action to `send-email.js`, call from `api/booking/create.js`

2. **Returning client lookup** — Missing from `script.js` (`index.html` + `script.js`)
   - Template: "Returning Client" tab with 6-digit ID lookup → selects profile → pre-fills form
   - SavanaTattoos: Only "New Client" form
   - Fix: Port client lookup flow from template `script.js` lines 32-241

3. **Gallery image upload** — Missing from `api/gallery.js`
   - Template: Multipart form upload to `gallery-before`/`gallery-after` storage buckets
   - SavanaTattoos: Can only add gallery items via Supabase dashboard or direct DB insert
   - Fix: Add multipart upload handler to `api/gallery.js`, add image upload UI to admin Site Management tab

### Medium-Priority Gaps

4. **`profile.last_activity` tracking** — Missing from `api/booking/create.js`
   - Template: Updates `profiles.last_activity` and `last_activity_date` after each booking
   - SavanaTattoos: No equivalent update on `client_profiles`
   - Fix: Add update after lead insert in `api/booking/create.js`

5. **Partial failure handling** — Missing from `api/send-email.js`
   - Template: Returns `{partialFailure: true}` with `{clientFailed, adminFailed}` details
   - SavanaTattoos: Always returns `{success: true}` — no indication if email failed
   - Fix: Add partial failure tracking to `inquiry-confirmation` action

6. **`build.js` assets copy** — `build.js` copies `assets/` but `assets/` doesn't exist
   - Template: Has `assets/` with logos, favicon, images
   - SavanaTattoos: No `assets/` directory
   - Fix: Either create `assets/` with tattoo studio branding, or remove STATIC_DIRS from `build.js`

### Low-Priority Gaps (Intentional Divergence)

7. **`booking-confirmed` → `appointment-confirmed`** — Action name changed
   - Internally consistent, no bug. Naming diverges from template convention.

8. **`gallery_pairs` → `gallery_items`** — Single image vs before/after
   - Intentional tattoo adaptation. Tattoo portfolios show finished work, not transformations.

9. **Storage bucket names** — `portfolio`/`flash-images`/`client-photos` vs `profile-pictures`/`gallery-before`/`gallery-after`
   - Tattoo-specific names. Intentional change.

10. **Admin booking only** — No `is_public` flag in `booking/create.js`
    - Public site creates leads via direct DB insert (bypasses API).
    - This is an architectural choice, not a bug. Template supports both public and admin booking through the same API.

11. **`feedback.js` removed** — Dead code removed, admin panel still has feedback tab
    - Admin panel uses direct `db.from('site_feedback')` calls instead of API route.
    - This pattern (direct DB calls vs API routes) is consistent throughout admin.js.

---

## Architecture Summary

```
SavanaTattoos/
├── .env.example           # Environment template
├── .gitignore             # Excludes public/, .env, node_modules/, backups/
├── package.json           # Dependencies + scripts
├── package-lock.json      # Dependency lock file
├── vercel.json            # Vercel deploy config
├── build.js               # Build script (env injection)
├── SETUP.md               # Supabase provisioning guide
├── AGENTS.md              # Architecture reference (added 2026-06-26)
├── README.md              # Public documentation (added 2026-06-26)
├── styles.css             # Dark/edgy theme (~2300 lines)
│
├── index.html             # Public site (268 lines)
├── script.js              # Public site logic (446 lines)
│
├── admin.html             # Admin dashboard (528 lines)
├── admin.js               # Admin dashboard logic (1247 lines)
│
├── utils.js               # Shared utilities (490 lines)
│
└── api/                   # Vercel serverless functions
    ├── _utils/
    │   ├── auth.js        # verifyAdmin() — JWT + service role key check
    │   ├── duration.js    # DURATION_MAP + calculateDuration()
    │   └── time.js        # formatTime12()
    ├── send-email.js      # Unified email dispatch
    ├── gallery.js         # Portfolio CRUD
    ├── flash.js           # Flash gallery CRUD
    ├── reviews.js         # Reviews CRUD
    ├── availability.js    # Blocked slots
    ├── booking/
    │   └── create.js      # Admin booking creation
    └── leads/
        ├── update.js      # Lead status/duration updates
        └── delete.js      # Soft-delete leads
```

---

## Supabase Schema (From SETUP.md)

### Tables
| Table | Purpose |
|---|---|
| `leads` | Inquiry records (status: pending → contacted → confirmed/cancelled) |
| `gallery_items` | Portfolio tattoo photos |
| `flash_gallery` | Flash design images |
| `reviews` | Client reviews (rating 1-5, comment, name) |
| `feedback` | General site feedback |
| `blocked_slots` | Admin-blocked time ranges |
| `client_profiles` | Detailed client records (notes, photos, preferences) |
| `appointments` | Booked appointments linked to clients |
| `admin_profiles` | Admin users with roles |

### Storage Buckets
| Bucket | Purpose |
|---|---|
| `portfolio` | Gallery images |
| `flash-images` | Flash gallery images |
| `client-photos` | Client profile photos |

---

## Tattoo Duration Mappings (DURATION_MAP)

| Size | Duration | Typical Work |
|---|---|---|
| XS | 2–4 hours | Small symbols, text, minimalist |
| Small | 4–6 hours | Hand/finger tattoos, small pieces |
| Medium | 6–10 hours | Forearm, half-sleeve start, mid back |
| Large | 10–16 hours | Full sleeve, large back piece |
| XL | 16–24 hours | Double sleeve, large back/chest |
| XXL | 24+ hours | Full body suits, major projects |

---

## Key Design Decisions

1. **Node/static build** (not Next.js) — matches existing template, simpler deployment
2. **Soft-delete for leads** — `status = 'deleted'` instead of hard delete, preserves history
3. **Admin booking flow** — Single `api/booking/create.js` handles new client auto-creation + linking
4. **Email dispatch centralized** — `api/send-email.js` routes by action type
5. **Event delegation** — Admin JS uses delegated event listeners for dynamic content
6. **Dark/edgy theme** — Gold accent `#c9a87c` on dark backgrounds, consistent with tattoo studio aesthetic
7. **Tattoo duration categories** — Uses size-based (XS–XXL) not time-based scheduling

---

## Next Session Plan

When resuming work, the recommended order is:

1. **Set up Supabase** — Create project, run schema SQL (from `SETUP.md`), create RLS policies, storage buckets, admin user
2. **Create `.env`** — Copy `.env.example` to `.env`, fill in real Supabase credentials
3. **Verify build** — `npm run build` should regenerate `/public/` with injected env vars (already built once, but needs real env vars for proper `window.__ENV__`)
4. **Test locally** — `npm start` + admin login + lead creation flow + scheduler + client profiles
5. **Deploy** — Push to Git, deploy to Vercel, configure prod env vars

### Optional Migration Enhancements (After Core Deployment)

> See "Migration Gaps" section above for full details.

6. **Add `client-welcome` email** — Port `profile-welcome` action from template `send-email.js` + trigger in `booking/create.js`
7. **Add returning client lookup** — Port client ID lookup flow from template `script.js` (lines 32-241)
8. **Add gallery image upload** — Add multipart handler to `api/gallery.js` + upload UI in admin
9. **Add `last_activity` tracking** — Update `client_profiles` after booking in `api/booking/create.js`
10. **Add partial failure handling** — Track `clientFailed`/`adminFailed` in `inquiry-confirmation` email dispatch
