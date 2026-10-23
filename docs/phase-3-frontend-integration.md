# Phase 3: authenticated frontend integration

## Preserved history

Phase 2 was reviewed, validated (34 backend and 7 frontend tests), scanned for
private environment/credential patterns, and committed locally as
`dcfb8cc311053d9fdc1229d3f17ec48b4809cc91`. Its working tree was clean before
creating `feat/phase-3-frontend-integration` from that commit. Previous commits,
including Phase 1 `fbbb23c08f04baabbe9bfe86b251ba5970c7354d` and mock UI
`b76536e83dd36de7e1e5b397e60f974a3278c4a5`, remain unchanged.
No GitHub authentication, push, pull request, or deployment is part of this work.

## Features and data flow

The default app uses Supabase Auth (Google OAuth with PKCE), restores the session,
subscribes to auth events, refreshes tokens through the SDK, supports logout, and
protects workspace routes. Loading/configuration/auth errors are visible. An absent
configuration or failed request never switches the live app to fixtures.

The API client reads the current session token for **each** request and sends it
only in the Authorization header to the configured API. No user_id is sent in
write payloads; FastAPI verifies the token and derives ownership. The SDK persists
its own browser session; no tokens are printed, copied into application files, or
placed in URLs by application code. Browser token storage requires normal XSS
hardening; do not inject untrusted HTML or install untrusted browser scripts.

The workspace concurrently loads `/me`, all course pages, and all task pages (100
per page). It aborts obsolete reads and remounts data state when user identity
changes so one user's records do not remain visible to another. It currently loads
all records for accurate dashboard/calendar counts; large accounts need future
server aggregations or date-window queries. Offset pagination can shift during
concurrent writes, as documented in Phase 2.

Connected routes:

- `#/`: total/completed/pending counts, upcoming deadlines, course grouping, task CRUD.
- `#/calendar`: month navigation, selected-day tasks, profile-timezone grouping.
- `#/sections`: category overview; `#/sections/{category}` filters to that category.
- `#/courses`: course create/edit/delete; `#/courses/{id}` lists that course's tasks.
- `#/profile`: display-name and IANA timezone editing.

Task forms support title, description, category, course, priority, status and
optional deadline. Lists support completion/reopening, editing, and confirmation
before deleting. Course deletion also requires confirmation and explains that tasks
are retained. Forms validate blanks, lengths, enums, colors, and dates, show request
errors, and disable writes while a mutation is pending. Successful writes reload
the authoritative API state. A failed reload does not silently repeat a successful
write; the saved notice and refresh error are shown. If a refresh fails after an
initial successful load, previously loaded data stays visible with an error banner.

401 responses show an expired-session message; logout/sign-in is available rather
than retrying writes automatically. Provider/network failures have retry controls.
Auth initialization, Google failures, callback errors and sign-out failures have
visible states. The SDK owns callback exchange and refresh; application code does
not implement its own refresh protocol or decode a token to establish identity.

## Five persisted task categories

`homeworks`, `exams`, `finals`, `projects`, `presentations` are API enum values.
The second migration `b731a2c4d901` adds a non-null category column, check constraint,
and owner/category/deadline index. Existing rows are explicitly backfilled to
`homeworks`. Create defaults to homeworks; PATCH rejects null and invalid categories;
`GET /api/v1/tasks?category=projects` combines with existing owner/filter/pagination
rules. Downgrading this revision drops categories but preserves tasks and other data.
The original Phase 2 migration is unchanged.

## Dates and timezones

The API stores instants in PostgreSQL timezone-aware timestamps. Calendar day
keys and deadline display use the profile's IANA timezone, default UTC. Deadline
forms explicitly identify the **browser timezone** and convert datetime-local
values to ISO UTC before sending. Unchanged deadline values preserve their original
precision. Invalid/nonexistent local times (DST gaps) are rejected. Ambiguous
fall-back times use the browser's earlier-offset interpretation; an explicit offset
picker is not implemented. Choose UTC as browser timezone when exact offsets are
critical. Date-only deadlines are not a separate data type in the current API.

