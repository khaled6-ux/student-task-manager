from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: Literal["development", "test", "production"] = "production"
    dev_performance_timing: bool = False
    app_name: str = "Student Task Manager"
    database_url: str | None = Field(default=None, repr=False)
    supabase_url: str | None = None
    supabase_jwt_audience: str = "authenticated"
    cors_origins: list[str] = ["http://localhost:5173"]
    db_connect_timeout_seconds: int = Field(default=5, ge=1, le=30)
    db_statement_timeout_ms: int = Field(default=10000, ge=1000, le=60000)
    db_lock_timeout_ms: int = Field(default=3000, ge=100, le=10000)
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
        hide_input_in_errors=True,
    )

    def validate_runtime(self) -> None:
        """Fail before serving production traffic; errors never include config values."""
        from sqlalchemy.engine import make_url

        if self.app_env != "production":
            return
        if not self.database_url or not self.supabase_url:
            raise RuntimeError("Production requires DATABASE_URL and SUPABASE_URL")
        try:
            url = make_url(self.database_url)
            safe_database = (
                url.drivername == "postgresql+psycopg"
                and bool(url.host)
                and bool(url.database)
                and url.query.get("sslmode") == "verify-full"
                and bool(url.query.get("sslrootcert"))
            )
        except Exception:
            safe_database = False
        if not safe_database:
            raise RuntimeError(
                "Production requires PostgreSQL psycopg with verify-full and sslrootcert"
            )
        from urllib.parse import urlsplit

        if not self.cors_origins or any(
            urlsplit(origin).scheme != "https"
            or urlsplit(origin).hostname in {"localhost", "127.0.0.1", "::1"}
            for origin in self.cors_origins
        ):
            raise RuntimeError("Production requires explicit HTTPS CORS origins")
        if self.supabase_jwt_audience != "authenticated":
            raise RuntimeError("Production requires the authenticated Supabase audience")

    @field_validator("cors_origins")
    @classmethod
    def exact_origins(cls, origins):
        from urllib.parse import urlsplit

        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
            ):
                raise ValueError("CORS origins must be exact origins without paths or wildcards")
        return origins

    @property
    def performance_enabled(self) -> bool:
        return self.app_env == "development" and self.dev_performance_timing

    @field_validator("supabase_url")
    @classmethod
    def https_project_url(cls, value):
        if value is not None:
            from urllib.parse import urlsplit

            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or parsed.path not in ("", "/")
            ):
                raise ValueError("SUPABASE_URL must be an HTTPS project origin")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
