from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt.exceptions import PyJWKClientConnectionError

from app.core import auth
from app.core.config import Settings


def credentials(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_valid_identity(tokens):
    user = uuid4()
    assert auth.current_user(credentials(tokens(user))) == user


@pytest.mark.parametrize(
    "changes",
    [
        {"exp": 1},
        {"aud": "another-project"},
        {"iss": "https://evil.example/auth/v1"},
        {"sub": "not-a-uuid"},
        {"iat": 9999999999},
        {"exp": None},
    ],
)
def test_reject_invalid_claims(tokens, changes):
    with pytest.raises(HTTPException) as result:
        auth.current_user(credentials(tokens(uuid4(), **changes)))
    assert result.value.status_code == 401


def test_reject_malformed_and_missing_tokens(tokens):
    for token in [None, credentials("not-a-jwt")]:
        with pytest.raises(HTTPException) as result:
            auth.current_user(token)
        assert result.value.status_code == 401


def test_reject_bad_signature_and_algorithm(tokens):
    from cryptography.hazmat.primitives.asymmetric import ec

    valid = tokens(uuid4())
    claims = jwt.decode(valid, options={"verify_signature": False})
    other = ec.generate_private_key(ec.SECP256R1())
    for token in [
        jwt.encode(claims, other, algorithm="ES256"),
        jwt.encode(claims, "test-only-not-a-real-secret-value", algorithm="HS256"),
    ]:
        with pytest.raises(HTTPException) as result:
            auth.current_user(credentials(token))
        assert result.value.status_code == 401


def test_missing_config(monkeypatch):
    monkeypatch.setattr(auth, "get_settings", lambda: Settings(_env_file=None, supabase_url=None))
    with pytest.raises(HTTPException) as result:
        auth.current_user(credentials("token"))
    assert result.value.status_code == 503


def test_jwks_unavailable(tokens, monkeypatch):
    def unavailable(url):
        raise PyJWKClientConnectionError("unavailable")

    monkeypatch.setattr(auth, "get_jwks_client", unavailable)
    with pytest.raises(HTTPException) as result:
        auth.current_user(credentials(tokens(uuid4())))
    assert result.value.status_code == 503
