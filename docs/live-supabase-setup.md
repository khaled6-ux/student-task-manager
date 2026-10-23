# Live Supabase integration: development setup and acceptance checks

This is a preparation guide, not a deployment. No Supabase/Google resources, actual
credentials, external database connections, or production settings were created by
this task. Use a separate development Supabase project and disposable test data.

The completed Phase 3 snapshot is commit
`abc0ad3779c2542b38d0ce9e522e3d7149365e51` on
`feat/phase-3-frontend-integration`. It was committed after 42 backend and 27 frontend
tests passed; the tree was clean. Subsequent readiness fixes are a separate commit,
not an amendment to this snapshot or any earlier commit.

## 1. Create a development project when ready

In the Supabase dashboard, select the intended organization and create a new project
named for development (for example Student Task Manager Development). Choose a
region near your development environment. Generate/store a strong database password
in your password manager; do not put it into chat or Git. Wait for provisioning.

Record the project URL (`https://<PROJECT_REF>.supabase.co`) and the **public
publishable** API key from the project's API configuration. Use the exact URL and
connection details displayed by Supabase rather than inferring a hostname or region.
Do not import a service-role key into the frontend.

Reference: https://supabase.com/docs/guides/getting-started

## 2. Choose a PostgreSQL connection and verify network prerequisites

Open the project's **Connect** dialog. Prefer a direct connection for migrations
when IPv6/connectivity supports it; otherwise choose **Session pooler** (normally
port 5432), which is appropriate for this persistent FastAPI/SQLAlchemy application
and avoids transaction-pooling prepared-statement restrictions. Copy that mode's
host, port, database and username. Session-pooler usernames commonly contain the
project reference; do not replace the copied username with a guessed value.

Do **not** select transaction pooler/port 6543 with the current psycopg defaults.
Psycopg can use server-prepared statements, which need additional configuration
for transaction pooling. Direct and session modes do not need that adaptation.

Use SQLAlchemy's `postgresql+psycopg://` scheme, not `postgres://`. URL-encode the
username/password components if they contain reserved characters (`@`, `:`, `/`,
`#`, `%`, etc.). Do not encode the entire URL. In `.env`, quote the entire value.

Example structure only; replace all placeholders locally:

```dotenv
DATABASE_URL="postgresql+psycopg://<COPIED_USERNAME>:<URL_ENCODED_PASSWORD>@<COPIED_HOST>:5432/postgres?sslmode=verify-full&sslrootcert=/absolute/path/to/trusted-root-ca.pem"
```

Keep certificate and hostname verification enabled. Use the trusted CA bundle
appropriate to the endpoint, obtained through Supabase's documented certificate
configuration or the trusted system CA store. Do not download a CA from an
untrusted source, disable certificate checks, or change expected hostnames to make
TLS pass. Do not apply TLS options to the local trust-mode test container; that is
a separate test-only service, not the real Supabase database.

**This exact cloud task currently has an external networking blocker:** its startup
TCP policy lists no allowed domains/IP ranges; the runtime reports restricted HTTP
networking, with no confirmed enforced-readiness state. Its custom HTTPS destination
list contains api.github.com, not a Supabase project. No real Supabase connection
was tested. PostgreSQL uses TCP, not HTTP, and psycopg does not gain access from
adding the project URL to an HTTPS allowlist or from setting HTTP_PROXY.

Before connecting from this cloud task, arrange supported TCP access/forwarding to
the **exact selected database/pooler host and port**, plus HTTPS access to the exact
project host for JWKS. No TCP-forwarding tool is available to this chat at present.
If environment settings cannot provide the supported route, run the backend on a
local development machine with database connectivity. Do not bypass the proxy,
disable TLS, or use an unauthenticated public tunnel for credentials. A future
successful connection, not saved settings alone, establishes readiness.

References:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler

## 3. Keep configuration in the correct place

