from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

from app.core.config import get_settings
from app.core.performance import measure

bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_jwks_client(url: str) -> PyJWKClient:
    # Derived from the configured project, never from token-supplied jku/x5u headers.
    return PyJWKClient(url, cache_keys=False, lifespan=300, timeout=5)


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
