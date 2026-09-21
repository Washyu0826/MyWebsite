# Testing and quality tooling

Five layers, each with a job the others cannot do:

| Layer | Runner | Command | What it protects |
| --- | --- | --- | --- |
| Unit | `node:test` via `tsx` | `npm test` | Pure logic: validation, ranking, URL classification, locale picking |
| Component | Vitest + Testing Library + jsdom | `npm run test:components` | Real component behaviour: form validation, keyboard, state |
| End-to-end | Playwright | `npm run test:e2e` | The built site in a real browser, including accessibility (axe) |
| Visual | Playwright screenshots | `npm run test:visual` | Layout regressions across themes and viewports |
| Component gallery | Storybook | `npm run storybook` | Every component state, in isolation, without a database |
| Database | `psql` against a local PostgreSQL | `npm run test:assets:sql` | Migrations, RPC contracts, permissions, concurrency |
| Admin workspace | Playwright against mocked transport | `npm run test:assets:browser` | The asset library UI, TUS uploads, responsive widths, axe |

Plus `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run audit:lighthouse`.

---

## Unit tests — `npm test`

`tsx --test tests/*.test.ts`. No DOM, no browser, no build step; this is the fast path and stays
that way. Nothing here mounts a component.

## Component tests — `npm run test:components`

Vitest with the jsdom environment. Config in `vitest.config.ts`, environment shims in
`vitest.setup.ts` (`ResizeObserver`, `DOMRect`, `matchMedia`, pointer capture, and a storage reset
between tests so a saved contact draft cannot leak into the next case).

`tests/components/harness.tsx` wraps a component in the same providers the app uses —
`NextIntlClientProvider` and next-themes' `ThemeProvider` — and exposes `message(locale, path)` so
assertions quote the real bilingual copy rather than a hard-coded string.

What is covered:

- **Button** — variants, `asChild` slotting, the disabled path, keyboard activation.
- **ThemeSwitch** — the dark default that avoids a post-hydration jump, writing the class onto
  `<html>`, persistence, and that the icon never becomes the accessible name.
- **CopyValue** — clipboard write, the live-region announcement, the return to idle, the visible
  fallback when the clipboard is blocked, keyboard operation.
- **Navigation** — `aria-current` on the right link (home only on an exact match), and the sliding
  indicator: the test hands the component real boxes, because jsdom has no layout engine.
- **CommandPalette** — Ctrl+K toggling, focus, filtering, arrow-key wrapping,
  `aria-activedescendant`, Enter to navigate, locale and theme actions, copy-email keeping the
  dialog open, and the query resetting on reopen.
- **ContactForm** — blur validation clearing on correction, the server rejection summary taking
  focus, the rate-limit and generic branches, the anti-spam time floor, localStorage drafts, and
  tab order.
- **ArticleRevisions** — the empty state, what each revision changed, the line diff against the
  current article (including the screen-reader wording that carries what the colours show),
  collapsing a comparison, the identical-revision and failure branches, and the confirm dialog
  standing between a click and a restore.
- **Asset library** (`asset-http`, `asset-server`) — the HTTP boundary (auth, cross-origin writes,
  bounded JSON, redacted internals) and the publication recovery paths (hash verification, a frozen
  public payload, reusing an uploaded object after a failed commit, revoke then purge).

Two seams are mocked and nothing else: `@/i18n/navigation` (no App Router in jsdom) and the contact
server action (it would reach Supabase and Resend). The action mock still runs the real
`validateContact`, so the validation being asserted is the validation that ships.

## Visual regression — `npm run test:visual`

`tests/browser/visual.spec.ts` screenshots four pages — home, a project, the articles index and
contact — in both themes at 1280×900 and 375×812: sixteen baselines.

Animation is the enemy of a stable screenshot, so each test sets `prefers-reduced-motion: reduce`
(which the components themselves check before animating) **and** passes `animations: 'disabled'` to
`toHaveScreenshot`. The cubist backdrop paints to a canvas whose anti-aliased facet edges are not
bit-stable, so it is masked; `maxDiffPixelRatio: 0.01` absorbs sub-pixel text rendering. The suite
also runs with `retries: 2`, because a machine under load can starve the renderer past a first
paint, and that is a false failure rather than a regression.

After an intentional layout change:

```bash
npm run test:visual:update    # rewrite the baselines
git add tests/browser/visual.spec.ts-snapshots
```

