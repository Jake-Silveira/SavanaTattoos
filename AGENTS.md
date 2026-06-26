# AGENTS.md — SavanaTattoos

## Planning
- **All plans live in [`developments.md`](./developments.md).** Do NOT create plans in `.opencode/plans/` or any other location — only implement what's in `developments.md`.
- When a new issue/improvement is requested, add it to `developments.md` under "Planned Improvements" before implementing.

## Commands
```bash
npm run build    # node build.js — copies assets to public/, injects env vars
npm start        # npx serve public
```
No linter, formatter, typechecker, or test runner.

## Architecture

### Application Structure
Two separate single-page applications, each with their own entry point:
- **Public site** — `index.html` + `script.js` — brochure site with portfolio gallery, flash gallery, client reviews, inquiry booking form
- **Admin dashboard** — `admin.html` + `admin.js` — 4-panel management: Leads, Scheduler/Calendar, Client Profiles, Site Management
- **Shared utilities** — `utils.js` — loaded in both admin.html and index.html before their respective scripts; provides Supabase client init, calendar picker, time picker, duration calculation, phone formatting, auth headers, tattoo-specific helpers
- **Styles** — `styles.css` — shared by both apps; dark/edgy tattoo theme with gold accent `#c9a87c`

### Build Process
`build.js` reads `.env` (local) or `process.env` (Vercel), then:
1. Strips and recreates `public/` directory
2. Processes HTML files (`index.html`, `admin.html`) — injects `window.__ENV__` with `SUPABASE_URL` and `SUPABASE_ANON_KEY` by replacing `<!-- ENV_PLACEHOLDER_START -->` … `<!-- ENV_PLACEHOLDER_END -->`
3. Copies static files (`styles.css`, `script.js`, `admin.js`, `utils.js`) as-is
- `vercel.json` configures `buildCommand: "node build.js"`, `outputDirectory: "public"`, and rewrites `/admin` → `admin.html`
- All API routes capped at `maxDuration: 10`

### Tattoo-Specific Adaptations

#### Public Site (`index.html` + `script.js`)
- **Inquiry form:** Tattoo-specific fields including size category (XS–XXL), body placement, color vs black/grey, reference style, cover-up/original
- **Phone formatting:** Auto-formats US phone numbers for tattoo studio contact
- **Calendar picker:** Tattoo-appropriate duration slots (2–24+ hours based on DURATION_MAP)
- **Gallery carousel:** Single `gallery_items` (not before/after pairs) for portfolio photos
- **Flash gallery:** Dedicated flash tattoo design grid
- **Reviews carousel:** Auto-rotates every 5s with expandable "Read More"

#### Admin Dashboard (`admin.html` + `admin.js`)
Four panels (tabbed navigation):
1. **Appointments** (`#appointmentsPanel`) — leads table with status dropdown, View/Index actions, KPI stat cards
2. **Scheduler** (`#schedulerPanel`) — month/week/day calendar views, appointment popover editing, time blocking, new appointment modal
3. **Client Profiles** (`#client-indexPanel`) — client records with notes, photos, preferences, tattoo history
4. **Site Management** (`#site-mgmtPanel`) — portfolio CRUD, flash gallery CRUD, reviews CRUD, feedback management

#### Tattoo Duration Mappings (DURATION_MAP)
| Size | Duration | Typical Work |
|------|----------|--------------|
| XS | 2–4 hours | Small symbols, text, minimalist |
| Small | 4–6 hours | Hand/finger tattoos, small pieces |
| Medium | 6–10 hours | Forearm, half-sleeve start, mid back |
| Large | 10–16 hours | Full sleeve, large back piece |
| XL | 16–24 hours | Double sleeve, large back/chest |
| XXL | 24+ hours | Full body suits, major projects |

Both `utils.js` (frontend) and `api/_utils/duration.js` (server) share this mapping.

#### Modal System
All modals share the `.modal` class with backdrop-click-to-close (admin.js). Types:
- `#leadModal` — lead detail view (read-only)
- `#clientModal` — create/edit client record
- `#profileModal` — create/edit client profile with tattoo history
- `#bookFromIndexModal` — book appointment from client profile
- `#newApptModal` — create new confirmed appointment with calendar/time pickers
- `#confirmModal` — reusable confirmation dialog

#### Event Delegation Pattern
Used extensively throughout `admin.js` — listeners attached once on parent containers (table body, grid), then delegated to children via `dataset` attributes. Key pattern:
```js
if (!element._delegationAttached) {
    element._delegationAttached = true;
    element.addEventListener('click', (e) => {
        const btn = e.target.closest('.some-action[data-action="..."]');
        if (btn) { /* handler */ return; }
    });
}
```

### Data Flow

#### Lead Lifecycle
`status` field on `leads` table follows this lifecycle:
`pending` / `new_lead` → `contacted` → `confirmed` | `cancelled` → `deleted` (archived)
- `pending`: New inquiry from public form
- `contacted`: Admin has reached out to client
- `confirmed`: Booking is set (triggers confirmation email)
- `cancelled`: Appointment cancelled (excluded from availability calculations)
- `deleted`: Archived from active table but preserved in history (soft-delete)

