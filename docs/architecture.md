# Architecture

React + TypeScript + Vite renders a mock workspace with hash-based navigation.
FastAPI owns database-backed APIs under `/api/v1`. SQLAlchemy models map profiles,
courses and tasks to PostgreSQL; Alembic owns reversible schema migrations.

Supabase access tokens are verified by signature, issuer, audience, timestamps,
and UUID subject via the project's public JWKS. Every data route scopes operations
to this verified identity. A composite foreign key also enforces task/course ownership.
No real Supabase integration or frontend authentication has been configured yet.

`GET /health` is database-independent liveness only. The React mock interface remains
separate from live data routes. See `phase-2-auth-db.md` for details and security limits.