**Baselines are per platform.** Playwright names them `…-win32.png`, `…-linux.png` and so on,
because font rasterisation differs between operating systems. The Windows set is committed. The
Linux set has to come from CI: the first run of the `Visual regression` step reports them missing
and uploads what it captured as the `visual-snapshots` artifact — download it, commit the
`*-linux.png` files, and from then on the step gates strictly.

## Storybook — `npm run storybook`

Storybook 10 on the Next.js (webpack) builder, so `next/image`, `next/font` and the App Router
mocks all behave. `.storybook/preview.tsx` applies the site's providers; the toolbar carries a
**theme** switch (light/dark, via `@storybook/addon-themes`) and a **language** switch (中文/English)
that drives both the client provider and the server-side translation mock.
`.storybook/preview-head.html` loads Inter, Noto Sans TC and JetBrains Mono from Google Fonts and
binds them to the same CSS variables `next/font` sets in the app.

**No story touches a database.** Two modules are swapped in `.storybook/main.ts`:

- `next-intl/server` → `.storybook/mocks/next-intl-server.ts`, which reads `messages/*.json`
  directly and follows the toolbar locale.
- the contact server action → `.storybook/mocks/contact-actions.ts`, which returns whichever
  outcome the story asked for.

`ProjectList` and `ArticleList` are async Server Components, which cannot be mounted in a browser.
`.storybook/rsc.tsx` calls them as the plain functions they are and resolves the returned element
through React 19's `use()` inside a Suspense boundary.

Stories: Button (7), ThemeSwitch (3), CopyValue (3), CommandPalette (4), ProjectList (5),
ArticleList (4), ContactForm (7) — 33 in total.

## Database — `npm run test:assets:sql`

`scripts/test-assets-sql.mjs` applies every `supabase/migrations/20260920*` file **twice** to a
throwaway local database, then runs `tests/sql/asset-library.test.sql` and
`tests/sql/post-revisions.test.sql` inside a transaction that is rolled back. It asserts what only a
real Postgres can: that the migrations are repeatable, that `anon` and `authenticated` hold no
privileges on the tables or the `security definer` functions, that quota accounting and reservation
expiry add up, that retries are idempotent, that the profile compare-and-set refuses a stale publish,
and — over two genuinely concurrent connections — that simultaneous writers produce one version.

It never touches Supabase. The database name is fixed to `asset_library_test` on `127.0.0.1:55432`
and the script refuses to run anywhere else; it drops and recreates the schemas on every run, so the
assertions start from an empty database. `PSQL_BINARY` and `ASSET_TEST_PG_PORT` override the defaults.

## Admin workspace — `npm run test:assets:browser`

`tests/assets-browser.mjs` bundles the real `AssetWorkspace` and `AssetPicker` components with the
app's own CSS and drives them in Chrome against a local mock of the admin API and of Supabase's
resumable upload endpoint. It covers 320–1920px without horizontal overflow, axe on both the
workspace and the picker dialog, a decoded preview image, pagination, rename, trash and restore,
where a published file is used, a publish retry reusing its operation id, revoking an unreferenced
copy, and a 7 MiB file arriving in two TUS chunks rather than through the admin API. No login, no
Supabase credentials, no writes to production. Screenshots land in `artifacts/asset-library/`.

## Lighthouse — `npm run audit:lighthouse`

`scripts/lighthouse-ci.mjs` drives the `lighthouse` package (already a dependency) against a running
production server and fails if performance, accessibility, best practices or SEO falls below 90.
Override with `LIGHTHOUSE_MIN_SCORE`. HTML and JSON reports land in `artifacts/lighthouse/`.

`@lhci/cli` was deliberately not used: it pulls in a puppeteer tree that currently carries sixteen
advisories, for no capability this needs.

### The SEO score in demo mode

`src/lib/metadata.ts` sets `robots: { index: false, follow: false }` whenever `DEMO_MODE` is on,
which is exactly what Lighthouse's `is-crawlable` audit exists to flag. Gating CI on a deliberate
choice would be noise, so in demo mode the script passes `skipAudits: ['is-crawlable']`; Lighthouse
re-weights the remaining SEO audits, and the run prints a line saying the audit was excluded. With
`DEMO_MODE` unset — a build against real content — the audit is scored normally and the 90 floor
applies to it too.

## Formatting, linting and hooks

