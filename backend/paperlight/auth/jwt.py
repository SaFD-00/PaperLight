"""JWT helpers — HS256, access(15m) + refresh(30d).

PRD §7.3: Access Token 15분 + Refresh Token 30일 (rotation).
"""

from __future__ import annotations

import os
import time
from typing import Any

from jose import JWTError as _JoseJWTError
from jose import jwt

_ALGORITHM = "HS256"
_DEV_SECRET_FALLBACK = "dev-secret-do-not-use-in-production"

ACCESS_TTL_SECONDS = 15 * 60
REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60


class JWTError(Exception):
    """Wrapper to keep callers free of python-jose imports."""


def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if secret and secret != "change-me-in-production":
        return secret
    app_env = os.environ.get("APP_ENV", "development")
    if app_env == "development":
        return _DEV_SECRET_FALLBACK
    raise RuntimeError("JWT_SECRET must be set in non-development environments")


def _now() -> int:
    return int(time.time())


def encode_access_token(sub: str, *, now: int | None = None) -> str:
    issued = now if now is not None else _now()
    payload = {
        "sub": sub,
        "typ": "access",
        "iat": issued,
        "exp": issued + ACCESS_TTL_SECONDS,
    }
    return jwt.encode(payload, _get_secret(), algorithm=_ALGORITHM)


def encode_refresh_token(
    sub: str, jti: str, family: str, *, now: int | None = None
) -> str:
    issued = now if now is not None else _now()
    payload = {
        "sub": sub,
        "typ": "refresh",
        "jti": jti,
        "family": family,
        "iat": issued,
        "exp": issued + REFRESH_TTL_SECONDS,
    }
    return jwt.encode(payload, _get_secret(), algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _get_secret(), algorithms=[_ALGORITHM])
    except _JoseJWTError as exc:
        raise JWTError(str(exc)) from exc
