# Version 1 performance: measured work reduction and local diagnostics

Branch: `feat/v1-performance`, based on fetched `develop` commit `9d5d74a`
(which includes all prior phases and local-environment protections). No private
.env files were inspected/edited, no production Supabase data was touched, and
no schema migrations or authentication-policy changes were required.

## Findings: confirmed versus unverified

Confirmed from the original request flow and regression tests:

- `DataProvider.mutate` used to await a full `reload()` after every successful write.
  That fetched profile, all course pages and all task pages, even for a single course
  creation. It kept the saving state active until the slowest subsequent read ended.
- `GET /me` unconditionally executed a profile upsert and committed. Serialization
  then reread the expired ORM object. An existing-profile read was doing writes.
- SQLAlchemy's default `expire_on_commit=True` could reread committed objects when
  FastAPI serialized response fields. PostgreSQL can return generated defaults and
  update timestamps directly instead.
- Forms had disabled buttons but no synchronous provider-level guard against two
  submits before React's next render. Course/profile submit buttons had no saving text.

Unverified contributors to the reported Windows/Supabase seconds:

- Database region/network distance, new connection/TLS negotiation, pool wait,
  pre-ping cost, Supabase/pooler behavior and cold project activity.
- Cold JWKS retrieval/rotation, browser Supabase refresh/locking time, and dev-server
  overhead. Public JWKS caching already existed (300-second key-set lifetime,
  refresh on unknown kid); no signature/issuer/audience/expiry checks were removed.
- Row-lock waits caused by concurrent provisioning, payload size, or query plans.
  These require traces from the real environment; statement counts alone do not
  establish them as latency causes.

No end-to-end speedup in milliseconds or percentage is claimed.

## Measurements and scope

The user reported these browser timings before this change:

| Operation | Reported duration |
| --- | ---: |
| Initial GET profile | 2.81 s |
| Initial GET courses | 1.78 s |
| Initial GET tasks | 1.32 s |
| POST course | 3.42 s |
| Subsequent GET profile | 4.89 s |
| Subsequent GET courses | 1.94 s |
| Subsequent GET tasks | 1.96 s |

No real Supabase credentials or production data were used to repeat these timings.
Do not sum parallel GET durations or infer a time improvement from their removal.

For one-page fixtures (at most 100 records per resource), original source flow and
the user's network trace show one write plus three follow-up reads. New automated
request-trace assertions measure:

| Successful operation | Before | After |
| --- | --- | --- |
| Create/update course | 1 write + 3 GETs | 1 write, **0 GETs** |
| Create/edit/complete/delete task | 1 write + 3 GETs | 1 write, **0 GETs** |
| Update profile | 1 PATCH + 3 GETs | 1 PATCH, **0 GETs** |
| Delete course with no cached linked tasks | 1 DELETE + 3 GETs | 1 DELETE, **0 GETs** |
| Delete course with linked tasks | 1 DELETE + 3 GETs | 1 DELETE + tasks-only revalidation |

Large lists can require multiple page GETs, including during tasks-only revalidation.
Initial login still loads profile/courses/tasks; it is not eliminated or represented
as faster without real measurements.

SQLAlchemy event tracing against disposable local PostgreSQL, before and after
changes, recorded the following application data statements:

| Endpoint | Before | After |
| --- | --- | --- |
| Existing-profile GET | INSERT + SELECT + SELECT (3) | SELECT (1) |
| Create course for existing user | INSERT + SELECT + INSERT + SELECT (4) | SELECT + INSERT (2) |
| Update course | SELECT + UPDATE + SELECT (3) | SELECT + UPDATE (2) |

`SAVEPOINT`/`RELEASE` belong to the test fixture and are excluded. COMMIT/ROLLBACK,
connection ping/negotiation, and JWKS calls are not counted as data statements.
These counts measure removed work, not production round-trip times. Tests enforce
the new budgets and verify that returned update timestamps are server-generated.

## Implementation and consistency

- Typed mutation variants apply POST/PATCH **server responses** to the relevant
  profile/course/task cache only after success; there are no optimistic phantom rows.
- Deletes remove only the confirmed item. Course deletion can change linked task
  timestamps, so it revalidates tasks only when cached links exist rather than
  fabricating server timestamps. If that read fails, the course remains deleted,
  an explicit stale-task warning is shown, and further writes are blocked until a
  full refresh succeeds. A successful DELETE is never automatically repeated.
- A synchronous ref guard prevents duplicate writes; saving state begins before
  awaiting token retrieval/network requests. All forms retain user input on failure.
- Older refreshes are aborted/ignored before writes. Account-keyed providers and
  per-request session-owner checks prevent late data from entering another user's
  cache. Each request still obtains the current refreshed token.
- Refresh data is an explicit header action for changes from other browsers/tabs.
  Initial load, manual refresh and auth changes retain full loading/error behavior.
  There is no realtime synchronization, automatic write retry, or new global cache.
- Cached rows use the same creation-descending/UUID order as API lists; dashboard,
  category and calendar views derive from that shared state without workspace reloads.
- Request-scoped SQLAlchemy sessions no longer expire committed instances. PostgreSQL
  RETURNING/eager defaults supplies timestamps. Sessions still close at request end;
  pending transactions roll back and pooled connections are returned. No long-lived
  Session or shared user identity map was introduced.
- Existing profiles are read without provisioning writes; new-profile provisioning
  uses concurrency-safe INSERT ... ON CONFLICT DO NOTHING RETURNING and a fallback
  SELECT when another request already inserted the profile.

