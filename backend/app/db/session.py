from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("Set DATABASE_URL before using database operations")
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def get_db() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
