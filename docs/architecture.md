# Phase 1 foundation

React + TypeScript + Vite renders an empty dashboard and checks FastAPI liveness.
FastAPI owns application APIs; SQLAlchemy metadata and a lazy engine/session dependency
prepare for PostgreSQL. Alembic owns schema migrations. No models or migrations exist yet.
Supabase Auth and authorization will be implemented in a later phase. Do not expose
future data routes without token verification and ownership checks.

`GET /health` is liveness only, not database readiness. No database connection is opened
at startup. Dashboard counters are static empty-state placeholders, not database results.
