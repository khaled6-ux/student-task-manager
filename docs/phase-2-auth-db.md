# Phase 2: database and authenticated APIs

## Local history and scope

The mock UI was preserved in commit `b76536e83dd36de7e1e5b397e60f974a3278c4a5`
on `feat/mock-workspace-ui`. Phase 2 uses local branch `feat/phase-2-auth-db` based
on that commit. Original Phase 1 commit
`fbbb23c08f04baabbe9bfe86b251ba5970c7354d` is unchanged.
No GitHub authentication, push, pull request, or production setup is part of this work.

The React dashboard, calendar, sections, hash navigation, and mock fixtures remain
unchanged. No frontend sign-in or live database fetching has been added.

## Schema and migration

- `profiles`: UUID identity from the verified token, optional display name, IANA
  timezone, timezone-aware creation/update timestamps.
- `courses`: generated UUID, profile owner, name, optional code, hex color, timestamps.
- `tasks`: generated UUID, profile owner, optional course, title, optional description,
  status (`todo`, `in_progress`, `done`), priority (`low`, `medium`, `high`), optional
  timezone-aware deadline and completion timestamp, creation/update timestamps.

SQLAlchemy sets UUIDs for new courses/tasks. PostgreSQL stores native UUID columns.
Profiles are provisioned on the first profile request or resource creation, using
an idempotent insert. The standalone schema deliberately has no foreign key to
Supabase's managed `auth.users`: verified JWT UUIDs establish identity. Account
removal/cleanup and revocation lifecycle integration remain future work.

A composite FK `(course_id, user_id)` -> `courses(id, user_id)` prevents cross-user
course links even when the application is bypassed. Additional constraints protect
nonempty names/titles, status, priority, and completion-state consistency. Indexes
cover owner/course, owner/status/deadline, owner/priority/deadline, and course listing.

Course deletion retains tasks and clears their course links in the same transaction.
A concurrent conflicting reference can return 409 rather than violate ownership.
Task completion time is assigned by the server on transition into `done`; reopening
clears it. Unrelated edits preserve it. Clients cannot set timestamps or ownership.
`updated_at` is managed by SQLAlchemy on writes; raw SQL updates must maintain it
explicitly. No raw-SQL timestamp trigger is installed.

Revision `9c23764cdb81` creates all tables/indexes/constraints; downgrade removes them.
RLS is enabled with **no browser-access policies**. The backend must use a trusted
server-side table-owner connection (or a deliberately provisioned role with the
needed privileges/RLS behavior). FastAPI applies ownership to every query. Do not
use anon/authenticated Supabase roles as the backend database role. Keep direct
Data API access disabled or locked down; do not add broad grants or permissive
policies. Least-privilege production roles need separate review before deployment.

## JWT verification

Set `SUPABASE_URL` to the HTTPS project origin. Issuer is `<origin>/auth/v1`; public
keys are fetched from `<issuer>/.well-known/jwks.json` with TLS verification,
a five-second timeout, and bounded caching/refresh on unknown key IDs.
Only ES256/RS256 signed access tokens are accepted. Signature, exact issuer,
audience (`authenticated` by default), expiry, issue time, and UUID subject are
validated. JWT `jku`/`x5u` URLs are never followed. Legacy HS256 secrets are unsupported.
Use a Supabase project configured with asymmetric signing keys.

No service-role key or JWT signing secret is needed for verification. Send the
Supabase access token as `Authorization: Bearer <access_token>`; never use an ID
supplied in a request body. Input schemas reject extra fields such as `user_id`.
Missing/invalid tokens return 401 with a Bearer challenge. Missing auth configuration
or JWKS connectivity failure returns 503. Missing/other-user resources both return
404. Database constraint conflicts return 409 without leaking SQL or credentials.

The API currently uses stateless token validity: logout/revocation can remain
unobserved until token expiry. Use short access-token lifetimes and plan session
revocation checks if needed. Rate limiting, production role setup, account lifecycle,
and live Supabase end-to-end validation remain outside this local implementation.

## API

All routes below are under `/api/v1` and require a valid bearer token.

| Method | Path | Behavior |
| --- | --- | --- |
| GET, PATCH | `/me` | Read/provision own profile; edit display_name/timezone |
| GET, POST | `/courses` | Paginated list or create own course |
| GET, PATCH, DELETE | `/courses/{id}` | Read, partially update, delete own course |
| GET, POST | `/tasks` | Filtered/paginated list or create own task |
| GET, PATCH, DELETE | `/tasks/{id}` | Read, partially update, delete own task |

