from alembic import context

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_engine

# Import future model modules here so their tables enter Base.metadata.
target_metadata = Base.metadata

if context.is_offline_mode():
    url = get_settings().database_url
    if not url:
        raise RuntimeError("Set DATABASE_URL before running migrations")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with get_engine().connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
