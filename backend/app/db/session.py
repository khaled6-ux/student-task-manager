from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.performance import instrument_engine, measure


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("Set DATABASE_URL before using database operations")
    settings = get_settings()
    settings.validate_runtime()
    engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=5,
        connect_args={
            "connect_timeout": settings.db_connect_timeout_seconds,
            "options": (
                f"-c statement_timeout={settings.db_statement_timeout_ms} "
                f"-c lock_timeout={settings.db_lock_timeout_ms} "
                "-c idle_in_transaction_session_timeout=15000"
            ),
        },
    )
    if get_settings().performance_enabled:
        instrument_engine(engine)
    return engine


def get_db() -> Iterator[Session]:
    if not get_settings().database_url:
        raise HTTPException(status_code=503, detail="Database is not configured")
    with Session(get_engine(), expire_on_commit=False) as session:
        if get_settings().performance_enabled:
            with measure("db_acquire"):
                session.connection()
        yield session
