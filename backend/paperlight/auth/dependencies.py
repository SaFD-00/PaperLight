"""FastAPI auth dependencies — Phase 1 S7b.

Resolution order for the active user_id:
1. JWT access cookie (`paperlight_at` / `__Host-paperlight_at`) — set on login
2. `X-User-Id` header — test-only bridge, kept for Phase 0 regression
3. `DEFAULT_USER_ID` (`anonymous`) — guest fallback
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Header

from paperlight.auth.cookies import ACCESS_COOKIE_NAME
from paperlight.auth.jwt import JWTError, decode_token
from paperlight.storage.db import DEFAULT_USER_ID


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
                return sub
    if x_user_id:
        return x_user_id
    return DEFAULT_USER_ID
