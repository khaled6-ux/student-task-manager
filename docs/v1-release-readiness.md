# V1 release readiness fixes and verification runbook

This change starts from `develop` at `bc8c3a9` on `fix/v1-release-readiness`. It includes the previously uncommitted [V1 audit](v1-readiness-audit.md) intact. Its original findings/evidence are historical; the disposition below records subsequent fixes. No live Supabase data, OAuth credentials, infrastructure, branch protections, or remote branches were changed. No database model or migration changed.

## P1 disposition

| Audit finding | Code-level work completed | Still required before launch |
| --- | --- | --- |
| P1-01 production configuration | Frontend builds reject missing/insecure API/project URLs, private keys and demo mode. Runtime auth initialization repeats validation in production. FastAPI production lifespan fails before serving when project/DB settings, authenticated audience, explicit HTTPS CORS origins or certificate-verifying DB TLS are missing. Redacted config errors; safe public/private examples included. | Supply correct hosting values privately, verify actual TLS/CA, exact CORS and Google redirects/consent mode, DB privileges/Data API denial, two-account isolation and connection budget in a production-like environment. Placeholders prove validation behavior, not project connectivity. |
| P1-02 CI coverage | Both preserved frontend/backend jobs now run on develop/main PRs and pushes, plus feat/fix pushes. Explicit TypeScript, required PostgreSQL fixture guard, migration suite, and dependency audits included. Actions updated to Node 24-compatible majors. | Configure GitHub rulesets/required checks and observe actual CI after a separately authorized push. Local workflow validation is not a hosted Actions execution. |
| P1-03 destructive focus | Shared native modal dialog makes background inert, starts on Cancel, traps Tab/Shift+Tab, supports Escape/cancel, has named/described content and announced errors, and restores trigger/fallback focus. Pending writes cannot be dismissed; focus stays on the dialog until completion/error. | Manual screen-reader/Firefox/Safari/device acceptance. Browser automation checks accessibility semantics and keyboard behavior, not spoken output. |
| P1-04 availability/recovery | Separate read-only readiness endpoint; redacted request IDs/status/timings; generic DB-error responses; bounded DB connection/pool/query/lock waits; bounded JWT key refresh/outage retries; client deadlines and explicit uncertain-write handling. Affected Python dependencies upgraded and audited. | Configure/verify global edge rate limits, body/header/idle limits, proxy trust, log collection/redaction, monitoring/alerts, secret storage, backup/restore and release rollback. Application safeguards do not establish these infrastructure controls. |

**Production launch approval remains pending these external checks.** This is release preparation, not a deployment.

## Accessible deletion behavior

`ConfirmationDialog.tsx` uses native `<dialog>.showModal()` and browser background inertness, plus explicit keyboard trapping. Cancel is first and initially focused. Escape uses the native cancel event. On successful deletion the old trigger may be gone, so focus goes to New task/New course. On a failed delete, the modal remains open with a translated alert and enabled Cancel/retry controls. Closing during a pending write is blocked to avoid implying an already-dispatched write was cancelled. The 20-second client deadline ensures the caller eventually recovers; uncertain outcomes require data refresh rather than repeated deletion.

Modern browsers with native dialog support are required. Unit tests polyfill only jsdom's missing dialog methods; real Chromium checks cover top-layer focus, Escape, restoration, and modal accessibility across English, Arabic RTL and Chinese. No positive destructive action is selected by default.

## Public frontend configuration

Use `config/production.frontend.env.example` only as a template for hosting **build** inputs. `VITE_*` values are public and bundled into JS:

- `VITE_API_URL`: explicit HTTPS API base; no localhost fallback in production builds.
- `VITE_SUPABASE_URL`: HTTPS project origin.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: public publishable/legacy anon key only.
- `VITE_DEMO_MODE=false`, `VITE_DEV_PERF_TIMING=false`.

`vite.config.ts` validates build inputs. It accepts well-formed synthetic values for CI/offline builds, but does not contact Google/Supabase or verify a project exists. Rebuild when public configuration changes. Never supply database passwords, service-role/secret keys, signing keys, or Google client secrets to the frontend. Private frontend values can leak into the bundle even if supplied through a hosting secret UI.

Local development remains HTTP localhost-capable. For an offline build check, from `frontend`:

```sh
VITE_API_URL=https://api.example.test VITE_SUPABASE_URL=https://project.example.test VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BUILD_PLACEHOLDER VITE_DEMO_MODE=false npm run build
```

