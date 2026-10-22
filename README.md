# Student Task Manager

A student workspace built with React, TypeScript, Vite, FastAPI, and PostgreSQL.
Supabase Auth is planned for a later phase.

## Phase 1 status

Included: responsive dashboard with empty states, live API connection indicator,
FastAPI liveness endpoint and API docs, SQLAlchemy base/session scaffolding,
Alembic configuration, and backend tests. There are no task/course APIs, database
tables, authentication, or persistence yet. Dashboard counts are placeholders.

## Requirements

- Node.js 22.12+ (Node 24 recommended) and npm
- Python 3.12+
- PostgreSQL is **not required** for this phase

## Install

From the repository root:

```sh
cd frontend
npm ci
cp .env.example .env
cd ../backend
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp ../.env.example .env
```

On Windows, use `.venv\Scripts\python` instead of `.venv/bin/python`.
The example files contain no real credentials. Never commit `.env` files.
`VITE_` variables are public browser configuration; never put secrets in them.

## Run locally

In one terminal:

```sh
cd backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm run dev -- --host 127.0.0.1
```

Open the Vite address printed in the terminal (normally port 5173).
FastAPI interactive docs are at `/docs` on port 8000.
`GET /health` returns `{"status":"ok"}` without contacting PostgreSQL.
It checks process liveness, not database readiness.
If Vite selects another port, set `CORS_ORIGINS` in `backend/.env` to its origin
as a JSON array. Restart the backend after environment changes. Use the same
hostname in CORS configuration as in your browser (the default is `localhost`).

## Validation

```sh
cd backend
.venv/bin/python -m ruff check .
.venv/bin/python -m pytest
.venv/bin/python -m alembic heads
cd ../frontend
npm run lint
npm test
npm run build
```

Frontend tests exercise dashboard empty states and API success, network failure,
HTTP failure, and unhealthy responses using Vitest and Testing Library. The
production build includes TypeScript checks. Backend tests cover the health
response, OpenAPI registration, and allowed/denied CORS origins. GitHub Actions
runs both suites, both linters, the production build, and Alembic revision discovery
on pushes to main/foundation and pull requests targeting main.

## Database scaffolding

`app/db/base.py` owns shared SQLAlchemy metadata. `app/db/session.py` creates an
engine lazily and supplies a session dependency. No connections are opened at
application startup. Configure `DATABASE_URL` with a `postgresql+psycopg://` URL
only when database operations are needed. URL-encode special password characters.

Alembic reads the same settings; it does not embed credentials in `alembic.ini`.
No initial revision exists because this phase defines no tables. In a later phase,
import models in `migrations/env.py`, generate and review a revision, then migrate:

```sh
cd backend
.venv/bin/python -m alembic revision --autogenerate -m "create initial tables"
.venv/bin/python -m alembic upgrade head
```

Those commands require an accessible database and are not needed for Phase 1.

## Structure

- `frontend/src/features/`: dashboard and future auth/course feature locations
- `frontend/src/lib/`: API utilities
- `frontend/src/app/`, `components/`, `types/`: shared application structure
- `backend/app/api/`: HTTP routes
- `backend/app/core/`: environment configuration
- `backend/app/db/`: SQLAlchemy metadata and sessions
- `backend/app/schemas/`, `services/`: future schemas and business operations
- `backend/migrations/`: Alembic environment and future revisions
- `backend/tests/`: API tests
- `docs/architecture.md`: scope and architecture notes

Authentication and ownership enforcement must be added before exposing student data.
