from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter()


class HealthResponse(BaseModel):
    status: str


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Liveness only; does not imply database connectivity."""
    return HealthResponse(status="ok")


@router.get("/ready", tags=["health"], response_model=HealthResponse)
def ready(db: Session = Depends(get_db)):
    """Read-only DB reachability; JWKS/OAuth/provider status is not probed here."""
    if not get_settings().supabase_url:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return HealthResponse(status="ok")
