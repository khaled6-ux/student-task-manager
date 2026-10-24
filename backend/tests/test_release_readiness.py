import io
import json
import logging
from types import SimpleNamespace
from urllib.error import URLError

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.api import health
from app.core import auth
from app.core.config import Settings
from app.core.operations import RequestDiagnosticsMiddleware
from app.db.session import get_db
from app.main import app


def production(**changes):
    return Settings(
        _env_file=None,
        **(
            {
                "app_env": "production",
                "database_url": "postgresql+psycopg://runtime:synthetic-password@db.example/tasks"
                "?sslmode=verify-full&sslrootcert=/test/ca.pem",
                "supabase_url": "https://project.example",
                "cors_origins": ["https://app.example"],
            }
            | changes
        ),
    )


def test_production_accepts_verified_tls_and_hides_password():
    production().validate_runtime()
    assert "synthetic-password" not in repr(production())


@pytest.mark.parametrize(
    "changes",
    [
        {"database_url": None},
        {"supabase_url": None},
        {"database_url": "postgresql+psycopg://user:private-value@host/db?sslmode=require"},
        {"database_url": "not-a-url-private-value"},
        {"cors_origins": ["http://localhost:5173"]},
        {"cors_origins": []},
        {"supabase_jwt_audience": "anon"},
    ],
)
def test_production_fails_closed_without_config_values_in_errors(changes):
    with pytest.raises(RuntimeError) as caught:
        production(**changes).validate_runtime()
    assert "private-value" not in str(caught.value)


@pytest.mark.parametrize(
    "origin",
    ["*", "https://*.example", "https://app.example/", "https://user:private-value@app.example"],
)
def test_cors_rejects_non_origins_without_echoing_credentials(origin):
    with pytest.raises(ValueError) as caught:
        production(cors_origins=[origin])
    assert "private-value" not in str(caught.value)


def jwks(kid):
    private = ec.generate_private_key(ec.SECP256R1())
    key = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    return {"keys": [key | {"kid": kid, "use": "sig", "alg": "ES256"}]}


def test_unknown_kids_cannot_force_fetches_and_rotation_recovers(monkeypatch):
    clock, data, calls = [100.0], [jwks("old")], []
    monkeypatch.setattr(auth, "monotonic", lambda: clock[0])

    def fetch(*args, **kwargs):
        calls.append(True)
        return io.BytesIO(json.dumps(data[0]).encode())

    monkeypatch.setattr("urllib.request.build_opener", lambda *a: SimpleNamespace(open=fetch))
    client = auth.BoundedJWKClient("https://project.example/jwks")
    assert client.get_signing_key("old").key_id == "old"
    data[0] = jwks("new")
    for i in range(30):
        with pytest.raises(jwt.PyJWKClientError):
            client.get_signing_key(f"unknown-{i}")
    assert len(calls) == 1
    clock[0] += 11
    client._last_successful_fetch -= 11
    assert client.get_signing_key("new").key_id == "new"
    assert len(calls) == 2


def test_jwks_outage_is_backed_off_and_recovers(monkeypatch):
    calls, clock = [], [100.0]
    monkeypatch.setattr(auth, "monotonic", lambda: clock[0])

    def unavailable(*args, **kwargs):
        calls.append(True)
        raise URLError("synthetic outage")

    monkeypatch.setattr("urllib.request.build_opener", lambda *a: SimpleNamespace(open=unavailable))
    client = auth.BoundedJWKClient("https://project.example/jwks")
    for _ in range(10):
        with pytest.raises(jwt.PyJWKClientConnectionError):
            client.get_signing_key("unknown")
    assert len(calls) == 1
    clock[0] += 11
    data = jwks("recovered")
    monkeypatch.setattr(
        "urllib.request.build_opener",
        lambda *a: SimpleNamespace(open=lambda *a, **k: io.BytesIO(json.dumps(data).encode())),
    )
    assert client.get_signing_key("recovered").key_id == "recovered"


def test_invalid_headers_never_fetch_jwks(monkeypatch):
    import base64

    monkeypatch.setattr(auth, "get_settings", lambda: production())
    monkeypatch.setattr(auth, "get_jwks_client", lambda url: pytest.fail("must not fetch JWKS"))
    for header in [{"alg": "HS256", "kid": "x"}, {"alg": "ES256", "kid": "x" * 129}]:
        encoded = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
        token = auth.HTTPAuthorizationCredentials(scheme="Bearer", credentials=encoded + ".e30.sig")
        with pytest.raises(auth.HTTPException) as caught:
            auth.current_user(token)
        assert caught.value.status_code == 401


