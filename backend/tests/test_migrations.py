from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text


def test_migration_round_trip_and_metadata_match(pg_engine):
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    with pg_engine.begin() as connection:
        config.attributes['connection'] = connection
        command.check(config)
        assert {'profiles', 'courses', 'tasks'} <= set(inspect(connection).get_table_names())
        rls = connection.execute(text(
            "SELECT relname, relrowsecurity FROM pg_class "
            "WHERE relnamespace = current_schema()::regnamespace "
            "AND relname IN ('profiles', 'courses', 'tasks')"
        )).all()
        assert len(rls) == 3 and all(enabled for _, enabled in rls)
        command.downgrade(config, 'base')
        assert set(inspect(connection).get_table_names()) == {'alembic_version'}
        command.upgrade(config, 'head')
        command.check(config)
