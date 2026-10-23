# Architecture

React + TypeScript + Vite renders a protected workspace with hash-based navigation.
Supabase JS handles Google OAuth/PKCE, persisted sessions and token refresh. A typed
API client forwards access tokens to FastAPI; a labeled development-only mock mode
preserves the original workspace without becoming a production fallback.
FastAPI owns database-backed APIs under `/api/v1`. SQLAlchemy models map profiles,
courses and tasks to PostgreSQL; Alembic owns reversible schema migrations.

Supabase access tokens are verified by signature, issuer, audience, timestamps,
and UUID subject via the project's public JWKS. Every data route scopes operations
to this verified identity. A composite foreign key also enforces task/course ownership.
Frontend authentication and CRUD are implemented; live Supabase/Google configuration
and end-to-end validation remain outstanding.

`GET /health` is database-independent liveness only. The React mock interface remains
separate from live data routes. Task categories are persisted in the second migration. See `phase-2-auth-db.md` for details and security limits.
