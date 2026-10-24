# Student Task Manager — final V1 readiness audit

Audit date: **2026-10-25 (Asia/Shanghai)**. Repository: `khaled6-ux/student-task-manager`. Reviewed latest fetched `develop`, **`bc8c3a9ae2c7da1e8bff527b89a5c7475826cd75`**, including merged performance PR #2, landing PR #3, and multilingual PR #4. No application code, database, credentials, deployment settings, or remote branches were changed for this audit. This document is the only project-file change and is not committed.

## Decision

**The core personal student task-management workflow is implemented and suitable for continued local testing. Production launch approval is still blocked by the P1 release gates below.** No P0 issue was identified in this review; this is not a penetration-test or production-security certification.

The user's successful live local tests of Google OAuth, two-account isolation, persistence, English, Arabic RTL, Simplified Chinese, language persistence, and course/task operations are accepted as **user-reported evidence**. They are not represented as tests rerun against production by this audit.

There is no standalone, exhaustive signed-off V1 product specification in the repository. The comparison uses the approved foundation/backend/frontend integration work, subsequent V1 improvements, and the feature areas requested for this audit. Search, a dedicated archive, reminders, and similar additions must not be retroactively described as previously implemented or mandatory agreed scope. Their launch priority is called out explicitly below.

## Functionality versus requirements

| Area | Actual implementation | Assessment |
| --- | --- | --- |
| Landing and navigation | Public welcome page; Google entry actions; session restoration; authenticated hash routes for dashboard, calendar, courses, categories, profile; unknown-route state | Implemented. Navigation focus/deep-link refinements remain P2. |
| Dashboard | Total/completed/pending counts; next five future unfinished deadlines; tasks grouped by course, including unassigned; full task manager | Implemented. Overdue tasks remain in lists but have no dedicated dashboard warning/filter. |
| Five sections | Persisted `homeworks`, `exams`, `finals`, `projects`, `presentations`; backend validation/constraints, form selector, category-specific routes | Implemented end to end. |
| Courses | Create, view, edit, delete with confirmation; name/code/color; course-specific task page | Implemented. Deletion retains tasks with `course_id = null`; this is documented and intentional. |
| Tasks | Create, edit, complete/reopen, delete with confirmation; course/category assignment and description | Implemented. Deletes are permanent; no recycle bin or revision history. |
| Status/priority | `todo`, `in_progress`, `done`; low/medium/high; server controls completion timestamps and clears them on reopen | Implemented. Enum labels are translated; enum values stay stable. |
| Deadlines/timezones | Aware API instants; timezone-aware PostgreSQL columns; profile-timezone display/grouping; browser-timezone editor labeled explicitly; DST-gap rejection and unchanged-instant preservation | Implemented with a known entry/display timezone mismatch and ambiguous fall-back-time limitation (P2-03). |
| Calendar | Month movement, date selection, localized labels/counts, daily tasks grouped in profile timezone, state retained after mutations | Implemented. Sunday-first Gregorian weeks; internal mobile horizontal scrolling; no today shortcut, agenda/week view, or selected-day deadline default (P2-06). Undated tasks are intentionally absent from the calendar. |
| Archive/history/completed visibility | Completed tasks remain in the same lists, are counted, and can be reopened; `completed_at` exists in API/DB | **Completed visibility exists. Dedicated completed/archive screen, completion-date presentation/sorting, change history, and deleted-item recovery do not.** Basic completed filtering is P2-01; durable revision/trash history is V2. |
| Search/filtering | Backend combines category/status/priority/course/deadline-range filters and pagination. Frontend exposes category/course/day views only; no search box, status/priority/deadline filter controls, or user-facing pagination | Partial. No text-search backend endpoint. P2-01/P2-02; promote basic controls to P1 only if explicitly required for the launch scope. |
| Profile/settings | Display name and validated IANA timezone; browser-persisted language selector | Implemented basic settings. No account deletion/export UI, notification settings, or account-synced language preference. |
| Google/auth/isolation | Supabase PKCE, persisted session and refresh; protected UI; fresh bearer token per API request; verified asymmetric JWT identity; owner-scoped queries and composite task/course ownership FK | Implemented, covered by automated regressions and user-reported live testing. Real deployment/project configuration still needs verification. |
| Languages | English default, Arabic RTL, Simplified Chinese; 210 typed messages each; translated interface/errors; localized dates/numbers/plurals; localStorage persistence and cross-tab updates | Implemented. User content is not translated. Native-speaker review and browser/OS widget differences remain manual checks. |
| Loading/errors/mobile | Immediate saving flags, synchronous duplicate-write guard, disabled saves, retained input on error, explicit refresh/retry/empty states; responsive layouts | Implemented. Network timeouts, render-error recovery, and destructive-action focus need work; see P1-03/P1-04/P2-09. |
| Accessibility | Labels, status/alert semantics, focus styles, landing skip/section focus, reduced motion, RTL, contrast improvements, prior 72-scenario browser matrix | Strong baseline, **not full accessibility sign-off**. A keyboard confirmation-focus defect was reproduced in this audit (P1-03). |
| Performance | Server-confirmed cache updates avoid unrelated refetches; per-request sessions return pooled connections; read-only warm profile lookup and RETURNING timestamps; development-only redacted timings | Implemented work reductions. No verified real-environment latency speedup. Fetch-all/bootstrap and calendar processing scale poorly (P2-02). |
| Deployment/security | Build and CI scaffolding, env examples, local setup guides, TLS URL checks, JWT verification, RLS-enabled migrations, deny-by-default browser table access design | **Not production deployment-ready evidence.** Host configuration, operational controls, actual DB permissions, backups, dependency review, and deployment acceptance remain open (P1-01/P1-04). |