A production build without required configuration should fail. CI uses clearly synthetic public placeholders. Normal local browser development still uses existing `frontend/.env` public values and `npm run dev`; do not replace working private files with examples.

## Private backend configuration and startup

`config/production.backend.env.example` is a secret-free template, **not a usable production credential**. Backend runtime secrets belong in the host secret manager/process environment; local files remain `backend/.env` and must never enter Git.

Local users must select `APP_ENV=development` (the root `.env.example` now documents that). The default remains production/fail-closed. If an existing local file used `APP_ENV=production` with localhost/unencrypted test PostgreSQL, explicitly change the local mode yourself before startup; the application does not silently relax production security.

Production requires:

- `APP_ENV=production`; real `SUPABASE_URL`; `SUPABASE_JWT_AUDIENCE=authenticated`.
- Exact HTTPS `CORS_ORIGINS` JSON array, with no wildcards, credentials, paths, or trailing slash. CORS is a browser policy, not an API authentication boundary.
- Private `DATABASE_URL` using `postgresql+psycopg`, `sslmode=verify-full` and an explicit `sslrootcert` CA bundle path, mounted read-only/provisioned by the host. Supply the appropriate trusted CA chain and matching DB hostname; successful validation of a string does not prove certificates/connectivity. Do not set `sslmode=require`, disable verification, or bypass TLS to get past this check.
- Direct or session pooler compatibility; transaction poolers require separate compatibility work. DB role/grants and migration authority remain a separate design; no grant/policy changes are made here.

Per-process engine defaults: pool size 5 + overflow 5, pool acquisition 5 s; DB connection 5 s, each statement 10 s, each lock wait 3 s, idle transaction 15 s. Connection/statement/lock settings have bounded configurable fields shown in the template. Multiply ten connections by worker/replica count and include migration/monitoring connections; set capacity intentionally. PostgreSQL startup options must be supported by the selected pooler. Test failures/outages do not justify disabling checks.

From `backend`, after privately injecting validated settings, the proposed production startup is:

```sh
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-access-log --log-config ../config/production.logging.json
```

Do not use `--reload` in production or expose port 8000 directly without the chosen trusted HTTPS ingress. Configure forwarded-header trust only for actual trusted proxy addresses, never a global wildcard. This command was not used to deploy a service.

## Auth and abuse prevention

JWT signature, algorithm, issuer, audience, expiry/issued-at and UUID ownership verification remain required. User-supplied `user_id` stays forbidden and composite task/course ownership protection is unchanged. Untrusted header URLs are never fetched. Oversized tokens (>16 KiB), unsupported algorithms, missing or oversized `kid` are rejected before JWKS lookup.

PyJWT is pinned to 2.15.1 with its hardened JWKS client. An additional bounded client coalesces fetches and backs off failures: normal key-set TTL is 300 s, network timeout 5 s, minimum refresh interval 10 s per worker/client. Unknown keys never become trusted; expired cache entries are not served past TTL. A new rotated key may receive temporary rejection for up to ten seconds after a refresh; verify this against the real Supabase rotation procedure. Outages with no usable cache return 503; malformed/invalid credentials return 401. No permanent signing-key cache was enabled.

**This is not a global/per-user API rate limiter.** Before launch, configure provider/ingress quotas, per-IP/per-account abuse limits as appropriate, body/header size limits, idle/request timeouts, and monitoring. Preserve valid login, token refresh, CORS preflights and key rotation. Test distributed replicas and trusted proxy configuration; an in-process control is not a distributed quota.

Browser API operations have a 20 s deadline including token acquisition/fetch/body decoding. Reads expose a translated retry message. Mutation timeout, lost connection, or undecodable success response may occur after server commit: they are labeled **unknown outcome**, not failure-to-save. The UI blocks further writes until an explicit full refresh succeeds. Requests are aborted locally and never automatically replayed. Aborting a browser request does not roll back server work. A refresh may still race an unusually late server commit; the UI does not provide exactly-once/idempotent writes. Strong idempotency/versioning remains separate work.

## Health, diagnostics and monitoring

