"""Minimal redacted request diagnostics; never log URLs, headers, bodies or SQL."""

import logging
from time import perf_counter
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("student_task_manager.requests")


class RequestDiagnosticsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = uuid4().hex
        start = perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Cache-Control"] = "no-store"
            return response
        finally:
            route = request.scope.get("route")
            template = getattr(route, "path", "<unmatched>")
            method = (
                request.method
                if request.method in {"GET", "POST", "PATCH", "DELETE", "OPTIONS", "HEAD"}
                else "OTHER"
            )
            logger.info(
                "request_id=%s method=%s route=%s status=%s duration_ms=%.2f",
                request_id,
                method,
                template,
                status,
                (perf_counter() - start) * 1000,
            )
