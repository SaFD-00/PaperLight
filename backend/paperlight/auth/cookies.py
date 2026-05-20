"""Cookie helpers — Phase 1 S7b.

dev (`APP_ENV=development`) → no `__Host-` prefix + Secure=False (localhost http).
production → `__Host-paperlight_*` + Secure=True (PRD §7.3).
"""

from __future__ import annotations

import os

from fastapi import Response

from paperlight.auth.jwt import ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS

REFRESH_COOKIE_PATH = "/api/auth/refresh"


def _is_production() -> bool:
    return os.environ.get("APP_ENV", "development") == "production"


def _cookie_names() -> tuple[str, str]:
    if _is_production():
        return "__Host-paperlight_at", "__Host-paperlight_rt"
    return "paperlight_at", "paperlight_rt"


ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME = _cookie_names()


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = _is_production()
    access_name, refresh_name = _cookie_names()
    response.set_cookie(
        key=access_name,
        value=access_token,
        max_age=ACCESS_TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=refresh_name,
        value=refresh_token,
        max_age=REFRESH_TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def clear_auth_cookies(response: Response) -> None:
    secure = _is_production()
    access_name, refresh_name = _cookie_names()
    response.delete_cookie(key=access_name, path="/", secure=secure, samesite="lax")
    response.delete_cookie(
        key=refresh_name, path=REFRESH_COOKIE_PATH, secure=secure, samesite="lax"
    )