- **Prettier** — `.prettierrc`: single quotes, no arrow parens, 140 columns, trailing commas, LF.
- **ESLint** — `next/core-web-vitals` and `next/typescript`, plus the full `jsx-a11y` recommended
  set, `react-hooks` at error, the Storybook rules, and stricter TypeScript rules
  (`consistent-type-imports`, unused values, no enums, `eqeqeq`, `object-shorthand`).
  `eslint-config-prettier` runs last.
- **husky + lint-staged** — `.husky/pre-commit` runs `lint-staged`, which formats and `eslint --fix`es
  only the staged files. Typecheck and the test suites stay in CI so a commit is not slow.

### Two carve-outs, both temporary

**Prettier does not yet cover `src/`, `messages/`, `docs/` or the original `tests/*.test.ts`.**
Those files predate Prettier and are hand-formatted — dense one-liners, multi-declarator `const`,
160-column JSX. Running Prettier over them rewrites about 130 files, which belongs in its own
mechanical commit rather than inside feature work. The list is at the bottom of `.prettierignore`;
delete that block after running:

```bash
npx prettier --write . --ignore-path /dev/null
```

**Four React Compiler rules run as warnings, not errors.** Installing `eslint-plugin-react-hooks` v7
upgrades `react-hooks/*` from the two classic rules to the full React Compiler diagnostics. Sixteen
pre-existing patterns trip them, so `set-state-in-effect`, `immutability`, `refs` and `purity` are
set to `warn` in `eslint.config.mjs` until those components are rewritten — every other v7 rule is
an error. Current findings:

| Rule | Where |
| --- | --- |
| `set-state-in-effect` | `contact-form.tsx` ×2, `command-palette.tsx` ×3, `cover-preview.tsx`, `image-lightbox.tsx`, `theme-switch.tsx`, `admin/articles/article-form.tsx`, `admin/projects/project-form.tsx` |
| `refs` | `mobile-menu.tsx`, `image-lightbox.tsx`, `admin/unsaved-changes.tsx` |
| `immutability` | `letter-reveal.tsx`, `reveal.tsx` |
| `purity` | `[locale]/contact/page.tsx`, `admin/articles/[id]/page.tsx` |

Three accessibility findings are also warnings rather than errors, for the same reason —
`jsx-a11y/anchor-is-valid` in `markdown.tsx`, and `click-events-have-key-events` plus
`interactive-supports-focus` on the command palette's `role="option"` rows. The palette is keyboard
operable through its combobox, but the rows themselves should carry the listener the rule asks for.

## TypeScript strictness

Enabled in `tsconfig.json` on top of `strict`:

| Option | Why it was safe |
| --- | --- |
| `noImplicitOverride` | No errors in the codebase |
| `noImplicitReturns` | No errors |
| `noFallthroughCasesInSwitch` | No errors |
| `allowUnreachableCode: false` | No errors |
| `noUnusedLocals` / `noUnusedParameters` | No errors |

Deferred, with the error count each one produces today:

| Option | Errors | Why it is off |
| --- | --- | --- |
| `noUncheckedIndexedAccess` | 98 | Concentrated in `cubist-backdrop.tsx` (25), `images.ts` (21), `image-lightbox.tsx` (15) — geometry code that indexes arrays in tight loops. Worth doing, but it is a real refactor of files owned elsewhere. |
| `noPropertyAccessFromIndexSignature` | 125 | Almost all of it is `process.env.FOO`, which this option forces to `process.env['FOO']`. High churn, low value. |
| `exactOptionalPropertyTypes` | 14 | Spread across twelve files, mostly `Metadata` objects and optional props passed as `undefined`. The smallest of the three and the next one to take on. |

## Error monitoring (Sentry)

Completely opt-in. With `NEXT_PUBLIC_SENTRY_DSN` unset:

- `next.config.ts` skips `withSentryConfig` entirely — no tunnel route, no upload step, no
  instrumentation injected into the build;
- `instrumentation.ts`, `instrumentation-client.ts` and `global-error.tsx` import `@sentry/nextjs`
  **dynamically** behind a DSN check, so the bundler drops the chunk and the browser never fetches
  it.

Local development and the demo build are therefore byte-for-byte unaffected.