The live calendar starts in the current month for the profile timezone, unlike the
fixed October 2026 development fixture. Tasks without deadlines are visible in task
lists but not assigned to a calendar day. Dashboard upcoming deadlines exclude
completed and past-due tasks and show the next five; the clock updates each minute.

## Exact external configuration needed (not performed here)

1. In your Supabase project, configure asymmetric JWT signing (ES256 or RS256).
   Confirm the project issuer is `https://<project>.supabase.co/auth/v1` and public
   JWKS are reachable at `/auth/v1/.well-known/jwks.json`. The backend intentionally
   does not accept legacy HS256 signing secrets.
2. In Google Cloud, configure the OAuth consent screen and a **Web application**
   OAuth client. Add `https://<project>.supabase.co/auth/v1/callback` as its authorized
   redirect URI. If the consent screen is in testing, add your intended Google
   account as a test user.
3. In Supabase Authentication -> Providers -> Google, enable Google and enter that
   Google client ID and client secret **in Supabase's settings only**. Never place
   the Google client secret in React, Git, Vite variables, or chat.
4. In Supabase Authentication -> URL Configuration, use `http://localhost:5173` as
   the local Site URL and allow `http://localhost:5173/` as a Redirect URL. The app
   sends `window.location.origin + window.location.pathname` as redirectTo. If using
   another hostname/port/subpath, allow that exact callback too. Use localhost
   consistently with backend CORS. Production URLs can be configured later.
5. In `frontend/.env` (ignored), set public browser values:

   ```dotenv
   VITE_API_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   VITE_DEMO_MODE=false
   ```

   Use Supabase's public publishable key (or legacy **anon** key). Never use a
   service-role key or `sb_secret_` key. The client rejects secret-key prefixes and
   JWT keys with non-anon roles, but you must still select the correct public key.
   Vite variables are bundled publicly; restart Vite after edits and rebuild any
   production bundle when changing them.
6. In `backend/.env`, set `DATABASE_URL`, the same `SUPABASE_URL`, audience
   `authenticated`, and CORS origins as documented in Phase 2. Keep the actual
   database URL private, retain TLS verification, review server-role privileges,
   and leave direct browser table access blocked by RLS/no permissive policies.
7. Install dependencies, apply **both migrations**, start the backend/frontend, and
   validate Google login, refresh/logout and two real users end-to-end. Configure
   required network destinations through your environment settings; no proxy/trust
   bypass is needed or implemented.

No real credentials are needed for automated tests. No production service or
Google/Supabase project has been created or configured in this task.

## Commands

From `backend/`:

```sh
.venv/bin/python -m pip install -r requirements.txt
# Requires your securely configured DATABASE_URL for a real database:
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic check
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

From `frontend/`:

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm run lint
npm test
npm run build             # tsc -b (app + tests/config) followed by Vite build
```

Full backend validation (disposable local PostgreSQL from the Phase 2 guide):

```sh
cd backend
.venv/bin/python -m ruff check .
TEST_DATABASE_URL=postgresql+psycopg://student@127.0.0.1:55432/student_tasks \
  .venv/bin/python -m pytest
DATABASE_URL=postgresql+psycopg://student@127.0.0.1:55432/student_tasks \
  .venv/bin/python -m alembic upgrade head
DATABASE_URL=postgresql+psycopg://student@127.0.0.1:55432/student_tasks \
  .venv/bin/python -m alembic check
```

## Explicit development demo

Set `VITE_DEMO_MODE=true` **only with the development server** to use the preserved
Phase 1/2 mock workspace. It displays a prominent demo label and never saves data.
Production builds fail closed with a configuration message if demo mode is enabled.
No configured production path silently falls back to this demo. Existing demo tests
explicitly opt into this mode; other tests mock authentication and API responses.