- `GET /health`: cheap process liveness only; no database/auth requests.
- `GET /ready`: read-only `SELECT 1` through the application session and configured auth-project check; 503 on unavailable DB/configuration, generic errors. It does not check user authorization, live JWKS, Google OAuth, RLS/grants, or schema head. Do not turn liveness into a dependency check.
- Responses get an application-generated `X-Request-ID`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`. Untrusted incoming request IDs are not used.
- `student_task_manager.requests` records request ID, normalized method, route template, status and elapsed milliseconds. No URL query, concrete row IDs, bodies, tokens, SQL, or driver error text. Unknown paths use a constant label.
- SQLAlchemy driver errors produce a generic 503, retaining the session-close rollback behavior. Existing integrity conflicts retain their safe 409 semantics.

The supplied logging configuration enables these INFO diagnostics and disables raw Uvicorn access logs, which can otherwise include queries/IDs. It does not sanitize every third-party or hosting log. Configure ingress/CDN/provider redaction and retention separately. Do not enable SQL echo or capture Authorization headers. Do not include private JWT/DB/Google values in error reports.

After infrastructure is configured, verify readiness/liveness separation during a dependency outage; alerts for 5xx/readiness failures, latency/pool saturation, repeated invalid JWT/unknown keys and limiter activity; safe request-ID correlation; and no high-cardinality user/token labels. No alerting, metrics backend, rate-limit appliance, or log collector is claimed active here.

## CI and branch protection

Workflow `V1 checks` retains jobs named **frontend** and **backend**. It runs on pushes to `develop`, `main`, `feat/**`, `fix/**` and PRs targeting `develop`/`main`, with read-only repository permission and cancellation of superseded runs. Do not configure deployment side effects in these checks.

Frontend: clean install, lint, tests, explicit TypeScript, configured production build, production npm dependency audit (high/critical threshold). Backend: current pip, pinned dependencies, Ruff, full pytest with `REQUIRE_TEST_DATABASE=true`, Alembic graph inspection, and audit of resolved Python packages. The migration tests perform metadata comparison and round trips inside random schemas in a disposable CI PostgreSQL service. Missing required DB configuration fails rather than silently skipping integration tests. No production secrets are required. Advisory feeds can change; review failures rather than disabling audits or adding blanket ignores.

A repository administrator must configure rulesets for both `develop` and `main`: require a pull request and appropriate approval, require frontend/backend checks from the Actions app, require the branch to be up to date (or configure a tested merge queue), dismiss stale approvals as desired, and disallow force pushes/deletions. Restrict bypasses. If adopting a merge queue, add/test a `merge_group` workflow trigger first. Do not require a check name until it has appeared in the repository. These settings were **not** changed by this task.

Before launch, observe a develop-target PR run and merged-develop push run on the candidate commit. Local actionlint is syntax/static validation, not proof of hosted execution or branch protection enforcement.

## Backup, restore, migration and rollback procedures to configure

1. Name an owner, agree recovery-point/recovery-time objectives and retention, verify provider backup/PITR capability and access. Record evidence without copying credentials or user data into Git.
2. Restore a backup to a separate restricted project/database. Never test restore/downgrade against the live database. Verify schema version, row counts/integrity, two-user isolation and application read/write behavior in the restored environment; record measured recovery time and reconciliation steps.
3. Run the full test suite and Alembic metadata/migration checks only against disposable/restored test infrastructure. This release changes no schema. For future migrations, review locks/backfills and compatibility, take a verified backup and apply controlled forward migrations with a migration role; do not blindly downgrade production.
4. Release through the chosen host only after approval; retain the previous immutable frontend/backend artifacts and configuration version. Test rollback compatibility with the current schema. Avoid concurrent releases/migrations, and define who can stop the rollout.
5. Verify production-domain OAuth/CORS/TLS, issuer/JWKS, grants/RLS/Data API denial, expired/revoked sessions, two-account operations, all languages and mobile/assistive-technology flows. Document token lifetime and operator account deletion/data retention policy; no auth-user cleanup was added automatically.

No backup, restore, production migration, infrastructure configuration, deployment or release action was executed here.

## Local validation and limitations

From `frontend`:

```sh
npm test
npm run lint
./node_modules/.bin/tsc -b --noEmit
# Build with the public placeholders shown above, or valid public project inputs.
npm audit --omit=dev --audit-level=high
```

From `backend`, with an explicitly disposable PostgreSQL URL supplied privately:

```sh
APP_ENV=test REQUIRE_TEST_DATABASE=true TEST_DATABASE_URL=postgresql+psycopg://student@127.0.0.1:55432/student_tasks .venv/bin/python -m pytest
.venv/bin/python -m ruff check .
.venv/bin/python -m alembic heads
.venv/bin/python -m pip check
```

The example loopback URL belongs only to this task's existing isolated PostgreSQL container. Tests create/migrate/tear down uniquely named test schemas; they never target the live Supabase project. Full migration metadata/round-trip checks are included in pytest. No model migration is needed for this change.

`frontend/tests/browser/i18n-check.mjs` extends the prior matrix with task/course deletion states: **96 scenarios** (3 languages × 4 widths × 8 states), including modal axe checks, initial Cancel focus, both Tab directions, Escape, trigger restoration and post-delete fallback. Run with the placeholder dev server and temporary Playwright/axe tooling as documented in [V1 i18n](v1-i18n.md), setting `I18N_PREVIEW_DIR` to a temporary artifact directory. All sessions and API data are synthetic and outbound real services are blocked.

The main JS chunk remains above Vite's 500 kB advisory threshold; no warning limit was raised. Starlette's test client reports an httpx deprecation; it does not fail the suite. Manual screen-reader, browser/device review, real Google domain testing, production TLS/privileges/capacity, distributed abuse control and restore evidence remain outstanding. P2 search/archive/scaling/product features from the audit were not added by this release-blocker task.

## Verified results for this change

- Frontend: **94 tests passed**, 10 files; lint and explicit TypeScript checks passed; configured production build passed. Main JS: approximately **510 kB / 144 kB gzip**, with the existing non-blocking Vite chunk advisory.
- Backend: **70 tests passed, no skips**, against the existing loopback-only PostgreSQL 17 test container with random schema isolation. Migration upgrade/downgrade/metadata tests passed; single Alembic head remains `b731a2c4d901`; Ruff and pip dependency compatibility checks passed. One Starlette/httpx test-client deprecation warning remains.
- Read-only isolated DB probe confirmed statement timeout 10 s, lock timeout 3 s, idle-transaction timeout 15 s.
- Chromium: **96 scenarios passed**, including 24 task/course deletion flows with modal axe and keyboard checks; zero page overflow, runtime errors or WCAG 2/2.1 A/AA violations.
- `actionlint` v1.7.11 accepted the workflow; full npm audit and resolved backend-environment pip-audit reported **zero known advisories** after dependency updates. This is advisory-feed evidence, not a complete security certification.
- New production startup/build rejection tests and existing Google/session/ownership/multilingual/task regressions passed. No real Google/Supabase/production acceptance test was attempted.
- Git whitespace and tracked/changed-file credential/path checks passed. Actual hosting and GitHub protection settings remain unverified and unchanged.

## Changed-file inventory

- `.env.example`
- `.github/workflows/ci.yml`
- `README.md`
- `backend/app/api/health.py`
- `backend/app/core/auth.py`
- `backend/app/core/config.py`
- `backend/app/core/operations.py`
- `backend/app/db/session.py`
- `backend/app/main.py`
- `backend/requirements.txt`
- `backend/tests/conftest.py`
- `backend/tests/test_release_readiness.py`
- `config/production.backend.env.example`
- `config/production.frontend.env.example`
- `config/production.logging.json`
- `docs/architecture.md`
- `docs/v1-i18n.md`
- `docs/v1-readiness-audit.md`
- `docs/v1-release-readiness.md`
- `frontend/src/app/DataProvider.tsx`
- `frontend/src/components/ConfirmationDialog.tsx`
- `frontend/src/features/courses/CourseManager.tsx`
- `frontend/src/features/tasks/TaskManager.tsx`
- `frontend/src/i18n/messages/ar.ts`
- `frontend/src/i18n/messages/en.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/index.css`
- `frontend/src/lib/client.ts`
- `frontend/src/lib/productionConfig.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/tests/ConfirmationDialog.test.tsx`
- `frontend/tests/IntegratedApp.test.tsx`
- `frontend/tests/ReleaseConfig.test.ts`
- `frontend/tests/browser/i18n-check.mjs`
- `frontend/tests/setup.ts`
- `frontend/vite.config.ts`

Subsequent deadline fix: task entry now uses the profile timezone, not the browser timezone. Unchanged stored timestamps are retained. See [profile-timezone deadlines](profile-timezone-deadlines.md); the preserved audit describes the earlier behavior.
