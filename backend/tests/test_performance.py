"""Round-trip budgets against disposable PostgreSQL; no production latency claims."""

import logging
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text

from app.core.config import Settings
from app.core.performance import PerformanceMiddleware, instrument_engine, measure
from app.db import session as sessions


def test_data_statement_budgets(client, db, tokens):
    headers = {"Authorization": "Bearer " + tokens(uuid4())}
    assert client.get("/api/v1/me", headers=headers).status_code == 200
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        operation = statement.split()[0].upper()
        # SAVEPOINT/RELEASE belong to test transaction isolation, not application queries.
        if operation in {"SELECT", "INSERT", "UPDATE", "DELETE"}:
            statements.append(operation)

    event.listen(db.bind, "before_cursor_execute", record)
    try:
        assert client.get("/api/v1/me", headers=headers).status_code == 200
        assert statements == ["SELECT"]
        print("warm profile data statements:", len(statements))
        statements.clear()
        course = client.post("/api/v1/courses", headers=headers, json={"name": "Measured"})
        assert course.status_code == 201
        assert statements == ["SELECT", "INSERT"]
        print("create course data statements:", len(statements))
        statements.clear()
        updated = client.patch(
            "/api/v1/courses/" + course.json()["id"], headers=headers, json={"name": "Updated"}
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated"
        assert statements == ["SELECT", "UPDATE"]
        print("update course data statements:", len(statements))
    finally:
        event.remove(db.bind, "before_cursor_execute", record)


def test_updated_timestamp_returned_without_postcommit_refresh(client, db, tokens):
    headers = {"Authorization": "Bearer " + tokens(uuid4())}
    item = client.post("/api/v1/tasks", headers=headers, json={"title": "Timestamp"}).json()
    db.execute(
        text("UPDATE tasks SET updated_at='2000-01-01T00:00:00Z' WHERE id=:id"), {"id": item["id"]}
    )
    db.expire_all()
    updated = client.patch(
        "/api/v1/tasks/" + item["id"], headers=headers, json={"title": "Changed"}
    )
    assert updated.status_code == 200
    assert not updated.json()["updated_at"].startswith("2000")
    assert updated.json()["created_at"] == item["created_at"]


def test_request_session_returns_connection_to_pool(pg_engine, monkeypatch):
    monkeypatch.setattr(sessions, "get_engine", lambda: pg_engine)
    monkeypatch.setattr(
        sessions,
        "get_settings",
        lambda: SimpleNamespace(
            database_url="test-only",
            performance_enabled=False,
        ),
    )
    provider = sessions.get_db()
    db = next(provider)
    assert db.expire_on_commit is False
    db.execute(text("SELECT 1"))
    assert pg_engine.pool.checkedout() == 1
    provider.close()
    assert pg_engine.pool.checkedout() == 0


def test_performance_disabled_by_default_and_in_production():
    assert not Settings(_env_file=None).performance_enabled
    assert not Settings(
        _env_file=None, app_env="production", dev_performance_timing=True
    ).performance_enabled
    assert Settings(
        _env_file=None, app_env="development", dev_performance_timing=True
    ).performance_enabled


def test_opt_in_metrics_do_not_log_sql_values_or_request_secrets(caplog):
    engine = create_engine("sqlite://")
    instrument_engine(engine)
    app = FastAPI()
    app.add_middleware(PerformanceMiddleware)

    @app.get("/items/{item_id}")
    def item(item_id: str):
        with measure("jwt"):
            with engine.connect() as connection:
                connection.execute(text("SELECT :value"), {"value": "sensitive-parameter"})
        return {"ok": True}

    with caplog.at_level(logging.INFO, logger="student_task_manager.performance"):
        response = TestClient(app).get(
            "/items/private-id?password=private-query",
            headers={"Authorization": "Bearer private-test-token"},
        )
    assert response.status_code == 200
    assert "app;dur=" in response.headers["server-timing"]
    assert "db;dur=" in response.headers["server-timing"]
    logged = "\n".join(
        record.message
        for record in caplog.records
        if record.name == "student_task_manager.performance"
    )
    assert "/items/{item_id}" in logged
    assert "queries=1" in logged
    for private in [
        "private-id",
        "private-query",
        "private-test-token",
        "sensitive-parameter",
        "SELECT",
        "Authorization",
    ]:
        assert private not in logged
    engine.dispose()


def test_profile_provisioning_falls_back_safely_when_row_already_exists(db):
    from app.api.resources import provision_profile
    from app.db.models import Profile

    user = uuid4()
    db.add(Profile(id=user, display_name="Existing"))
    db.flush()
    item = provision_profile(db, user)
    assert item.id == user
    assert item.display_name == "Existing"