| Setting | Location | Classification |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `frontend/.env` | Public project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `frontend/.env` | Public publishable key (or legacy anon key) |
| `VITE_API_URL` | `frontend/.env` | Public API origin |
| `VITE_DEMO_MODE=false` | `frontend/.env` | Public mode flag; live mode has no mock fallback |
| `SUPABASE_URL` | `backend/.env` | Backend setting; same project URL |
| `SUPABASE_JWT_AUDIENCE=authenticated` | `backend/.env` | Non-secret verification setting |
| `CORS_ORIGINS` | `backend/.env` | Non-secret list of exact browser origins |
| `DATABASE_URL` | `backend/.env` or secure runtime binding | **Private** connection credentials |
| Google OAuth client ID/secret | Supabase Google provider settings | Secret stays in provider settings, never React |
| JWT signing private keys, service-role/secret API keys | Not needed by this app | **Never** put in frontend, Git, or chat |
| Access/refresh tokens and PKCE material | Managed by Supabase JS in the browser | Sensitive; never log, commit, or share HAR/storage dumps |

`.env` and `.env.*` are ignored except `.env.example`. Copy examples only if the
local files do not already exist. Never overwrite existing credentials blindly.
Examples use placeholders and can be committed; actual values cannot. All `VITE_`
values are public in the browser build, even if the file itself is ignored.

`frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLIC_PUBLISHABLE_KEY>
VITE_DEMO_MODE=false
```

`backend/.env`:

```dotenv
APP_NAME=Student Task Manager
DATABASE_URL="<PRIVATE_POSTGRESQL_PLUS_PSYCOPG_CONNECTION_URL>"
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
CORS_ORIGINS=["http://localhost:5173"]
```

There is no backend anon/service-role key requirement: token verification uses
public JWKS. The app does not need a shared JWT signing secret. Keep test-database
settings separate and never point `TEST_DATABASE_URL` at this live project.

## 4. Configure Google OAuth and callback URLs

1. In Google Cloud, create/select a development project and configure the OAuth
   consent screen (branding, audience, support/contact details). If the audience is
   External and the app remains in Testing, add **both** Google accounts you will
   use as test users. Workspace organization policies can still restrict accounts.
2. Create an OAuth client with application type **Web application**.
3. Add this exact **Google authorized redirect URI**:
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
4. In Supabase Authentication's Google provider settings, enable Google and enter
   the Google client ID and client secret there. Do not enable unrelated providers
   or configure production URLs for this exercise.
5. In Supabase Authentication URL Configuration, set the development Site URL to
   `http://localhost:5173` and allow `http://localhost:5173/` in Redirect URLs.

These URLs serve different purposes:

| Purpose | Exact local-development value |
| --- | --- |
| Google -> Supabase callback | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Supabase -> application redirect | `http://localhost:5173/` |
| Browser origin allowed by FastAPI | `http://localhost:5173` (no trailing path) |
| Frontend API target | `http://localhost:8000` |

The app's `redirectTo` is `window.location.origin + window.location.pathname`.
For the normal root app, that is `http://localhost:5173/`. Hash routes are not Google
callback paths. There is no FastAPI `/auth/callback` endpoint to configure.
Supabase JS exchanges the PKCE code and detects the resulting session.

If Vite chooses port 5174, or you use `127.0.0.1`, update the Supabase Site/Redirect
URLs, frontend API URL as needed, and CORS consistently. Prefer port 5173 with
`--strictPort` to avoid accidental mismatches. Do not switch browser profiles or
origins mid-login: PKCE verifier storage must remain available to the initiating
application browser. Use a separate complete app/browser session for each test user.

**Localhost here assumes the browser and dev servers are on the same machine.**
A loopback URL in this cloud task is not a downloadable preview or a URL to your
computer's cloud process. If using a supported remote preview/forward, configure
its actual reachable origins and exact redirect path instead; none was created here.

Reference: https://supabase.com/docs/guides/auth/social-login/auth-google

## 5. Verify asymmetric JWT settings

In the project's JWT signing-key configuration, confirm the **active** key uses
ES256 or RS256. If migrating an older HS256 project, follow Supabase's key-rotation
procedure and obtain a fresh sign-in session afterward; do not paste the old
shared signing secret into this backend.

The backend derives:

- issuer: `https://<PROJECT_REF>.supabase.co/auth/v1`;
- JWKS URL: `https://<PROJECT_REF>.supabase.co/auth/v1/.well-known/jwks.json`;
- expected audience: `authenticated` unless deliberately configured otherwise.

