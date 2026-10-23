# Local mock workspace UI

Branch: `feat/mock-workspace-ui`, created from preserved Phase 1 commit
`fbbb23c08f04baabbe9bfe86b251ba5970c7354d`. The original foundation branch is unchanged.

Sections represent courses in this skeleton. All coursework data is typed, static,
and local. No authentication, PostgreSQL integration, data writes, or persistence
has been added. The existing optional FastAPI health indicator remains; it only
checks service liveness and does not load coursework. Pages render when it is offline.

## Pages

- `#/`: dashboard with mock task totals, task list, and course links.
- `#/calendar`: October 2026 sample calendar; select dates or move between months.
- `#/sections`: section cards.
- `#/sections/mathematics` (and other fixture IDs): tasks filtered by section.
- Unknown sections/routes display a fallback and return link.

Hash navigation supports direct links and browser back/forward without server
routing configuration or a new routing dependency. No editing controls are provided.
The calendar uses date-only strings and local calendar arithmetic; it has no timezone
conversion. The initial month is deliberately fixed to the mock dataset.

## New files

| File | Purpose |
| --- | --- |
| `frontend/src/app/Workspace.tsx` | Shared layout, hash navigation, optional health diagnostic |
| `frontend/src/types/workspace.ts` | Section, task, and status types |
| `frontend/src/features/tasks/mockData.ts` | Sample courses and dated tasks |
| `frontend/src/components/TaskList.tsx` | Shared list and empty state |
| `frontend/src/features/calendar/Calendar.tsx` | Month navigation, date selection, daily agenda |
| `frontend/src/features/courses/Sections.tsx` | Section list/detail skeleton |
| `frontend/tests/Workspace.test.tsx` | Navigation, calendar filtering, section filtering, fallbacks |
| `docs/mock-workspace-ui.md` | Scope, file inventory, commands, validation |

Updated `App.tsx` to mount the workspace, `Dashboard.tsx` to render fixtures, and
`index.css` for responsive lists, section cards, and a horizontally scrollable
calendar on narrow screens. Updated the existing dashboard test to assert a sample
task rather than the replaced empty state; all four original health outcomes remain.
No dependency changes were necessary.

## Commands

Run the frontend (backend is optional for mock pages):

```sh
cd frontend
npm ci                      # Only if dependencies are missing
npm run dev -- --host 127.0.0.1
```

Validation from the repository root:

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

The production build includes TypeScript checks. Tests use jsdom, not a real browser;
responsive styling is implemented but has not been visually browser-validated.

## Validation results

- Frontend `npm run lint`: passed.
- Frontend `npm test`: 7 tests passed across 2 files (including all 4 prior health outcomes).
- Frontend `npm run build`: TypeScript and Vite production build passed.
- Backend Ruff: passed.
- Backend pytest: 4 passed; one existing Starlette/AnyIO deprecation warning.
- Alembic `heads`: succeeded; no migration revisions are defined.
- `git diff --check`: passed.

An initial frontend validation command ran at the repository root and failed because
there is no root package.json. It was rerun successfully from `frontend/` as documented.
No GitHub commands, push, or pull request were performed for this work.
