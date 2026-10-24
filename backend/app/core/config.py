from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: Literal["development", "test", "production"] = "production"
    dev_performance_timing: bool = False
    app_name: str = "Student Task Manager"
    database_url: str | None = None
    supabase_url: str | None = None
    supabase_jwt_audience: str = "authenticated"
    cors_origins: list[str] = ["http://localhost:5173"]
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )

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
