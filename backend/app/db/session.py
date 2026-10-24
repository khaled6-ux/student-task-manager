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
    engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
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
