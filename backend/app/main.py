from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.health import router as health_router
from app.api.resources import router as resources_router
from app.core.config import get_settings
from app.core.operations import RequestDiagnosticsMiddleware
from app.core.performance import PerformanceMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)


@app.exception_handler(SQLAlchemyError)
async def database_unavailable(request, exc):
    # Driver errors can contain connection strings, SQL and user content.
    return JSONResponse(status_code=503, content={"detail": "Database temporarily unavailable"})


app.add_middleware(RequestDiagnosticsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"] + (["Server-Timing"] if settings.performance_enabled else []),
)
app.include_router(health_router)
app.include_router(resources_router)

if settings.performance_enabled:
    app.add_middleware(PerformanceMiddleware)
