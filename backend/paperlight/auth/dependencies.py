"""FastAPI auth dependencies — Phase 1 S7b.

Resolution order for the active user_id:
1. JWT access cookie (`paperlight_at` / `__Host-paperlight_at`) — set on login
2. `X-User-Id` header — test-only bridge, kept for Phase 0 regression
3. `DEFAULT_USER_ID` (`anonymous`) — guest fallback
"""

from __future__ import annotations

from typing import Annotated

import sentry_sdk
from fastapi import Cookie, Header

from paperlight.auth.cookies import ACCESS_COOKIE_NAME
from paperlight.auth.jwt import JWTError, decode_token
from paperlight.observability.context import user_id_var
from paperlight.storage.db import DEFAULT_USER_ID


def _record_user(user_id: str) -> str:
    user_id_var.set(user_id)
    sentry_sdk.set_user({"id": user_id})
    return user_id


async def get_user_id(
    paperlight_at: Annotated[str | None, Cookie(alias=ACCESS_COOKIE_NAME)] = None,
    x_user_id: Annotated[str | None, Header()] = None,
) -> str:
    if paperlight_at:
        try:
            payload = decode_token(paperlight_at)
        except JWTError:
            payload = None
        if payload is not None and payload.get("typ") == "access":
            sub = payload.get("sub")
            if isinstance(sub, str) and sub:
                return _record_user(sub)
    if x_user_id:
        return _record_user(x_user_id)
    return _record_user(DEFAULT_USER_ID)