## Verified security and data foundations

Reviewed `backend/app/core/auth.py`, `api/resources.py`, `schemas/resources.py`, `db/models.py`, `db/session.py`, both migrations, frontend auth/client/data provider, and relevant tests.

- JWT keys come from the configured HTTPS project JWKS, not token-controlled URLs. Signature, allowed algorithms (ES256/RS256), issuer, audience, required expiry/issued-at/subject claims, and UUID subject are checked. Invalid credentials fail closed.
- Request bodies forbid extra fields. Identity is derived from the verified token; course/task bodies cannot supply `user_id`. Every resource lookup/list is owner-scoped. Foreign-key/check constraints back up ownership, category/status/priority, and completion invariants.
- RLS is enabled on the three application tables, with no browser policies added by migrations. **The trusted backend role can bypass owner RLS; application ownership predicates remain the per-user security boundary.** RLS-enabled metadata alone does not prove deployed grants/policies are safe.
- A process-cached SQLAlchemy engine owns a pool; each request gets a separate session, closed at request end. No shared user session/identity map was found. The pool permits up to ten connections per process; worker/replica count multiplies that budget.
- Frontend state is keyed by account, stale read/write results are guarded, and each request rechecks session ownership. Mutations use server-confirmed responses; language changes do not reload data.
- No private `.env` files, credential key files, dependency directories, or build outputs were found tracked by the path scan. Common private-key/GitHub-token/Supabase-secret patterns were absent in tracked files. Connection strings in examples/setup docs are documented placeholders. This targeted scan is not an exhaustive secret-history audit.
- `npm audit --omit=dev --json` returned **zero production-dependency advisories**. Backend and development-tool advisory scans were not performed; absence of known advisories in this one check is not a complete supply-chain assessment.

## P0 — critical/security

**None confirmed.** Any discovered ownership bypass, exposed real secret, permissive browser access to another user's rows, or exploitable critical dependency must stop launch and be classified P0. Actual Supabase grants/policies and production infrastructure were not inspected.

## P1 — must resolve before public V1 launch

### P1-01 — production configuration/security acceptance is incomplete

