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

### Article Publishing Feature And Responsive Homepage Tweaks

- Added public article routes:
  - `/zh/articles` and `/en/articles`
  - `/zh/articles/[slug]` and `/en/articles/[slug]`
- Added `Articles` to the main navigation.
- Wired public article pages to the existing Supabase `posts` table, showing only published articles whose `published_at` is not in the future.
- Integrated the existing admin article workflow:
  - `/admin/articles`
  - `/admin/articles/new`
  - `/admin/articles/[id]`
- Article admin supports Markdown content, draft/published/scheduled/archived status, tags, cover image URL, excerpts, reading minutes, and delete confirmation.
- Cleaned article server actions to use the logged-in admin session and revalidate public article pages after changes.
- Moved homepage focus keywords under the Gmail/LinkedIn/GitHub icons.
- Changed homepage focus keywords from boxed `#Hashtag` pills to small-dot keyword items.
- Changed the homepage `Experience` heading to use the previous oval pill visual style.
- Kept `Project` with the small-dot heading style.
- Relaxed forced no-wrap styling in the hero status line so narrow screens can wrap cleanly instead of overflowing.

### Signature Frontend Design Pass

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-signature-design/`.
- Added a compact homepage `Design principles` strip below the social links:
  - `Clarity over decoration`
  - `Systems before surfaces`
  - `Useful motion only`
- Changed the English navigation label from `Articles` to `Notes` and the article index title to `Engineering Notes`.
- Upgraded project rows from a simple portfolio list into a compact engineering case-study preview:
  - `Problem`
  - `System`
  - `Outcome`
- Added responsive styling for the new project signal grid so it stacks on mobile and becomes three columns on wider screens.
- Refined nav underline spacing and project hover details to make the site feel more custom without adding decorative clutter.

### Continuous Stroke Logo Revision

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-logo-continuous-stroke/`.
- Reworked the header brand SVG from separated strokes into one continuous stroke.
- Synced the same continuous mark to `public/brand-logo.svg` and Open Graph cards.

### Original Logo Cutout Update

- Used `D:\website\網站LOGO.jpg` as the source logo image.
- Generated a transparent-background logo cutout at `public/brand-logo-cutout.png`.
- Generated a smaller header-optimized transparent PNG at `public/brand-logo-header.png`.
- Updated the header `BrandMark` component to use the original-logo PNG instead of the hand-drawn SVG approximation.

### Homepage Section Heading Style Sync

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-section-heading-pill-sync/`.
- Updated `Project` to use the same oval pill heading style as `Experience`.
- Increased `Experience` heading text back to the same large heading scale as `Project`.
- Removed the small dot icon from `Project`.

### Section Heading Redesign

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-section-heading-redesign/`.
- Replaced the oval pill section headings with a more intentional index-heading system:
  - circular section number
  - large section title
  - horizontal rule extending across the row
- Kept the `All projects` link responsive: below the heading on narrow screens and aligned right on wider screens.
- Adjusted the desktop `Project` heading grid so it keeps the same number/title/rule structure as `Experience`, with `All projects` sitting to the far right instead of replacing the rule.