The Engine remains process-cached with QueuePool size 5, max overflow 5 and
`pool_pre_ping=True`. Multiple Uvicorn workers each have their own pool. No evidence
justifies increasing pool size, disabling ping, changing TLS, or changing Supabase
pooler mode here. Direct/session pooler compatibility is unchanged. GET list
pagination still performs count and data queries. Large-account/windowed fetching
and cross-tab conflict detection remain separate future work.

## Safe opt-in development measurements

Nothing is enabled by default. In your local backend environment, set:

```dotenv
APP_ENV=development
DEV_PERFORMANCE_TIMING=true
```

Restart FastAPI. Production/test app environments ignore the flag. Responses expose
`Server-Timing` through CORS only when diagnostics are enabled:

- `app`: request processing to response headers; excludes full wire-transfer time.
- `auth_key`: signing-key resolution (including JWKS retrieval when needed).
- `jwt`: cryptographic/claim verification time; verification remains fully enabled.
- `db_acquire`: connection acquisition, including pool wait/new connection and ping.
- `db`: accumulated successful SQL execution time, not commit/rollback or full
  response transfer/serialization. These spans are not intended to sum to app time.

An INFO logger named `student_task_manager.performance` can record method, matched
route **template**, status, the above timings, and successful query count. It never
records SQL text, parameters, raw URLs, headers, IDs, bodies, tokens or credentials.
No SQL echo is enabled. If your normal logger configuration suppresses INFO, use
Server-Timing alone, or run this optional local diagnostic launcher from `backend/`:

```sh
.venv/bin/python -c "import logging,uvicorn; log=logging.getLogger('student_task_manager.performance'); log.setLevel(logging.INFO); log.addHandler(logging.StreamHandler()); uvicorn.run('app.main:app',host='127.0.0.1',port=8000)"
```

On Windows use `.venv\Scripts\python` instead of `.venv/bin/python`. This launcher
has no reload process so the custom logger stays in the serving process. Do not
turn on broad HTTP/SQL debug logging or export browser HAR files with session tokens.

Optional browser diagnostics in your local frontend environment:

```dotenv
VITE_DEV_PERF_TIMING=true
```

Restart Vite. Only development builds emit `[dev-performance]` console records:
method, a static resource label (IDs and query strings removed), and total duration
including session-token retrieval, fetch and JSON parsing. They contain no request
body, response data, bearer token or user identity. Production builds cannot enable
these records. Existing SDK auto-refresh and PKCE settings are unchanged.

## Repeatable next measurements on Windows

1. Record browser version, server reload mode, Supabase region/connection mode and
   record counts; keep these constant. Do not share credentials or full connection URLs.
2. Capture a cold first load separately, then at least 10 warm course creates,
   edits and task completions. Use the same account and browser for before/after.
3. Record mutation duration, follow-up request count, and time until the saving
   indicator clears. Verify successful create/edit has no unrelated GETs.
4. Compare median/p95, not one sample. Compare browser totals to Server-Timing:
   high auth_key suggests a cold key fetch; high db_acquire suggests connection/pool
   work; high db suggests SQL/network execution; large unexplained residuals need
   commit/serialization/dev-server investigation. Treat these as clues, not proof.
5. Confirm both-account isolation, calendar selection, error retry and explicit
   Refresh data behavior with two browser sessions. Disable timing flags afterward.

## Regression checks

Tests cover no-refetch CRUD, server-confirmed normalized rows, duplicate submit/saving
states, failed writes preserving form/cache, targeted course-delete reads and failed
revalidation recovery, late responses across account changes, obsolete refreshes,
profile SQL budgets/timestamps/pool return, and diagnostic gating/redaction.

From `frontend/`: `npm run lint`, `npm test`, `tsc -b --noEmit` (local node_modules
binary), and `npm run build`. From `backend/`: Ruff and pytest with the disposable
`TEST_DATABASE_URL` documented in the Phase 2 guide. Use only that test database for
Alembic metadata checks; no destructive live migration is needed by this change.

## Final validation results

- Backend: 48 passed, 0 skipped against disposable PostgreSQL; Ruff passed.
- Frontend: 44 passed across six files; frontend lint and explicit TypeScript checks passed.
- Production build with public placeholder Supabase configuration passed. Development
  timing code was absent from generated production JS even with its flag enabled.
- Alembic check: no new upgrade operations; no migration files changed.
- Git whitespace and tracked-path/credential-pattern checks passed.
- One preexisting Starlette/AnyIO deprecation warning remains; Vitest prints an
  informational jsdom performance hint. No real Supabase latency was benchmarked.

## Changed files

- `.env.example`
- `README.md`
- `backend/app/api/resources.py`
- `backend/app/core/auth.py`
- `backend/app/core/config.py`
- `backend/app/core/performance.py`
- `backend/app/db/models.py`
- `backend/app/db/session.py`
- `backend/app/main.py`
- `backend/tests/conftest.py`
- `backend/tests/test_performance.py`
- `docs/v1-performance.md`
- `frontend/.env.example`
- `frontend/src/app/ConnectedWorkspace.tsx`
- `frontend/src/app/DataProvider.tsx`
- `frontend/src/app/dataContext.ts`
- `frontend/src/features/auth/ProfileForm.tsx`
- `frontend/src/features/courses/CourseManager.tsx`
- `frontend/src/features/tasks/TaskManager.tsx`
- `frontend/src/lib/client.ts`
- `frontend/tests/ApiClient.test.ts`
- `frontend/tests/DataProvider.test.tsx`
- `frontend/tests/IntegratedApp.test.tsx`