Create returns 201; delete returns 204. Lists return
`{items, total, limit, offset}` with default limit 20, maximum 100, nonnegative offset.
Order is creation descending then UUID for deterministic ties. Total is owner-scoped
and includes all matches before pagination. Offset pagination may shift under writes.
Task filters combine `status`, `priority`, `course_id`, `due_after`, `due_before`.
Date boundaries are inclusive; deadline range filters omit tasks with no deadline.
Date inputs must include a timezone; reversed ranges return 422.

PATCH distinguishes omitted fields from explicit null. Clear optional descriptions,
deadlines, course links, codes, or display names with null. Required fields reject
null, invalid enum values, blank names/titles, and invalid hex colors.

`GET /health` remains public liveness only. `/docs` and `/openapi.json` describe APIs.

## Commands and local PostgreSQL

From `backend/`, install dependencies and run migrations before serving data routes:

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp ../.env.example .env  # Only if you do not already have a local .env
# Set DATABASE_URL and SUPABASE_URL securely in backend/.env.
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic check
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For local-only disposable testing without creating credentials:

```sh
docker run -d --name student-task-phase2-postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=student \
  -e POSTGRES_DB=student_tasks -p 127.0.0.1:55432:5432 postgres:17
```

Trust mode is only for an isolated local test container; never expose its port to
other hosts or use it for shared/production databases. In this managed cloud task,
Docker's local socket was explicitly selected per runtime guidance.

Run checks from `backend/`:

```sh
.venv/bin/python -m ruff check .
TEST_DATABASE_URL=postgresql+psycopg://student@127.0.0.1:55432/student_tasks \
  .venv/bin/python -m pytest
.venv/bin/python -m alembic heads
```

Tests migrate a randomly named schema in the supplied test database, use rollback
isolation, then drop only their schema. The database role needs CREATE SCHEMA.
JWT signing keys are ephemeral and test-only, generated in memory; JWKS retrieval
is stubbed, but real signature/claim verification runs. No external auth calls occur.
Without `TEST_DATABASE_URL`, PostgreSQL tests are explicitly skipped; this is not a
complete backend validation run. GitHub Actions supplies a PostgreSQL 17 service
and runs integration tests, linters, and the frontend build automatically when pushed.
CI itself has not been executed on GitHub in this task.

From `frontend/`:

```sh
npm run lint
npm test
npm run build
```

## Before connecting Supabase

1. Configure a Supabase project with asymmetric JWT signing, confirm project issuer,
   audience, and JWKS reachability; no real configuration is created by this work.
2. Supply the PostgreSQL connection URL and project URL securely; preserve TLS and
   use the appropriate pooled connection settings. No secret belongs in Vite variables.
3. Review/apply migrations, backend database privileges, and Data API exposure/RLS.
4. Add React's Supabase client login, refresh/logout, and bearer-token forwarding in
   a later frontend integration task. Keep frontend ownership IDs out of requests.
5. Test two actual users end-to-end, key rotation, expired sessions, account cleanup,
   and deployment CORS origins before production use.

## File inventory

- `app/db/models.py`: database entities and constraints.
- `app/core/auth.py`: JWT authentication dependency and public JWKS client.
- `app/schemas/resources.py`: validated request/response and pagination schemas.
- `app/api/resources.py`: profile, course/task CRUD, filtering, ownership scoping.
- `migrations/versions/9c23764cdb81_*.py`: initial reversible PostgreSQL migration.
- `tests/conftest.py`: ephemeral JWT fixtures and migrated PostgreSQL test schemas.
- `tests/test_auth.py`, `test_resources.py`, `test_migrations.py`: authentication,
  CRUD, ownership, validation, constraints, migration round-trip and metadata checks.
- Updated config, router registration/CORS, Alembic environment, Python requirements,
  `.env.example`, README, and CI's PostgreSQL service. Frontend files are unchanged.

## Validation performed in this task

- Backend Ruff: passed.
- Backend pytest with PostgreSQL 17 and `TEST_DATABASE_URL`: **34 passed, 0 skipped**.
  Includes JWT signatures/claims, profile provisioning, resource CRUD, two-user
  isolation, cross-user course-link rejection in both API and database, validation,
  task completion transitions, pagination/filtering, and migration round-trip.
- Initial migration applied to the disposable local database; `alembic check` reported
  `No new upgrade operations detected.`
- Frontend lint: passed; Vitest: **7 passed**; TypeScript/Vite production build: passed.
- `git diff --check`: passed. Frontend files have no changes relative to the mock UI commit.
- One existing Starlette/AnyIO deprecation warning remains. Initial generated migration
  formatting/import lint issues were corrected before the final passing run.
- Live Supabase JWKS/login/key rotation, browser visual checks, and hosted CI were
  not executed. No GitHub authentication or publishing was attempted.