Files: `sentry.client.config.ts` (init, called from `instrumentation-client.ts` so it also works
under Turbopack, which no longer picks the legacy filename up), `sentry.server.config.ts`,
`sentry.edge.config.ts`, `instrumentation.ts` (runtime dispatch plus `onRequestError`), and
`src/app/global-error.tsx`.

Reports go through `tunnelRoute: '/monitoring'` so ad blockers, which recognise the Sentry ingest
domain, do not silently swallow them. Server events drop `request.data` before sending: contact
submissions carry names, addresses and message bodies, none of which belong in a crash report.

### Environment variables

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | build + runtime | no | The master switch. Unset means Sentry does not exist. |
| `SENTRY_ORG` | build | with a DSN | Sentry organisation slug, for source map upload. |
| `SENTRY_PROJECT` | build | with a DSN | Sentry project slug. |
| `SENTRY_AUTH_TOKEN` | build only | no | Gates source map upload. Without it the build still succeeds; stack traces just stay minified. Never expose it to the client. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | client | no | Defaults to `NODE_ENV`. |
| `SENTRY_ENVIRONMENT` | server/edge | no | Defaults to `NODE_ENV`. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | client | no | Defaults to `0.1`. |
| `SENTRY_TRACES_SAMPLE_RATE` | server/edge | no | Defaults to `0.1`. |

On Vercel, set `SENTRY_AUTH_TOKEN` as a build-time secret only.

## CI

`.github/workflows/ci.yml` runs two jobs in parallel.

**checks** — typecheck, lint, format check, unit tests, component tests, Storybook build.

**browser** — production build (demo content), Playwright end-to-end, visual regression, then
Lighthouse against a started production server.

Reports upload as artifacts only on failure: `playwright-report`, `visual-snapshots`,
`lighthouse-reports`, `storybook-static`.

## The lockfile targets npm 10

`package-lock.json` is generated by **npm 10**, which is what Node 22 ships and what Vercel and CI
run. `packageManager` in `package.json` records that.

Installing with npm 11 rewrites the lockfile and drops transitive entries that npm 10 still expects
(`@emnapi/runtime`, `@emnapi/core`, `quickjs-wasi`, `@swc/helpers`). The tree installs fine on the
machine that wrote it, and then `npm ci` on CI refuses it with "can only install packages when your
package.json and package-lock.json are in sync". That is exactly how CI runs 1 through 5 failed,
each inside fifteen seconds.

So after adding or upgrading a dependency with a newer npm, regenerate the lockfile with npm 10:

```bash
npx npm@10.9.4 install --package-lock-only
```

and commit the result. `npm ci` then works under both majors. To check before pushing:

```bash
rm -rf node_modules && npx npm@10.9.4 ci
```

## The service worker version is automatic

`public/sw.js` names its caches after a version that arrives in its own registration URL, which
`next.config.ts` fills from `VERCEL_GIT_COMMIT_SHA` on Vercel and from the build time locally. A
deploy therefore changes the script URL, the browser fetches the worker again, and `activate`
deletes every cache that is not on the current list.

Nothing has to be edited before shipping. Verified by building twice under different commit SHAs in
one browser profile: the second build's worker took over and the first build's three caches were
gone.

The consequence of getting this wrong is worse than it sounds: a returning visitor holds the old
shell, and reloading does not help them, because the worker answers before the network. Only
clearing site data would, and nobody does that.

## The background music is verified against the published files, on request

`tests/audio.test.ts` covers the toggle's contract without a browser: only `'on'` counts as an
opt-in, the three copies of the storage key agree, exactly two events may ask for a chime, nothing is
downloaded and no `AudioContext` is opened before the visitor presses the button, and the music is
never ramped up to anything but `MUSIC_GAIN`.

One test in that file is skipped by default:

```bash
AUDIO_VERIFY=1 npm test
```

It fetches both published encodes from Supabase Storage, checks their content types and sizes, and
runs `ffmpeg -af ebur128` over the Opus file to confirm the integrated loudness, loudness range and
true peak still match what `TRACK` in `src/lib/audio/track.ts` claims. `MUSIC_GAIN` is calibrated
against that peak, so if the file is re-encoded or replaced and the constant is not updated, the
music plays at the wrong level and nothing else would catch it.

It is off by default because it downloads five minutes of audio and shells out to `ffmpeg`, which is
too slow for a pre-commit run and would make the suite depend on the network. Run it after any
re-encode or re-upload. `docs/background-music.md` has the encode chain.
