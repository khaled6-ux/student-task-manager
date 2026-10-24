# Student Task Manager

A student workspace built with React, TypeScript, Vite, FastAPI, SQLAlchemy,
Alembic, PostgreSQL, and prepared Supabase JWT verification.

## Current status

- Authenticated dashboard, calendar, course CRUD, five task-category sections, task CRUD.
- Google OAuth via Supabase JS, session management, protected routes and token forwarding.
- Preserved explicit development-only mock workspace.
- Backend profile API, owner-scoped course/task CRUD, filtering and pagination.
- UUID database entities, initial migration, ownership constraints, and RLS enabled.
- Supabase ES256/RS256 access-token verification via project public JWKS.
- Frontend and backend automated tests, lint checks, build, GitHub Actions configuration.

The default frontend uses authenticated API data and requires public Supabase
configuration. No real Supabase/Google or production project has been configured.
For the preserved offline demo, explicitly enable VITE_DEMO_MODE=true in development.
There is no production fallback to fixtures.

## Requirements

- Node.js 22.12+ (Node 24 recommended) and npm
- Python 3.12+
- PostgreSQL (validated with version 17) for database-backed routes and integration tests
- An asymmetrically signed Supabase access token for authenticated API use

## Install

From the repository root:

```sh
cd frontend
npm ci
# Optional: copy .env.example to .env only if no local .env already exists.
cd ../backend
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
# Copy ../.env.example to .env only if no local .env already exists.
```

On Windows use `.venv\Scripts\python` instead of `.venv/bin/python`.
Example files contain no real credentials. Never commit `.env` files or put secrets
in public `VITE_` variables.

Configure `DATABASE_URL` and `SUPABASE_URL` securely in `backend/.env` before using
authenticated data APIs. See [Phase 2 setup](docs/phase-2-auth-db.md) for local
PostgreSQL commands, migrations, API semantics, JWT settings, and Supabase prerequisites.
Follow [Phase 3 configuration](docs/phase-3-frontend-integration.md) to enable
Google sign-in and set the public Vite variables. No database or authentication
setup is needed for the explicitly enabled development demo or `/health`.

## Run locally

In one terminal:

```sh
cd backend
.venv/bin/python -m alembic upgrade head  # When DATABASE_URL is configured
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another:

```sh
cd frontend
npm run dev -- --host 127.0.0.1
```

Use the Vite port printed in the terminal (normally 5173). API documentation is at
`/docs` on port 8000. Use browser host `localhost` with the default CORS setting;
if you use `127.0.0.1` or another port, include that exact origin in `CORS_ORIGINS`
as a JSON array in `backend/.env`, then restart the backend.
`GET /health` returns `{"status":"ok"}` and checks liveness, not database readiness.

## Validation

```sh
cd frontend
npm run lint
npm test
npm run build
cd ../backend
.venv/bin/python -m ruff check .
.venv/bin/python -m pytest
.venv/bin/python -m alembic heads
```

Set `TEST_DATABASE_URL` to a **disposable PostgreSQL database** for the complete
backend suite. Without it PostgreSQL integration tests are skipped; authentication
unit tests and health checks still run. The test role needs CREATE SCHEMA. Tests
migrate and clean up a uniquely named schema, never production tables. CI supplies
PostgreSQL and runs full validation. The frontend build includes TypeScript checks;
jsdom tests do not replace browser visual validation.

## Structure and documentation

- `frontend/src/app/`: shared layout and hash navigation
- `frontend/src/features/`: mock dashboard, calendar, sections, future auth
- `frontend/src/components/`, `types/`, `lib/`: shared UI, types, health API utility
- `frontend/tests/`: dashboard/navigation/calendar tests
- `backend/app/api/`: health and authenticated resource routes
- `backend/app/core/`: settings and verified JWT identity
- `backend/app/db/`: SQLAlchemy entities, metadata and sessions
- `backend/app/schemas/`: validated requests, responses, pagination
- `backend/migrations/`: Alembic environment and initial migration
- `backend/tests/`: JWT, API, ownership, constraints, and migration tests
- [Mock UI documentation](docs/mock-workspace-ui.md)
- [Phase 2 design, commands, API and Supabase checklist](docs/phase-2-auth-db.md)
- [Phase 3 frontend, Google setup, categories, testing and changed files](docs/phase-3-frontend-integration.md)
- [Live Supabase development setup and two-user acceptance checklist](docs/live-supabase-setup.md)

- [Version 1 performance findings, measurements and diagnostics](docs/v1-performance.md)