## Testing and remaining verification

Frontend tests cover protected content, session restoration, auth refresh/logout,
auth/config/API errors, per-request bearer headers, pagination, forms/CRUD,
confirmation, course management, profile updates, category isolation, calendar
integration and timezone boundaries. Test fixtures exist only in `tests/` or the
explicit development demo. Backend tests retain authentication/ownership coverage
and add category persistence/filter/constraint tests and upgrade/backfill/downgrade
checks. CI uses the existing local PostgreSQL service configuration.

Live Google/Supabase sign-in, real session refresh/key rotation, real-user isolation,
and browser visual/end-to-end tests remain unverified until external configuration
is supplied. The UI intentionally does not pretend these tests ran. The frontend
uses API-faked integration tests; backend tests independently exercise real PostgreSQL
and cryptographic JWT verification. There is no frontend-to-live-Supabase E2E test.

## Validation results

- Backend: **42 passed, 0 skipped** against PostgreSQL 17, including all previous
  auth and ownership protections. Ruff passed.
- Frontend: **27 passed** across five test files. All previous demo tests pass with
  explicit opt-in. Lint passed without warnings.
- TypeScript checks include application, tests and Vitest configuration; production
  builds passed both without configured credentials (fail-closed setup screen) and
  with public placeholder configuration (full Supabase SDK bundle).
- Both migrations applied to local PostgreSQL; Alembic check found no schema drift.
  Tests cover upgrade/downgrade/backfill without losing preexisting task data.
- Git whitespace checks and credential-pattern/path scans passed. No actual
  credentials, dependency directories, temporary auth files or build outputs included.
- One preexisting Starlette/AnyIO deprecation warning remains. Vitest prints an
  informational jsdom performance hint. Initial formatting/type/test-discovery setup
  issues were corrected before final validation. No unresolved test failures.

## Complete changed-file inventory for this phase

- `.env.example`
- `README.md`
- `backend/app/api/resources.py`
- `backend/app/db/models.py`
- `backend/app/schemas/resources.py`
- `backend/migrations/versions/b731a2c4d901_add_task_categories.py`
- `backend/tests/test_migrations.py`
- `backend/tests/test_resources.py`
- `docs/architecture.md`
- `docs/phase-3-frontend-integration.md`
- `frontend/.env.example`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/app/ConnectedWorkspace.tsx`
- `frontend/src/app/DataProvider.tsx`
- `frontend/src/app/dataContext.ts`
- `frontend/src/features/auth/AuthProvider.tsx`
- `frontend/src/features/auth/ProfileForm.tsx`
- `frontend/src/features/auth/authContext.ts`
- `frontend/src/features/calendar/LiveCalendar.tsx`
- `frontend/src/features/courses/CourseManager.tsx`
- `frontend/src/features/tasks/LiveDashboard.tsx`
- `frontend/src/features/tasks/TaskManager.tsx`
- `frontend/src/index.css`
- `frontend/src/lib/client.ts`
- `frontend/src/lib/dates.ts`
- `frontend/src/lib/supabase.ts`
- `frontend/src/types/api.ts`
- `frontend/tests/ApiClient.test.ts`
- `frontend/tests/Dashboard.test.tsx`
- `frontend/tests/IntegratedApp.test.tsx`
- `frontend/tests/SupabaseConfig.test.ts`
- `frontend/tests/Workspace.test.tsx`
- `frontend/tsconfig.json`
- `frontend/tsconfig.tests.json`
- `frontend/vitest.config.ts`


## Preserved snapshot and live readiness audit

This phase was committed as `abc0ad3779c2542b38d0ce9e522e3d7149365e51`.
Subsequent local readiness fixes and exact project/network/TLS/Google/RLS setup
instructions are documented in [Live Supabase setup](live-supabase-setup.md).
That audit is a follow-up commit; the original Phase 3 snapshot is not amended.
