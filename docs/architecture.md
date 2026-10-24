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
Frontend authentication and CRUD are implemented. The user has verified real
Supabase/Google integration locally with separate accounts; production-domain
verification remains outstanding.

`GET /health` is database-independent liveness only. The React mock interface remains
separate from live data routes. Task categories are persisted in the second migration. See `phase-2-auth-db.md` for details and security limits.

Production configuration now fails closed; see [release readiness](v1-release-readiness.md).
`GET /ready` checks read-only DB reachability separately from `/health` liveness.
The shared native deletion modal manages focus; request diagnostics redact sensitive
fields and API timeouts preserve uncertain mutation outcomes. These application
controls do not establish infrastructure rate limits, monitoring, backup/restore,
production privileges, or OAuth-domain readiness.