### Homepage Research Section

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-research-section/`.
- Added a third indexed homepage section: `03 Research`.
- Added localized empty-state copy for research content in `messages/en.json` and `messages/zh.json`.
- Extended the shared section-heading design to `research-section`.

## 2026-09-18

### Site Audit And Infrastructure Fixes

Full-site audit covering security, database, unfinished features, admin tooling and engineering hygiene. Decisions recorded from the user:

- Replace `ADMIN_TOKEN` with Supabase Auth login at `/admin/login`, restricted to the `ADMIN_EMAIL` allowlist.
- No SVG uploads; the `media` bucket MIME allowlist is PNG / JPEG / WebP / GIF only.
- `public/resumes/*.pdf` stay as intentionally public static files; original assets live outside the repo in `D:\website-assets`.
- Analytics via Vercel Analytics (no env var); translation drafts via Claude API (`ANTHROPIC_API_KEY`); `GOOGLE_TRANSLATE_API_KEY` and `NEXT_PUBLIC_GA_ID` removed.
- Scheduled publishing via `GET /api/cron/publish` with `CRON_SECRET`, hourly in `vercel.json` (daily on Vercel Hobby).

Infrastructure changes:

- Split the root `supabase-schema.sql` into idempotent Supabase CLI migrations: `supabase/migrations/20260918000000_init.sql` (schema, RLS, buckets, `publish_due_content()`) and `20260918000100_contact_rate_limit_fn.sql` (`contact_rate_limit_hit(p_ip_hash, p_limit, p_window)`, `security definer`, service_role only). Removed the root schema and the stale `docs/supabase-schema.sql`. Added a minimal `supabase/config.toml`.
- Moved the development-only profile / social_links seed out of the schema and into `supabase/seed.sql` (`where not exists` guards) so re-running migrations never overwrites real profile data.
- `src/lib/db/config.ts`: `DEMO_MODE=true` is ignored on production deployments (`VERCEL_ENV=production`, or `NODE_ENV=production` with `NEXT_PUBLIC_SUPABASE_URL`) with a single `console.warn`.
- `src/app/api/cron/publish/route.ts`: Bearer check, RPC call, `revalidateTag` for `posts` / `projects` and per-slug tags.
- `next.config.ts`: clear error when `NEXT_PUBLIC_SUPABASE_URL` is not a URL; added `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Permissions-Policy`.
- `.env.example` rewritten with comments for the new variable set.
- Tests: unit test for the `DEMO_MODE` guard (runs `config.ts` in a child process under the `react-server` condition); Playwright theme matrix now selects light mode through the theme `<select>` because the default theme is fixed to dark; new e2e cases for articles pages, admin login redirect, `/resume/xx.pdf` 404 and the contact form. `playwright.config.ts` uses bundled Chromium when `CI` is set.
- `.github/workflows/ci.yml`: typecheck, lint, unit tests, demo build, Playwright Chromium, report upload on failure, cancel-in-progress concurrency.
- `scripts/audit-site.mjs`: `SITE_URL` override defaulting to `127.0.0.1`, random remote-debugging port, null-safe Lighthouse scores.
- README and `docs/implementation-status.md` rewritten for the end state; verification items marked pending re-run.

Verification:

- `npx tsx --test tests/content.test.ts`: 5 passed.
- `npx tsc --noEmit` and `npx eslint` on the owned files: see implementation-status for the post-merge re-run.
- Migration SQL reviewed by hand for idempotency; not yet applied to a live database.

### Contact List Redesign

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-18-before-contact-list-redesign/`.
- Reworked the Contact page list so Email uses the same visual scale as the other contact rows.
- Added icon-led rows for `Country / Region`, `Phone`, `LineID`, `IG`, `LinkedIn`, and `GitHub`.
- Added reusable copy-button behavior through `CopyValue`, with copy actions for Email, Phone, LineID, IG, LinkedIn, and GitHub.
- Kept `Country / Region` as display-only text: `Taiwan, Taipei, Da'an Dist`.
- Added responsive contact-list CSS so labels, values, and copy buttons stack cleanly on mobile and align in columns on wider screens.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Local page check confirmed the new Contact fields render at `/en/contact`.

## 2026-09-19

### Homepage Wide Layout

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-19-before-home-wide-layout/`.
- Added a homepage-only `home-container` class so the landing page can use more horizontal space on large screens.
- Kept the default `.container` width unchanged for content-heavy pages like Contact, Notes, Projects, and admin screens.
- Increased the homepage desktop hero column gap fluidly and allowed the profile photo to scale up to `480px` on wider screens.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Homepage Email Compose Link

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-19-before-home-email-compose/`.
- Added `gmailComposeUrl()` so homepage Email/Gmail icon can open Gmail compose with the recipient prefilled.
- Updated the homepage social Email icon to use Gmail compose instead of relying only on the browser's `mailto:` handler.
- Kept other email links on the site as `mailto:` for now.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Local HTML check could not run because `127.0.0.1:3000` was not responding.

## 2026-09-20

### Homepage Full-Width Layout

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-home-full-width/`.
- Removed the homepage-only `1560px` max-width so the landing page now uses the full viewport width.
- Kept responsive side padding through viewport-based clamps instead of centering the entire page in a fixed-width block.
- Expanded the desktop hero grid and portrait sizing at `1280px+` and `1680px+` breakpoints so large screens feel intentionally filled.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Edge-Aligned Header And Footer

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-edge-aligned-shell/`.
- Removed the fixed content max-width from `header-inner` and `footer-inner` so shell navigation uses the full viewport width.
- Kept the main `.container` behavior unchanged for readable page content.
- Right-aligned the footer note/copyright group while keeping social/contact links on the left.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Homepage Positioning Copy

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-home-positioning-copy/`.
- Changed the homepage tagline to `Curiosity driven, clarity obsessed.`.
- Reframed the three homepage principles as a personal user manual:
  - `Why before How`
  - `Radically Candid`
  - `Embrace the Iteration`
- Synced the development Supabase seed profile bio with the new tagline.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Move Portrait To Contact

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-20-before-moving-photo-to-contact/`.
- Removed the profile portrait from the homepage hero.
- Added the portrait to the Contact page intro, paired with the contact opening copy.
- Added responsive styling so the portrait stacks below the intro on mobile and aligns right on wider screens.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.

### Homepage Cubist Backdrop

- Preserved a rollback snapshot in `artifacts/version-backups/2026-09-19-before-cubist-backdrop/`.
- Added `CubistBackdrop`, a client canvas behind the homepage hero in the spirit of analytic cubism: the canvas is fractured into interlocking facets by seeded line cuts, painted in earth pigments (ochre, umber, prussian, oxblood, olive, gold) with hatching, guide lines and arcs.
- The composition breathes slowly (per-facet scale, rotation, light sweep) and shifts with the pointer by depth; it is static under `prefers-reduced-motion`, pauses off-screen and when the tab is hidden, and re-renders on theme change.
- The seed is fixed so every visit shows the same composition; pigment is weighted toward the portrait side and faded toward the copy column and the sections below so text stays readable.
- Added a paper-grain overlay and a gold offset frame plus skewed back facet behind the hero portrait so it reads as one plane of the composition.
- `Reveal` now clears its inline `clip-path` once the intro finishes so decoration that overhangs a revealed box is not clipped.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Playwright screenshots (Edge channel) of `/en` at 1600px light and dark and 390px dark confirmed the backdrop renders, the portrait frame shows, and hero copy stays readable.

### File Management Extension Research (2026-09-20)

- Added [the extension research report](file-management-extension-research.md) for a single-admin content and asset library with public visitor access only to published content.
- Reviewed the existing upload, deletion, profile-photo, resume, article, authentication, Storage schema, and publishing flows against the prior 11-page file-management presentation.
- The requested legacy source directory was not present. The available reference was `檔案管理系統-垃圾桶.pdf`; its incomplete architecture sections are documented as proposals, not verified working legacy code.
- Compared Supabase Free and Cloudflare R2 using official pricing and platform documentation, including Vercel upload and cron limits.
- Proposed direct uploads, private originals, explicit publication, asset references, recoverable deletion, versions, sharing, audit events, capacity controls, and separate database/object backups.
- Included staged migration, rollback constraints, a file-level implementation map, and acceptance criteria. No application code, database, or deployment was changed by this research task.

Verification:

- Extracted all PDF page text and inspected rendered architecture/schema pages 5, 7, 9, and 10.
- Cross-checked the findings against local source and official provider documentation.
- Application tests were not run for this documentation-only task; proposed integration and deployment checks are listed in the report.

### Advanced File Management Architecture Research (2026-09-20)

- Extended the research report with sections 17-19: release snapshots, durable jobs and recovery, deduplication, document search, draft conflicts, observability, and backup/fault drills.
- Defined demo scenarios and acceptance criteria for each proposal, plus dependencies and recommended implementation order.
- Clarified queue delivery versus idempotent effects, worker scheduling and resource limits, private search filtering, and database versus CDN publication consistency.
- Cross-checked Supabase Queues/Cron, Postgres search and transaction documentation, and Next.js 15 OpenTelemetry guidance.
- This continuation only updates research documentation; no feature implementation, infrastructure changes, or deployment. Application tests were not run.

### Asset Library Phase 1 Verified And Continued (2026-09-20)

Picked up the asset library where the previous session (Codex) stopped after its rate limit. What was already on disk: `src/lib/assets/*`, `/api/admin/assets`, the `AssetWorkspace` / `AssetUpload` components, migrations `20260920000100_asset_library.sql` and `20260920000200_media_dimensions.sql`, SQL / component / browser tests and `docs/asset-library-setup.md`.

State found and fixed:

- `tests/components/asset-server.test.tsx` did not typecheck (`ReturnType<typeof vi.fn>` mocks are not callable under Vitest 5); typed the `rpc` / `upload` / `download` mocks explicitly.
- `scripts/test-assets-sql.mjs` only passed on a fresh database: leftover rows from a previous run broke the usage assertions. The runner now drops and recreates the `public` / `auth` / `storage` schemas of `asset_library_test` before every run.
- Another Claude Code session was working in the same tree at the time (accessibility / typography verification, `zz-*` probes, `.typo-check/`). Those files were left alone.

New in this session (snapshot in `artifacts/version-backups/2026-09-20-before-asset-references/`):

- `supabase/migrations/20260920000300_asset_references.sql`: `asset_references(actor, asset)` reports where each completed public copy is used (profile avatar / resume slots, project cover / architecture / Markdown bodies, gallery rows, article cover / bodies). `asset_change('trash')` now raises `ASSET_REFERENCED` only while such a reference exists; published-but-unreferenced assets can be recycled (public objects are never deleted). `asset_library_usage()` stops counting a pending upload / publication reservation 24 hours after it was signed, so cancelled or abandoned uploads no longer occupy the budget forever.
- Server: asset detail includes `references`; new `view=published` listing for the editors; `ASSET_REFERENCED` error copy; setup-required message now points at all `20260920*` asset migrations.
- UI: the inspector shows a 使用位置 section with links to the admin page that uses the file, and the trash button follows the reference rule. New `AssetPicker` dialog (`src/components/admin/asset-picker.tsx`) lets the project URL fields and the article cover field pick an already published file; images offer one-click Markdown copy for bodies.
- Tests: SQL fixture gains minimal `posts` / `projects` / `project_media`; the SQL test covers references, owner scoping, the relaxed trash rule and lapsing reservations; all three asset migrations are applied twice for repeatability. The browser test asserts the reference list after publishing and exercises the picker (open, axe, search, select, 390px, Escape). `docs/asset-library-setup.md` updated accordingly.

Not done here: the production Supabase migrations are still not applied (needs the owner's decision and a backup first), no end-to-end run against real Storage, and no commit was made because the working tree also holds other sessions' unfinished work.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 16 pre-existing warnings (documented in `docs/testing.md`).
- `npm test`: 73 passed.
- `npx vitest run tests/components/asset-http.test.tsx tests/components/asset-server.test.tsx`: 10 passed.
- `node scripts/test-assets-sql.mjs` (local PostgreSQL 18 on 127.0.0.1:55432): passed, including the new reference and reservation assertions.
- `node tests/assets-browser.mjs` (Chrome): passed, including the reference list and picker scenarios; screenshots in `artifacts/asset-library/`.
- `npx prettier --check` on the touched test files: passed.

### Asset Library: Revoke Public Copies (2026-09-20)

- `supabase/migrations/20260920000400_asset_revoke.sql`: publications gain a `revoked` status plus `revoked_at` / `purged_at`. `asset_revoke_publication()` refuses while the copy is still referenced (`ASSET_REFERENCED`), refuses pending publications (`PUBLICATION_PENDING`), is owner scoped and idempotent, and writes a `publish.revoked` event; `asset_publication_purged()` records the confirmed object removal.
- Server `revokePublication()` works in two steps on purpose: the row flips to `revoked` first (listings, the picker and the reference scan ignore it immediately), then the public object is removed from Storage and its `image_metadata` row dropped; if removal fails the row keeps `PURGE_RETRY_NEEDED` and the same action retries the purge. Private originals and versions are untouched. The asset list's 有公開副本 flag now counts only completed copies.
- UI: each row under 公開紀錄 has a 撤銷公開 action (disabled with an explanation while referenced, confirm dialog, retry state when the object removal is still pending).
- Committed as its own commit; the Vitest component tests for the library (`tests/components/asset-*.test.tsx`) stay uncommitted until the Vitest tooling from the frontend session lands, because the root tsconfig compiles them.

Verification:

- `npx tsc --noEmit`: passed. ESLint on the touched files: no errors.
- `node scripts/test-assets-sql.mjs`: passed (four migrations applied twice; revoke blocked while referenced, idempotent revoke, purge, pending refusal).
- `npx vitest run tests/components/asset-http.test.tsx tests/components/asset-server.test.tsx`: 11 passed, including Storage removal failure followed by a successful retry.
- `node tests/assets-browser.mjs`: passed, including the revoke flow on an unreferenced copy and the protected state on a referenced one.
- The previous commit (`fac8958`) was also verified on its own in a detached worktree: typecheck, 58 unit tests, SQL and browser suites all passed.

### Article Revisions And Restore (2026-09-20)

Every successful article save now keeps the content that was stored, so a bad edit can be compared and undone.

- `supabase/migrations/20260920000500_post_revisions.sql`: `post_revisions` (post, revision number, jsonb snapshot, actor, reason, created_at) with RLS and service-role-only access, plus `post_save_revision()` which takes the next revision under a row lock and returns the existing latest row when the snapshot is identical, so pressing save twice does not fill the history with copies.
- `src/lib/diff.ts`: a dependency-free line diff (LCS over lines) with per-side line numbers, a fallback for very large texts, unchanged-run collapsing, and a snapshot comparison that reports only the editable fields that differ. Pure, so it runs in `tsx --test` and in the browser.
- `saveArticleAction` stores the pre-edit content first for articles that predate the table, then the newly stored content. `restoreRevisionAction` writes a revision back, forces the article to draft, keeps the live slug when the old one is taken by another article, and records the restore, so a restore can itself be undone. A history write never fails a save the database already accepted.
- The edit page gains a 修訂紀錄 panel: what each revision changed, a line diff against the current article, and a restore behind a confirm dialog. The editor remounts on `updated_at` so it shows the restored content.
- `asset_references()` now also reports retained article revisions, as a **soft** reference: it does not block recycling or revoking, because no live page depends on it, but the asset inspector lists it as a warning, since restoring that revision afterwards would point at a removed file. Trash and revoke were updated to ignore soft references explicitly.
- Fixed while here: `tests/assets-browser.mjs` read the preview image's `naturalWidth` once, which is a race on a loaded machine; it now polls.

Documentation: `docs/article-revisions.md`; `docs/testing.md` gained the database and admin-workspace layers it was missing.

Verification:

- `npx tsc --noEmit`: passed. ESLint on the touched files: 0 errors, 2 pre-existing warnings.
- `npm test`: passed, including 14 new diff tests.
- `npx vitest run`: 9 files, 65 tests passed, including 8 new `ArticleRevisions` tests.
- `node scripts/test-assets-sql.mjs`: passed, with five migrations applied twice and a new revisions suite (numbering, deduplicated snapshots, key-order independence, input validation, permissions, cascade, soft references not blocking recycling).
- `node tests/assets-browser.mjs`: passed.
- Not applied to production Supabase; not deployed.

### Time-Limited Share Links (2026-09-20)

A private version can now be handed to someone without an account, through a link that expires on its own and can be revoked.

- `supabase/migrations/20260920000600_asset_shares.sql`: `asset_shares` stores only the **SHA-256 of the token**, so neither a leaked table nor the server itself can reconstruct a working link; the plaintext exists once, in the reply that creates it. Plus `asset_create_share()` (ready version, live asset, expiry between a minute and 30 days, at most 20 live links per asset), the read-only `asset_peek_share()` for the landing page, `asset_redeem_share()` which increments the counter in the same statement that re-checks the cap, and `asset_revoke_share()`.
- Public surface: `/{locale}/share/{token}` shows the file name, size, expiry and open count, and `…/download` redeems. **Redeeming is POST, not GET**, because mail providers follow links in messages to scan them and would otherwise spend an open; the landing page itself only peeks. Redeeming returns a 60-second signed URL, so revocation stops new opens but cannot recall a URL handed out moments earlier — stated plainly in the docs and on the page.
- Admin: a 限時分享連結 panel on a ready version. It shows the URL once with a warning that it will not be shown again, then lists every link with its state, expiry, open count and last open, with revoke behind a confirm dialog.
- `asset_shares` is read through a `.catch(() => [])` in the asset detail, so an asset still opens before the migration is applied.

Documentation: `docs/asset-share-links.md`, including the limits this design does not claim to cover (no password, no identity, open count is not proof of a completed download).

Verification:

- `npx tsc --noEmit` and ESLint on the touched files: clean.
- `npm test`: passed, including new cases for the token shape (50 generated tokens against the accepted pattern) and for expiry, cap and label validation.
- `node scripts/test-assets-sql.mjs`: passed, with six migrations applied twice and a new share suite (permissions, hash format, expiry bounds, unverified version, non-owner, peek not spending an open, redeem counting, cap, idempotent revoke, expiry, trashed asset, 20-link ceiling).
- `node tests/assets-browser.mjs`: passed, including creating a link, the one-time reveal, the list and revoking.
- `npm run build`: passed, so the new public route and route handler compile and prerender.
- Not applied to production Supabase; not deployed.