**Evidence:** `backend/app/core/config.py`, `frontend/src/lib/client.ts` and `supabase.ts`, `backend/app/db/session.py`, `docs/live-supabase-setup.md`; no host-specific production deployment configuration/runbook is present. README still describes local development. Missing `VITE_API_URL` defaults to localhost; missing public Supabase settings can produce a successful build with unavailable sign-in. Local Google testing does not validate a public production domain.

**Risk:** A build can pass while deployed login/API routing is unusable. The documented trusted table-owner connection is not a completed production privilege design. DB TLS depends on the supplied connection string; production policy is not enforced by `APP_ENV` alone.

**Acceptance:** Document and rehearse one chosen hosting path with immutable frontend build, non-reload ASGI startup, required public/private settings validation, HTTPS and exact CORS/OAuth redirects, production Google consent/access status, certificate-verifying PostgreSQL connection, worker/replica connection budget, private secret injection, and separate migration/runtime privilege design. Demonstrate direct anon/authenticated Data API denial and two-account API isolation in a production-like project. Review security headers/CSP/referrer policy, API docs exposure, token lifetime/revocation behavior, and account/data-retention procedures. Do not weaken JWT/TLS/RLS to make deployment work. Real rollout remains separately authorized.

### P1-02 — CI does not validate develop PRs or merged develop

**Evidence:** `.github/workflows/ci.yml:3`: pushes match `main` and `feat/**`; PRs match only `main`. Feature-branch push checks ran, but merged `develop` and a PR merge result targeting it are not covered by these triggers.

**Acceptance:** Trigger required checks on PRs targeting `develop` and on merged `develop`; retain `main` protection. Make frontend tests/lint/TypeScript/build and full PostgreSQL-backed backend tests/lint/migration metadata checks required. Confirm the DB suite cannot silently skip in CI and verify a test PR/merge-result run. Upgrade deprecated action runtimes as a separate small maintenance step. Do not configure automatic deployment as part of this fix.

### P1-03 — deletion confirmations do not receive keyboard focus

**Evidence:** `frontend/src/features/tasks/TaskManager.tsx:200` and corresponding `CourseManager` confirmation markup insert dialogs above the list, without focusing them, defining an Escape action, or restoring focus. In an isolated Chromium fixture, keyboard activation of a task's Delete button opened the dialog while focus stayed on the original Delete button outside it. Tabbing then left the controls rather than entering the confirmation. The normal axe pass does not detect this interaction defect.

**Acceptance:** Use a consistent accessible confirmation pattern: move focus into the confirmation (prefer Cancel), support Escape, keep keyboard navigation consistent with modal versus inline semantics, and restore focus to the trigger or a sensible surviving task/course control after removal. Add task/course keyboard tests for open/cancel/confirm/error, all three languages, narrow screens, and screen-reader announcements. Do not add `aria-modal=true` without the corresponding modal behavior.

### P1-04 — availability and recovery controls have not been established

**Evidence:** Only DB-independent `/health` exists (`backend/app/api/health.py`). No repository-level rate limiter, explicit client request deadline, DB statement/connect timeout policy, or production restore/monitoring runbook was found. `PyJWKClient` is cached, but its installed `get_signing_key` implementation force-refreshes JWKS on an unknown `kid`; unauthenticated fabricated key IDs can cause repeated outbound fetches despite the normal 300-second JWKS cache. JWKS calls can each wait up to five seconds. No live abuse test was sent.

**Acceptance:** Choose and test perimeter/app request limiting and bounded auth/DB/client wait behavior, preserving valid-key rotation and signature verification. A retry/timeout must not silently repeat a potentially committed mutation; communicate uncertain outcomes and refresh safely. Add readiness/dependency checks distinct from liveness, redacted error monitoring/alerts, and a connection/latency budget. Record a backup and restore rehearsal in a disposable restored environment with agreed recovery objectives and an explicit non-destructive release/rollback procedure. Complete backend and toolchain vulnerability review, remediate relevant launch-blocking advisories, and record the decision. Provider-managed controls may satisfy these items when their configuration/evidence is documented; a new in-house platform is not required.