#### Client Model
- `clients` table — one row per client/entity
- `client_profiles` table — detailed client records (notes, photos, preferences) linked via `client_ref_id`
- `clients.client_id` — 6-digit lookup code for clients
- `client_profiles.client_ref_id` — FK to `clients.id`
- Multiple profile entries per client = multiple rows sharing the same `client_ref_id`

#### Tattoo-Specific Tables
- `gallery_items` — portfolio tattoo photos (single image, not before/after pairs)
- `flash_gallery` — flash tattoo design images
- `client_profiles` — detailed client records with notes, preferences, photo history

#### Appointment History
- History is built by querying `leads` by the entity's foreign key
- Soft-deleting leads (setting `status = 'deleted'`) preserves history

### API Architecture

#### Auth Pattern
All admin routes follow this pattern (`api/_utils/auth.js`):
```js
const { error: authError, status: authStatus } = await verifyAdmin(req);
if (authError) return res.status(authStatus).json({ error: authError });
```
**IMPORTANT:** `verifyAdmin()` uses `SUPABASE_SERVICE_ROLE_KEY`, verifies JWT via `supabase.auth.getUser(token)`, then checks `admin_profiles.role === 'admin'`.

#### Supabase Client in API Routes
All serverless functions use `createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY)` — never the anon key. This bypasses RLS.

#### Email System
`/api/send-email` (Resend API) handles actions:
- `inquiry-confirmation` — public-facing; sends to client after inquiry form submission
- `appointment-confirmed` — admin-facing; requires `verifyAdmin()`, sends booking confirmation

#### Duration Calculation
- `utils.js` — `window.DURATION_MAP` used by frontend calendar pickers
- `api/_utils/duration.js` — `DURATION_MAP` used by serverless booking functions
- Both calculate: base time from tattoo size category

### Supabase Storage Buckets
- `portfolio` — gallery portfolio images (public)
- `flash-images` — flash gallery design images (public)
- `client-photos` — client profile photos

## Env Vars
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — frontend Supabase client (injected into `window.__ENV__`)
- `SUPABASE_SERVICE_ROLE_KEY` — serverless functions only, **never frontend**
- `RESEND_API_KEY` — email delivery via Resend
- `FROM_EMAIL` — sender address for emails (defaults to Resend staging)
- `ADMIN_EMAIL` — admin notification recipient
- `DISCORD_WEBHOOK_URL` — Discord notifications

## API Route Map
```
api/
  _utils/auth.js              # verifyAdmin() — checks JWT + admin_profiles.role === 'admin'
  _utils/duration.js          # DURATION_MAP + calculateDuration()
  _utils/time.js              # formatTime12() helper
  availability.js             # POST (block slot) / DELETE (unblock slot) — requires admin auth
  flash.js                    # Flash gallery CRUD — requires admin auth
  gallery.js                  # Portfolio CRUD — requires admin auth
  leads/delete.js             # DELETE lead — requires admin auth
  leads/update.js             # PATCH lead status/details — requires admin auth
  reviews.js                  # Review CRUD — requires admin auth
  send-email.js               # POST email dispatch (Resend) — varies by action
  booking/create.js           # POST booking — admin only (creates client if new)
```

## Database Schema
- **Tables:** `leads`, `clients`, `client_profiles`, `admin_profiles`, `blocked_slots`, `reviews`, `gallery_items`, `flash_gallery`, `site_feedback`, `appointments`
- See `SETUP.md` for full Supabase provisioning guide, schema SQL, RLS policies, and storage buckets.
- **Relationships:** `client_profiles.client_ref_id` → `clients.id`; `leads` reference clients; `appointments` reference clients

## Gotchas
- **Auth in serverless functions:** Admin API routes must use `api/_utils/auth.js` (`verifyAdmin`) to check JWT + admin role. **Must use `SUPABASE_SERVICE_ROLE_KEY`**, not `SUPABASE_ANON_KEY`. Frontend uses Supabase anon key; backend functions use service role key.
- **Supabase storage buckets:** Need `portfolio` (gallery), `flash-images` (flash designs), `client-photos` (client profiles). Different names from generic template.
- **Booking scheduler:** Time slots based on tattoo size categories (XS–XXL), not fixed 30-minute intervals. Auto-duration via `DURATION_MAP`.
- **No lint/test:** This is a small single-purpose site. Manual verification is expected.
- **`build.js` deletes `public/` on every run:** Never store anything in `public/` — it's regenerated each deploy.
- **`window.__ENV__` guard:** `initSupabase()` checks that env vars aren't placeholder strings before creating the client.
- **`_delegationAttached` flag:** Event delegation listeners use this boolean on parent elements to prevent duplicate listeners.
- **Admin-only booking:** Public site creates leads (not direct bookings) via inquiry form. Admin creates bookings through dashboard.
- **Status values affect availability:** `leads.status = 'cancelled'` rows are excluded from time slot calculations. Only `deleted` status hides them from the appointments table view.
- **Soft-delete for leads:** `status = 'deleted'` preserves history, does not remove rows.
- **`client_id` vs `client_code`:** SavanaTattoos uses `client_id` on `clients` table (not `client_code` like template). 6-digit code for lookup.
- **`gallery_items` vs `gallery_pairs`:** Tattoo site uses single-image gallery items, not before/after pairs.
