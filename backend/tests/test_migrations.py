from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text


def test_migration_round_trip_and_metadata_match(pg_engine):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with pg_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.check(config)
        assert {"profiles", "courses", "tasks"} <= set(inspect(connection).get_table_names())
        rls = connection.execute(
            text(
                "SELECT relname, relrowsecurity FROM pg_class "
                "WHERE relnamespace = current_schema()::regnamespace "
                "AND relname IN ('profiles', 'courses', 'tasks')"
            )
        ).all()
        assert len(rls) == 3 and all(enabled for _, enabled in rls)
        command.downgrade(config, "base")
        assert set(inspect(connection).get_table_names()) == {"alembic_version"}
        command.upgrade(config, "head")
        command.check(config)


def test_category_migration_backfills_and_preserves_existing_tasks(pg_engine):
    from uuid import uuid4

    user, task = uuid4(), uuid4()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with pg_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "9c23764cdb81")
        connection.execute(text("INSERT INTO profiles (id) VALUES (:id)"), {"id": user})
        connection.execute(
            text("INSERT INTO tasks (id, user_id, title) VALUES (:id, :user, :title)"),
            {"id": task, "user": user, "title": "Preserved"},
        )
        command.upgrade(config, "head")
        assert (
            connection.execute(
                text("SELECT category FROM tasks WHERE id=:id"), {"id": task}
            ).scalar_one()
            == "homeworks"
        )
        command.downgrade(config, "9c23764cdb81")
        assert (
            connection.execute(
                text("SELECT title FROM tasks WHERE id=:id"), {"id": task}
            ).scalar_one()
            == "Preserved"
        )
        command.upgrade(config, "head")
        connection.execute(text("DELETE FROM profiles WHERE id=:id"), {"id": user})