## P2 — important improvements that may wait for a small scoped V1

| ID | Finding and source | Bounded acceptance criteria |
| --- | --- | --- |
| P2-01 | No task text search or status/priority/deadline controls in live UI; no dedicated completed list. `TaskManager`, `ConnectedWorkspace`, `client.ts:128`, backend `list_tasks` | Add search over title/description and combinable category/course/status/priority/deadline controls with reset/empty states in all languages. Start with a completed view/filter and existing `completed_at`, with reopen support; **do not invent an archived DB status** for this first step. Test persistence through mutations, timezone boundaries, and ownership. Decide explicitly whether these controls are in launch scope; if so, promote them to P1. |
| P2-02 | Bootstrap downloads every page of both resources (`client.ts:128`, `DataProvider`); all rows render. Calendar recomputes `dayKey` once per task per visible day (`LiveCalendar.tsx:68`), constructing `Intl.DateTimeFormat` repeatedly | Precompute/memoize day grouping once per dataset/timezone; reuse formatters. Test 100/500/1,000+ synthetic tasks with accurate counts and account switching. Then introduce measured, bounded data loading/pagination and correct total counts; do not fix it by silently truncating dashboard/calendar data. Preserve current zero-unrelated-refetch mutation budgets. |
| P2-03 | Deadline entry uses browser timezone while display uses profile timezone; DST fall-back input selects the earlier browser offset (`lib/dates.ts`, `TaskManager.tsx:50`) | Either make profile timezone the single entry/display rule or provide an explicit entry timezone and ambiguity resolution. Test differing browser/profile zones, spring gaps, both fall-back offsets, unchanged precision, and all locales. No changes to stored instants merely from a language/timezone switch. Current explicit label makes this a known limitation, not a proven silent data-corruption bug. |
| P2-04 | Last-writer-wins updates; no ETag/version check; fetch-all offset pagination can shift while another tab inserts/deletes (`resources.py`, `client.ts`) | Add conflict handling and safe refresh/reapply UX; test two tabs editing the same row and paginating during concurrent writes. Do not claim `409` already protects stale edits: current integrity-error mapping is not optimistic locking. |
| P2-05 | Self-service account lifecycle/export absent; deleting a Supabase auth user does not automatically remove independent profile/course/task rows; offline JWT validation accepts otherwise valid tokens until expiry | Define retention/deletion/revocation expectations first. Operator procedures/token lifetime policy belong in P1 release sign-off; self-service export/deletion UI and immediate-revocation enforcement can follow when required by the agreed product/security scope. Never assume Google logout invalidates all issued JWTs immediately. |
| P2-06 | Calendar has no Today shortcut or selected-date default for New task; completed tasks also count in daily cells; no explicit undated-task shortcut; mobile calendar intentionally scrolls | Add Today and an optional selected-day deadline suggestion without changing instants unexpectedly; clearly distinguish completed/pending/overdue counts and link undated tasks. Keep day labels accessible. Locale-specific week starts, grid arrow-key navigation, week/agenda views are optional refinements. |
| P2-07 | Runtime documentation is stale: README says real Supabase/Google has never been configured; architecture says live end-to-end checks are outstanding; folder descriptions mention future auth | Update current-status docs to distinguish user-verified local integration, historical phase evidence, and still-unverified production deployment. Link the chosen production runbook and this audit. Keep historical results labeled by date/commit rather than rewriting them as new tests. |
| P2-08 | Main production JS chunk is ~506 kB (143 kB gzip), with Vite advisory; dependencies/catalogs ship eagerly | Measure cold-load cost on a throttled mobile connection; split major routes/vendor/locale code only where justified, with no missing-language flash or auth regression. Set a documented bundle budget rather than suppressing the warning. |
| P2-09 | No top-level React render error boundary; generic validation lacks field associations/focus; SPA navigation does not consistently move focus/announce new page; restored OAuth destination is not explicitly persisted | Add localized recovery for unexpected render errors, field-linked error summaries, predictable page-heading focus and navigation announcements. Preserve requested hash routes across an actual OAuth round trip if adopted. Test keyboard/screen-reader behavior; do not confuse the existing restored-session deep-link test with a real OAuth return-target test. |