It verifies signature, issuer, audience, expiry/issue time, and UUID subject, then
uses that subject as the user ID. It never trusts frontend user_id fields. Unknown
key IDs trigger a JWKS refresh through PyJWT; cached key sets have bounded lifetime.
No JWT-supplied jku/x5u URL is followed. Missing/invalid tokens return 401, while
missing configuration or unavailable JWKS connectivity returns 503.

Stateless verification does not immediately observe every logout/revocation until
the access token expires. Supabase JS manages refresh/logout; short access-token
lifetimes and a later revocation strategy remain relevant before production.

Reference: https://supabase.com/docs/guides/auth/signing-keys

## 6. Apply migrations and verify permissions/RLS

From the repository root (Python 3.12+, Node 24 recommended):

```sh
cd backend
python -m venv .venv                         # Only if it does not exist
.venv/bin/python -m pip install -r requirements.txt
# Configure backend/.env securely before the next commands.
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic current
.venv/bin/python -m alembic check
```

Expected head: `b731a2c4d901`. The chain creates profiles/courses/tasks and then adds
five categories. Existing uncategorized tasks become homeworks. Review the target
connection before migrating; do not run downgrade on a real project as a smoke test.

The migration creates application tables in the connection's default schema
(normally `public`). Inspect ownership and row security in the development project:

```sql
SELECT schemaname, tablename, tableowner, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'courses', 'tasks');

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'courses', 'tasks');
```

Expected: RLS enabled for all three tables, no application-table browser policies.
The backend must connect as their trusted owner for this development setup; owners
bypass RLS unless FORCE RLS applies. FastAPI therefore enforces user ownership on
**every operation**, and a composite FK enforces task/course ownership too. Using
an ordinary non-owner role without matching policies will fail with permission/RLS
errors; that is not fixed by disabling RLS or adding a global allow policy.

Do not expose these tables directly to the browser through Supabase Data API. For
additional defense in this dedicated project, after reviewing existing use, an
administrator can revoke grants specifically on these application tables:

```sql
REVOKE ALL ON TABLE public.profiles, public.courses, public.tasks
FROM anon, authenticated;
```

This does not prevent Supabase Auth login and does not revoke the table owner's
rights. It affects direct browser table operations only. Do not alter Supabase's
managed auth schema or grant broad access to public/authenticated roles. Subsequent
migrations need the same permissions/exposure review. A least-privilege server-role
and migration-role design is separate work before production.

Profiles are provisioned from verified user UUIDs on first profile/resource access;
there is intentionally no trigger or foreign key into managed `auth.users`.
Supabase account deletion does not yet automatically delete application profiles.
Course deletion retains tasks without a course. Account cleanup is a documented
remaining lifecycle concern, not a requirement to connect this development project.

## 7. Start local servers

Terminal A, repository root:

```sh
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal B, repository root:

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open the app using host `localhost`, consistently with the above URL settings.
Restart the servers after environment edits; Vite values are build-time public
configuration. No build/deployment is required for local development.

`GET /health` should return `{"status":"ok"}` without a database connection. It is
liveness only, not evidence of database/auth readiness. OpenAPI at `/docs` describes
the protected APIs. Before login, data routes should return 401. After login,
workspace loading must succeed; a 503/DB error requires diagnosis rather than
turning on demo mode to make a live test appear successful.

## 8. Acceptance checklist with two Google accounts

Use two independent browser profiles or normal/private sessions. If Google consent
is in Testing, both accounts must be registered test users. Never share tokens.

1. **Account A login:** select Continue with Google. Confirm return to the app,
   successful profile provisioning, and no configuration/API errors.
2. **Restoration:** reload the page. Confirm the same user and workspace restore
   without another consent flow.
3. **Refresh:** keep the app open across an access-token refresh window and perform
   another read/write. Confirm it works; inspect only request status/events, never
   log/copy bearer headers or session storage. A mocked token-refresh test is not
   evidence this live step passed.
4. **Profile:** change display name and timezone; reload and confirm persistence.
5. **Courses:** create two courses, edit one, and check persistence after reload.
6. **Tasks/categories:** create tasks in Homeworks, Exams, Finals, Projects and
   Presentations, with different priorities/courses/deadlines. Edit one category;
   verify it moves to the correct section. Complete/reopen a task and verify counts.
7. **Dashboard:** check total = all tasks, completed = done, pending = not done;
   upcoming excludes past/done and shows the next five; course counts match lists.
8. **Calendar:** verify a deadline near UTC midnight appears on the correct day for
   the profile timezone. Navigate another month, select a date, complete/edit a
   task and confirm the month/date stay selected while the task updates.
9. **Delete:** cancel task deletion first (record stays), then confirm deletion;
   reload. Delete a course and verify its tasks remain without that course.
10. **Account B:** sign in from the second browser. Confirm none of A's courses or
    tasks are listed. Create B's own data and verify A cannot see it.
11. **Ownership rejection:** in the browser API docs, use B's session privately to
    request/PATCH/DELETE an A-owned resource UUID; expect 404. Creating/linking a B
    task to A's course must return 404. Supplying user_id in a body must return 422.
    Do not share the entered token, screenshots of headers, or Swagger storage.
12. **Logout:** log out of A, then refresh and follow a protected hash link. Only the
    sign-in screen should appear. B's independent session remains isolated.

Record pass/fail separately; none of these real-provider checks have run yet.

## Local readiness evidence and fixes

The existing tests cover JWT cryptography/claims, profile and course/task CRUD,
category filters, owner scoping and database constraints against PostgreSQL. UI
integration tests use explicitly fake auth/API fixtures and include restoration,
refresh events, logout, user-change data clearing, forms, categories and calendar.

Audit fixes, committed after the preserved Phase 3 snapshot:

- Shared API URL validation now rejects bad API settings on the setup screen rather
  than throwing later when an authenticated data provider is constructed.
- The INITIAL_SESSION snapshot no longer masks a getSession restoration error.
- Refreshing existing data keeps page components mounted, preserving calendar
  selection and form state. Initial loads still show a dedicated loading state.
- Added regression tests for these cases and every one of the five category pages;
  test profile fixtures now reset between tests.

Remaining blockers are external configuration, network/TLS/permissions validation,
and live Google/Supabase browser acceptance. No further real credentials are
necessary to complete this preparation. Known limitations include stateless access
revocation, account-deletion cleanup, all-record offset pagination for large accounts,
and browser interpretation of ambiguous DST deadline inputs (see Phase 3 guide).

## Final local verification

| Capability | Local evidence | Real-project status |
| --- | --- | --- |
| Google login | Google OAuth/PKCE initiation, error and protected-route tests | Consent/callback unverified |
| Session restoration | Restored/loading/error and INITIAL_SESSION regression tests | Real persisted session unverified |
| Refresh | SDK autoRefreshToken config and refreshed bearer-token tests | Real expiry/refresh window unverified |
| Profile | Backend provisioning/update and frontend load/update tests | Pending project configuration |
| Courses/tasks | PostgreSQL CRUD/constraint tests and UI create/edit/delete/complete tests | Pending project configuration |
| Five categories | Backend persistence/filter tests and five UI category-page tests | Pending project configuration |
| Dashboard/calendar | API-backed UI/count/date tests; calendar selection survives mutation | Browser/real data acceptance pending |
| Logout/isolation | Signed-out protected routes, per-user remount, JWT/ownership checks | Two real Google accounts pending |

Final runs: **42 backend tests passed, 0 skipped** against PostgreSQL 17;
**35 frontend tests passed** across five files. Both linters passed without lint
warnings. TypeScript checks and the production build (with public placeholder
Supabase settings) passed. Migration upgrade succeeded, head was `b731a2c4d901`,
and Alembic check found no new operations. Migration tests include round-trip and
category backfill preservation. Whitespace and credential-pattern/path checks passed.

One existing Starlette/AnyIO dependency deprecation warning remains. Vitest emits
an informational jsdom performance hint. No external-provider/live-user/browser
E2E check is reported as passed; no production readiness claim is made.
