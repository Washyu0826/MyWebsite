# Development Log

This file keeps an append-only record of implementation work, runtime issues, fixes, and verification notes for release/version management.

## 2026-09-16

### Admin File Manager

- Added `/admin/files` for Supabase Storage file management.
- Supported `media` and `resume` buckets.
- Added prefix-based folder browsing.
- Added file upload with `ADMIN_TOKEN` validation.
- Added file deletion with `ADMIN_TOKEN` validation.
- Added public URL links for uploaded files.
- Added responsive admin table and form styles.

Verification:

- `npm run typecheck`
- `npm run lint`
- `NODE_OPTIONS=--use-system-ca` and `DEMO_MODE=true` with `npm run build`
- Confirmed `/admin/files` returned `200`.

### Profile Photo Management

- Added a dedicated profile photo upload form in `/admin/files`.
- Uploaded profile photos to the `media` bucket under `avatar/`.
- Updated `profile.avatar_url` after successful upload.
- Revalidated the `profile` cache tag and `/zh`, `/en`, `/admin/files` paths after update.
- Added homepage rendering for `profile.avatar_url`.
- Added responsive homepage photo layout.

Verification:

- `npm run typecheck`
- `npm run lint`
- `NODE_OPTIONS=--use-system-ca` and `DEMO_MODE=true` with `npm run build`
- Confirmed `/admin/files` and `/zh` returned `200` after restarting the dev server.

### Localhost / Dev Server Notes

- Found that `localhost:3000` failed because the dev server process had exited.
- Restarted `npm run dev`.
- Confirmed `127.0.0.1:3000/admin/files` and `127.0.0.1:3000/zh` returned `200`.
- Noted that Windows may resolve `localhost` through IPv6 `::1`; `127.0.0.1` can be used as a stable local URL.
- Noted repeated Google Fonts fallback warnings in dev mode when network/certificate access is limited.

### Upload Failure: Server Action Body Limit

- Observed runtime upload failure:
  - Browser error: `TypeError: Failed to fetch`
  - Server log: `Body exceeded 1 MB limit`
  - Request result: `POST /admin/files 500`
- Root cause: Next.js Server Actions default request body limit is `1 MB`.
- Fix: configured `experimental.serverActions.bodySizeLimit` to `8mb` in `next.config.ts`, matching the app's upload validation limit.
- Adjustment: increased `experimental.serverActions.bodySizeLimit` to `12mb` so multipart form overhead does not make an 8 MB file fail before app-level validation runs.

Follow-up verification needed after dev server restart:

- Restart `npm run dev`.
- Upload an image larger than `1 MB` and smaller than `8 MB`.
- Confirm profile photo updates on `/zh` and `/en`.

### Local Admin Token Setup

- Found that `.env.local` did not exist.
- Created `.env.local` from the expected environment variable shape.
- Set `ADMIN_TOKEN` for local admin form validation.
- Restarted the dev server so Next.js reloads `.env.local`.

Security note:

- `.env.local` is local-only and should not be committed or shared.
- Supabase upload actions still require `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` before real cloud uploads can succeed.

### Upload Failure: Missing Supabase Credentials

- Observed runtime failure after submitting the profile photo form:
  - Error: `Missing server-side Supabase credentials.`
  - Source: `src/lib/db/admin.ts`
- Root cause: `ADMIN_TOKEN` was configured, but `.env.local` still did not include Supabase credentials.
- Fix: wrapped admin Supabase client creation in file-manager actions so missing credentials return a form-level error message instead of crashing the page.
- Required values for real uploads:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Profile Photo Upload Transport Change

- Observed repeated browser-side `TypeError: Failed to fetch` from `fetchServerAction` during profile photo uploads.
- Root cause: profile photo upload was still using a Server Action, so body-size and dev-server interruption errors surfaced as opaque fetch failures.
- Fix:
  - Added `POST /admin/files/profile-photo` as a Route Handler for profile photo uploads.
  - Changed `ProfilePhotoForm` to submit with a normal client-side `fetch`.
  - Kept form-level JSON errors for invalid token, large file, invalid MIME type, and missing Supabase credentials.
- This avoids the `fetchServerAction` path for profile photo uploads.