These P2 items do not invalidate the working core CRUD/authentication flow. Large-data support must become P1 if the launch capacity promise exceeds the tested account sizes; accessibility/legal commitments may also tighten the launch gate.

## V2 — future scope, not missing foundation work

- Durable task revisions/activity log, soft-delete trash and restoration beyond basic completed visibility.
- Recurring tasks, reminders/notifications, attachments, richer note content, and task dependencies.
- Google Calendar synchronization/import/export, push updates, offline/PWA behavior, and cross-device real-time collaboration.
- Shared courses/team assignments, advanced reporting, additional auth providers, and cloud-synced settings, if product demand warrants them.

No V2 item should delay a deliberately scoped personal-task V1 without an explicit scope decision.

## Evidence and checks performed for this audit

| Check | Result and limit |
| --- | --- |
| Fetch and history | Fetched `origin/develop`; reviewed `bc8c3a9`. Performance/landing/i18n merges are present. Local feature commit preserved. |
| Frontend `npm test` | **75 passed**, 8 files. |
| Frontend `npm run lint` | Passed; no lint warnings. |
| Frontend `./node_modules/.bin/tsc -b --noEmit` | Passed. |
| Frontend production build | Passed using public synthetic Supabase overrides, not real credentials. Main JS 505.98 kB / 143.02 kB gzip; non-blocking >500 kB Vite advisory. |
| Backend `env -u TEST_DATABASE_URL APP_ENV=test .venv/bin/python -m pytest` | **17 passed, 31 skipped**, one Starlette/AnyIO deprecation warning. No PostgreSQL test schemas created. |
| Backend Ruff | Passed. |
| Alembic heads | Single head **`b731a2c4d901`**. This is revision-graph inspection, **not live schema/metadata validation**. |
| Backend integration/migration source review | Reviewed CRUD/ownership/filter/constraint tests and schema-scoped migration round-trip/metadata tests. Historical feature CI passed both jobs; not claimed as a new full DB test run on merged develop. |
| `npm audit --omit=dev --json` | Zero production npm advisories reported. Backend/dev-tool advisories not scanned. |
| Browser keyboard probe | Synthetic local Supabase/API fixtures, no live requests: confirmation visible, focus remained outside on original Delete trigger; next Tab left the confirmation controls. Supports P1-03. |
| Prior i18n browser matrix | Documented 72 scenarios across three locales, four widths, six states with zero overflow/runtime/axe violations. **Not rerun as a full matrix during this audit.** Does not cover the reproduced confirmation interaction. |
| Calendar microbenchmark | Current production `dayKey` function in Node 24, synthetic 31-day counting loop: 100 tasks → 3,100 calls, **157 ms**; 500 tasks → 15,500 calls, **719 ms**. Single local samples, excluding React, selected-day list, network, and browser layout. Demonstrates processing cost only; not production latency, a browser benchmark, or a before/after optimization claim. |
| Tracked-file safety | No private env/build paths or common credential-pattern hits found. No private environment contents were inspected. No full Git-history secret scan performed. |

The prior performance work demonstrates removed requests and SQL statements, not a measured improvement over the user's original multi-second Supabase browser timings. Those timings have not been repeated here.

## Prioritized implementation plan

Estimates are focused engineering days for one developer, including relevant automated tests and docs, with the existing architecture retained. External approvals, hosting access, native-language review, and production observation are additional elapsed time. Each work package should be separately reviewed; this audit authorizes none of their deployment actions.

