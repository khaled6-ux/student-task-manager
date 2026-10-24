from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.resources import router as resources_router
from app.core.config import get_settings
from app.core.performance import PerformanceMiddleware

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
    expose_headers=["Server-Timing"] if settings.performance_enabled else [],
)
app.include_router(health_router)
app.include_router(resources_router)

if settings.performance_enabled:
    app.add_middleware(PerformanceMiddleware)