def test_readiness_is_read_only_and_liveness_independent(monkeypatch):
    monkeypatch.setattr(
        health, "get_settings", lambda: SimpleNamespace(supabase_url="https://project.example")
    )
    calls = []

    def db():
        yield SimpleNamespace(execute=lambda sql: calls.append(str(sql)))

    app.dependency_overrides[get_db] = db
    try:
        client = TestClient(app)
        assert client.get("/health").status_code == 200 and not calls
        assert client.get("/ready").json() == {"status": "ok"}
        assert calls == ["SELECT 1"]
    finally:
        app.dependency_overrides.pop(get_db)


def test_readiness_outage_does_not_leak_driver_details(monkeypatch):
    monkeypatch.setattr(
        health, "get_settings", lambda: SimpleNamespace(supabase_url="https://project.example")
    )

    def fail(sql):
        raise OperationalError("private SQL", {}, Exception("private password"))

    def db():
        yield SimpleNamespace(execute=fail)

    app.dependency_overrides[get_db] = db
    try:
        result = TestClient(app).get("/ready")
        assert result.status_code == 503 and "private" not in result.text
        assert TestClient(app).get("/health").status_code == 200
    finally:
        app.dependency_overrides.pop(get_db)


def test_database_errors_and_request_logs_are_redacted(caplog):
    @app.get("/test-release-db-error/{value}")
    def fail(value: str):
        raise OperationalError("private SQL", {}, Exception("private password"))

    try:
        with caplog.at_level(logging.INFO, logger="student_task_manager.requests"):
            response = TestClient(app).get(
                "/test-release-db-error/private-id?secret=private-query",
                headers={
                    "Authorization": "Bearer private-token",
                    "X-Request-ID": "private-spoof",
                },
            )
        assert response.status_code == 503
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert len(response.headers["x-request-id"]) == 32
        logs = "\n".join(record.message for record in caplog.records)
        assert "/test-release-db-error/{value}" in logs
        for value in [
            "private-id",
            "private-query",
            "private-token",
            "private-spoof",
            "private SQL",
            "private password",
        ]:
            assert value not in response.text + logs
    finally:
        app.router.routes.pop()


def test_readiness_with_isolated_postgres(client, monkeypatch):
    monkeypatch.setattr(
        health, "get_settings", lambda: SimpleNamespace(supabase_url="https://project.example")
    )
    assert client.get("/ready").status_code == 200


def test_unknown_urls_and_headers_are_not_logged(caplog):
    isolated = FastAPI()
    isolated.add_middleware(RequestDiagnosticsMiddleware)
    with caplog.at_level(logging.INFO, logger="student_task_manager.requests"):
        a = TestClient(isolated).get("/private-unknown-path")
        b = TestClient(isolated).get("/other-private-path")
    assert a.headers["x-request-id"] != b.headers["x-request-id"]
    assert "private" not in "\n".join(record.message for record in caplog.records)


def test_lifespan_rejects_invalid_production_before_serving(monkeypatch):
    import importlib

    main = importlib.import_module("app.main")
    monkeypatch.setattr(main, "settings", production(database_url=None))
    with pytest.raises(RuntimeError, match="Production requires"):
        with TestClient(main.app):
            pytest.fail("Invalid production configuration must not start")


def test_engine_factory_applies_bounded_connection_and_query_waits(monkeypatch):
    from app.db import session as sessions

    settings = Settings(
        _env_file=None, app_env="test", database_url="postgresql+psycopg://student@localhost/test"
    )
    captured = {}

    def factory(url, **kwargs):
        captured.update(kwargs)
        return object()

    sessions.get_engine.cache_clear()
    monkeypatch.setattr(sessions, "get_settings", lambda: settings)
    monkeypatch.setattr(sessions, "create_engine", factory)
    try:
        sessions.get_engine()
        assert captured["pool_timeout"] == 5
        assert captured["connect_args"]["connect_timeout"] == 5
        assert "statement_timeout=10000" in captured["connect_args"]["options"]
        assert "lock_timeout=3000" in captured["connect_args"]["options"]
    finally:
        sessions.get_engine.cache_clear()