| Order | Work package | Scope / estimate | Exit criteria |
| --- | --- | --- | --- |
| 1 | Scope and deployment decision | 0.5 day + owner decisions | Agree small-account launch capacity, whether search/completed filters are launch requirements, token/revocation expectations, hosting path, and release owner. |
| 2 | Close P1-02 CI gap | 0.5–1 day | Develop-target PR/merge-result checks and merged-develop checks run; full disposable-PostgreSQL suite cannot silently skip; required checks documented. No automatic deployment. |
| 3 | Close P1-03 keyboard defect | 0.5–1 day | Task/course confirmation focus/cancel/confirm/error paths pass keyboard regression tests, RTL/mobile checks, and manual assistive-technology review. |
| 4 | Prepare P1-01 release configuration | 1–2 days + staging access | Repeatable build/start/migration/release instructions and configuration validation; TLS/CORS/OAuth/database-role checks documented and demonstrated in a production-like environment. No new product features or destructive migrations. |
| 5 | Close P1-04 operational/security gate | 1–2 days + restore/observation time | Abuse/request-timeout/dependency/readiness policies tested; no secret logging or unsafe mutation replay; dependency review and restore rehearsal recorded. Prefer suitable managed-host controls. |
| 6 | Release-candidate acceptance | 0.5–1 day + external testing | Full PostgreSQL-backed suite, migrations/schema check on disposable/restored DB, three-language responsive/accessibility checks, real-domain two-account OAuth/CRUD/session tests, and measured latency/capacity results pass. Explicit go/no-go record; deploy remains a separate approval. |
| 7 | P2 product usability | 2–3 days, after scope confirmation | Basic search/filter/completed views meet P2-01 acceptance without a new archive schema. If promoted to P1, execute before step 6. |
| 8 | P2 measured scaling and date UX | Calendar grouping: 0.5–1 day; bounded loading: 1–2 days; timezone UX: 1–2 days | Independent benchmarks/regressions meet agreed capacity; all counts remain correct; date entry behavior is explicit and tested. Split into separate changes rather than a rewrite. |
| 9 | Remaining P2/V2 | Individually scoped later | Conflict handling, lifecycle UI, error recovery, code splitting, and optional future features get separate acceptance tests and migrations only when needed. |

**Minimum release-preparation estimate:** about **4–8 engineering days** after decisions/access are available, excluding external review and newly discovered failures. Not an estimate to implement every P2/V2 feature or a guarantee of a production launch date.

## Checks needing real environment access, and local checks deliberately deferred

### Production or production-like environment evidence required

1. Public HTTPS certificates, CDN/static asset caching, compressed responses, routing/base path, CSP/security headers, exact API CORS origins, and no localhost fallback in the shipped build.
2. Actual Google OAuth consent/access mode and allowed users; exact public callback/redirect URLs; real-domain login, denied consent, account switching, session restoration, refresh, expiry, logout, and language persistence. Local Google success is useful evidence but does not cover this domain.
3. Actual Supabase JWT issuer/audience/JWKS rotation/outage behavior; runtime DB identity/permissions, browser Data API denial, TLS verification, pooler mode, connection limits, and two-account raw API isolation. Do not inspect secret values or change grants/data during this audit.
4. Existing schema version/drift and non-destructive migration applicability, tested first on a restored/disposable copy; real backup retention and restore procedure, monitoring/alerts, and rollback rehearsal.
5. Regional/cold/warm request latency, realistic concurrency and account sizes, connection saturation, error rates, browser performance on representative mobile networks, and correctly functioning provider/edge abuse limits.

### Can be done locally/staging without production, but not performed in this audit

- Full PostgreSQL integration tests, Alembic upgrade/downgrade/metadata checks, and restore exercises: **intentionally not run because they write database schemas/data**. They do not require production credentials; use a separately authorized disposable database.
- Full fresh browser matrix, Firefox/Safari/device tests, screen-reader and native-speaker review, adversarial auth/abuse simulations, backend/dev-tool advisory scans, and exhaustive Git-history secret scanning.

Do not run destructive downgrade or test-cleanup commands against a real user database. A green `/health`, successful build, enabled RLS flag, or feature-branch CI run alone is not production launch sign-off.
