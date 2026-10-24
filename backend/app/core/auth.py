from functools import lru_cache
from threading import Lock
from time import monotonic
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

from app.core.config import get_settings
from app.core.performance import measure

bearer = HTTPBearer(auto_error=False)


class BoundedJWKClient(PyJWKClient):
    """Coalesce cold fetches and cap unknown-kid/outage refreshes per worker.

    Never extends the JWKS cache TTL or accepts an unknown key. New rotations can
    take up to ten seconds to become visible after a refresh.
    """

    def __init__(self, url: str):
        super().__init__(url, cache_keys=False, lifespan=300, timeout=5, cooldown_duration=10)
        self._fetch_lock = Lock()
        self._retry_at = 0.0

    def fetch_data(self):
        with self._fetch_lock:
            now = monotonic()
            if now < self._retry_at:
                cached = self.jwk_set_cache.get() if self.jwk_set_cache else None
                if cached is not None:
                    return cached
                raise PyJWKClientConnectionError("JWKS refresh temporarily unavailable")
            self._retry_at = now + 10
            return super().fetch_data()


@lru_cache
def get_jwks_client(url: str) -> PyJWKClient:
    # Derived from the configured project, never from token-supplied jku/x5u headers.
    return BoundedJWKClient(url)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or missing access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise unauthorized
    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    try:
        if len(credentials.credentials) > 16384:
            raise unauthorized
        header = jwt.get_unverified_header(credentials.credentials)
        if (
            header.get("alg") not in {"ES256", "RS256"}
            or not isinstance(header.get("kid"), str)
            or not 1 <= len(header["kid"]) <= 128
        ):
            raise unauthorized
    except (PyJWTError, TypeError, ValueError):
        raise unauthorized from None
    issuer = settings.supabase_url.rstrip("/") + "/auth/v1"
    try:
        with measure("auth_key"):
            key = (
                get_jwks_client(issuer + "/.well-known/jwks.json")
                .get_signing_key_from_jwt(credentials.credentials)
                .key
            )
        with measure("jwt"):
            claims = jwt.decode(
                credentials.credentials,
                key,
                algorithms=["ES256", "RS256"],
                audience=settings.supabase_jwt_audience,
                issuer=issuer,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
        return UUID(claims["sub"])
    except PyJWKClientConnectionError as exc:
        raise HTTPException(status_code=503, detail="Authentication provider unavailable") from exc
    except (PyJWTError, ValueError, TypeError, KeyError) as exc:
        raise unauthorized from exc