### Upload Failure: Missing Storage Bucket

- Observed Supabase upload failure:
  - Error: `Bucket not found`
- Root cause: Supabase credentials were present, but the `media` Storage bucket had not been created in the connected project.
- Fix:
  - Updated `POST /admin/files/profile-photo` to call `getBucket('media')` before upload.
  - If the bucket is missing, the route now creates a public `media` bucket with the expected 8 MB file limit and image MIME type allowlist.
  - Rewrote the route messages in readable Chinese after earlier encoding corruption.

### Upload Failure: Invalid Storage Object Key

- Observed Supabase upload failure:
  - Error: `Invalid key: avatar/profile-photo-...-冼冠宇_兩吋半身證件照電子檔.jpg`
- Root cause: Supabase Storage rejected the object key generated from a non-ASCII original filename.
- Fix:
  - Profile photo uploads now generate ASCII-only object keys and preserve only a safe image extension.
  - General file upload filename sanitization was tightened to ASCII word characters, dots, and hyphens.

### Footer / Brand Name Source

- Observed footer still showing `© 2026 Hsien` after updating Supabase profile data.
- Root cause: footer copyright, site brand, and page metadata titles were hard-coded in `messages/zh.json` and `messages/en.json`, not sourced from Supabase profile fields.
- Fix:
  - Updated Traditional Chinese brand/copyright/title text to `冼冠宇`.
  - Updated English brand/copyright/title text to `Kuan-Yu Hsien`.

### Personal Style Refresh

- User selected the following visual direction:
  - Professional and reliable.
  - Dark gray/black with white text.
  - Logo used as a small top-left brand mark.
  - Prominent profile photo.
  - Keep current homepage content structure.
  - Calm and rational personality.
  - Refined interaction.
  - Project presentation should combine imagery with resume-like information density.
  - Keep current locale setup.
  - Apple-like whitespace.
- Preserved pre-refresh files in `artifacts/version-backups/2026-09-17-pre-personal-style/`.
- Copied `網站LOGO.jpg` to `public/brand-logo.jpg` for stable site usage.
- Updated header, default theme, homepage/project-list styling, color tokens, metadata title, and interaction polish.

### Homepage Order And Social Icons

- Updated homepage order to `Skills -> Experience -> Featured Projects`.
- Added icon links below the `Currently` line:
  - Gmail/email uses `profile.email`.
  - GitHub, LinkedIn, and Instagram use rows in `social_links`.
- Kept missing social links hidden instead of rendering empty icons.
- Updated profile positioning defaults to `Software Engineer`.
- Kept the `Currently` text on one line at desktop widths so `roles` does not wrap alone.
- Rewrote `src/lib/demo/profile.ts` to remove old encoding corruption and include clean demo social links.
- Adjusted hero social icons to show only three links in this order: Gmail, LinkedIn, GitHub.
- Gmail now reads from `profile.email`, with optional fallback to a `social_links` row whose platform is `email` or `gmail`.
- Bumped the profile cache key to `profile-v2` and reduced profile revalidation from 300 seconds to 30 seconds, so direct Supabase SQL edits to profile/social links appear faster.

### Header Logo Transparency Update

- User provided a revised `D:\website\網站LOGO.jpg`.
- Created `public/brand-logo-transparent.png` with transparent corners/background and removed the bottom floor/shadow area.
- Updated only the header logo background image reference from `/brand-logo.jpg` to `/brand-logo-transparent.png`.
- Kept the previous `public/brand-logo.jpg` in place for rollback.

### Homepage Hashtag And Project Label Update

- Changed homepage project section label from `Selected projects` / `精選專案` to `Project`.
- Removed the visible Skills section from the homepage.
- Added five oval hashtag pills in its place:
  - `#SoftwareEngineer`
  - `#Data`
  - `#AI`
  - `#FullStack`
  - `#Cloud`
- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-17-before-hashtag-project-label/`.

### Section Heading Dot Icons

- Added a small black dot icon before the homepage `Experience` and `Project` headings.
- Scoped the styling to `.experience-section` and `.project-section` so other section headings stay unchanged.

### Homepage CTA Copy Update

- Updated the homepage invitation heading in both locale files to `Tangible Outcomes. Powered by Engineering.`.
