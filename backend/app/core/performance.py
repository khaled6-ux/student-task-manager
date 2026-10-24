"""Opt-in development diagnostics. Never record identities, tokens, SQL, or parameters."""

import logging
from contextlib import contextmanager
from contextvars import ContextVar
from time import perf_counter

from sqlalchemy import event
from starlette.middleware.base import BaseHTTPMiddleware

metrics: ContextVar[dict | None] = ContextVar("request_performance", default=None)
logger = logging.getLogger("student_task_manager.performance")


@contextmanager
def measure(name: str):
    values = metrics.get()
    if values is None:
        yield
        return
    start = perf_counter()
    try:
        yield
    finally:
        values[name] = values.get(name, 0.0) + (perf_counter() - start) * 1000


def instrument_engine(engine):
    def before(conn, cursor, statement, parameters, context, executemany):
        if metrics.get() is not None:
            context._performance_start = perf_counter()

    def after(conn, cursor, statement, parameters, context, executemany):
        values = metrics.get()
        start = getattr(context, "_performance_start", None)
        if values is not None and start is not None:
            values["db"] = values.get("db", 0.0) + (perf_counter() - start) * 1000
            values["queries"] = values.get("queries", 0) + 1

    event.listen(engine, "before_cursor_execute", before)
    event.listen(engine, "after_cursor_execute", after)


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        values = {}
        token = metrics.set(values)
        start = perf_counter()
        try:
            response = await call_next(request)
            values["app"] = (perf_counter() - start) * 1000
            names = ["app", "auth_key", "jwt", "db_acquire", "db"]
            response.headers["Server-Timing"] = ", ".join(
                f"{name};dur={values.get(name, 0):.2f}" for name in names
            )
            route = request.scope.get("route")
            # A matched template is safe; raw URLs, queries and IDs are never logged.
            logger.info(
                "perf method=%s route=%s status=%s timings_ms=%s queries=%s",
                request.method,
                getattr(route, "path", "<unmatched>"),
                response.status_code,
                {name: round(values.get(name, 0), 2) for name in names},
                values.get("queries", 0),
            )
            return response
        finally:
            metrics.reset(token)
