# V1 welcome / landing page

## Scope and history

Local feature branch `feat/v1-landing-page` is based on fetched `develop` commit
`87f3199`, including merged performance PR #2. Earlier phase/performance commits
are preserved. This work does not change authentication credentials, environment
files, backend behavior, database data/schema, or the authenticated workspace design.
The product's landing page uses scoped black/white and neutral-gray styling.

## Implementation

Signed-out users now see a complete public welcome page: product mark/name,
Features/Your workspace navigation, the hero “Less chaos. More progress.”,
introduction, clearly labeled illustrative dashboard, three feature articles covering
courses, assignments, exams/finals, deadlines/calendar, a closing action and footer.
The preview contains fixed sample coursework only; it never queries or displays
account data. Its decorative controls are not misleading interactive buttons.
No images, external fonts, icon packages, new runtime dependencies, or trackers
were added.

`ProtectedRoute` still waits for session restoration first. An authenticated session
renders the existing `ConnectedWorkspace` directly, including protected deep links.
Only its signed-out branch has changed. All three entry buttons (Sign in, Get started,
Start planning) invoke the same existing `auth.signIn` action. Google OAuth/PKCE,
redirectTo, URL session detection, refresh and logout code remain unchanged.
The welcome page prevents duplicate sign-in attempts, disables start actions while
connecting, and exposes loading/errors accessibly. Missing setup has a neutral
public-facing error, rather than displaying environment variable implementation details.

Welcome navigation scrolls and focuses page sections without changing the URL.
The skip link also preserves the URL. This avoids consuming existing protected
hash routes or OAuth query parameters. Keyboard users can Tab to the skip link,
press Enter to focus main, or use the native navigation buttons to focus a section.
There is no new router or callback endpoint.

## Design and accessibility

- System typography, generous spacing, monochrome CTAs, thin borders and restrained
  shadows. Styles are scoped under `.welcome` so workspace colors/components remain intact.
- Desktop/tablet/mobile breakpoints adapt the header, preview and feature grid without
  horizontal page overflow. The illustrative sidebar/course panel simplifies at narrow widths.
- Short entrance and hover transitions; CSS disables animations/transitions for
  prefers-reduced-motion. Section navigation uses instant scrolling for that preference.
- Native buttons and links, visible focus outlines, main/section headings, a skip link,
  status/error announcements, an accessible preview caption and no preview tab stops.
- Initial browser auditing found insufficient contrast in some small preview labels.
  Those grays were darkened, and the audit was rerun successfully.

## Internationalization preparation

`src/i18n/landing.en.ts` centralizes welcome copy and sample-preview labels separately
from layout and data APIs. `src/i18n/locales.ts` defines `en`, `ar`, `zh` metadata and
LTR/RTL directions, with **English as the sole enabled locale**. The wrapper declares
the enabled language/direction; CSS favors logical spacing/alignment properties.
No unfinished language selector or untranslated Arabic/Chinese view is exposed.
Reviewed translations, locale selection, direction/font review, document metadata,
workspace/auth message localization and locale-specific QA are future work.

## Changed files

- `frontend/src/features/landing/LandingPage.tsx`: welcome content, decorative preview,
  navigation/focus behavior and sign-in feedback.
- `frontend/src/features/landing/landing.css`: isolated responsive/neutral/reduced-motion styles.
- `frontend/src/i18n/landing.en.ts`: English copy and illustrative sample data.
- `frontend/src/i18n/locales.ts`: future locale/direction metadata, English enabled.
- `frontend/src/features/auth/AuthProvider.tsx`: signed-out route returns the landing page.
  Auth implementation remains unchanged.
- `frontend/tests/LandingPage.test.tsx`: content, safe preview, navigation, callback/deep-link
  URL preservation, reduced motion, all three sign-in actions, duplicate/loading/error states.
- `frontend/tests/IntegratedApp.test.tsx`: updated signed-out assertions and explicit
  restored-session/deep-link bypass regression; existing integration tests retained.
- `README.md`, `docs/live-supabase-setup.md`, and this document: feature/setup/validation references and updated sign-in button labels.

## Run and automated validation

Use the existing public frontend configuration and normal development command:

```sh
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Missing Supabase configuration still permits viewing public content; sign-in actions
are disabled with a readable error. Existing configured accounts work through the
normal sign-in flow. The explicit `VITE_DEMO_MODE=true` development workspace remains
an independent mode; use normal live mode to review the landing page.

```sh
cd frontend
npm run lint
npm test
./node_modules/.bin/tsc -b --noEmit
npm run build
```

Backend code is unchanged, so backend checks are not required for this frontend-only
change. Live Google login is not simulated as a passed real-provider test; unit/UI
integration tests mock the existing auth client and API, with no real credentials.

## Browser verification and screenshots

Headless system Chromium with temporary Playwright/axe tooling outside the repository
was used to inspect widths 1440, 820, 390 and 320 pixels. The dev server used explicit
public placeholder Supabase settings, an isolated browser context, no real account,
and no production API/database. No preview server was deployed.

At all four widths, checks verify no horizontal overflow or page runtime errors,
keyboard skip-link and section focus, URL preservation, and reduced-motion behavior.
An axe WCAG 2 A/AA and 2.1 A/AA automated audit reported zero violations after the
contrast correction. Automated audits are not a complete manual accessibility review.

Full-page screenshots are retained outside the checkout, not committed build artifacts:

- `/workspace/landing-page-previews/desktop.png`
- `/workspace/landing-page-previews/tablet.png`
- `/workspace/landing-page-previews/mobile.png`
- `/workspace/landing-page-previews/narrow-mobile.png`
- `/workspace/landing-page-previews/check-results.json` (browser audit results)

Screenshots use reduced motion for deterministic capture. Real Google OAuth, mobile
Safari, other browser engines, screen-reader testing and future RTL/translations
remain external/manual review items. No publishing, PR, merge, or deployment is
included in this change.

## Final results

- Frontend lint: passed without warnings.
- Vitest: **53 tests passed** across seven files; existing workspace/auth/CRUD/performance
  tests remain passing alongside welcome-specific tests.
- Explicit TypeScript checking and production build with public placeholder settings: passed.
- Chromium desktop/tablet/mobile/narrow-mobile checks: passed at all four sizes;
  zero WCAG 2/2.1 A/AA axe violations, horizontal overflow, or page runtime errors.
- Git whitespace and changed-path/credential-pattern review: passed.
- Backend checks were not rerun because no backend files changed.
- Vitest emits an informational jsdom performance hint; no unresolved lint/build/test failure.

For visual review without an existing session, open the local app in a separate
browser profile/private window. A signed-in browser intentionally goes straight
to its protected workspace. Screenshots are local review files, not published assets.
