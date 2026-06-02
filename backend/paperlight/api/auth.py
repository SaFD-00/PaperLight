"""Auth API — Phase 1 S7b (stub/mock 모드).

PRD §7.3: Google OAuth 2.0 + JWT access(15m) + refresh(30d) with rotation.
Real Google OAuth integration deferred until client credentials are provisioned.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.auth import (
    REFRESH_COOKIE_NAME,
    REFRESH_TTL_SECONDS,
    JWTError,
    clear_auth_cookies,
    decode_token,
    encode_access_token,
    encode_refresh_token,
    set_auth_cookies,
)
from paperlight.auth.dependencies import get_user_id
from paperlight.auth.google import (
    STATE_COOKIE_NAME,
    STATE_COOKIE_PATH,
    STATE_TTL_SECONDS,
    GoogleOAuthError,
    build_auth_url,
    exchange_code,
    google_config,
    post_login_redirect,
)
from paperlight.models import Session as SessionRow
from paperlight.models import User
from paperlight.storage.db import DEFAULT_USER_ID, get_session

router = APIRouter(prefix="/api/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]


def _now_ms() -> int:
    return int(time.time() * 1000)


def _now_s() -> int:
    return int(time.time())


def _mock_login_allowed() -> bool:
    if os.environ.get("APP_ENV", "development") == "development":
        return True
    return os.environ.get("PAPERLIGHT_ALLOW_MOCK_LOGIN") == "1"


def _user_dict(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "default_content_language": user.default_content_language,
        "density": user.density,
        "theme": user.theme,
    }


async def _issue_session(
    response: Response,
    session: AsyncSession,
    user_id: str,
    family_id: str | None = None,
) -> None:
    """Issue access+refresh cookies and persist refresh JTI into sessions table."""
    jti = str(uuid.uuid4())
    family = family_id or str(uuid.uuid4())
    issued_s = _now_s()
    access = encode_access_token(user_id, now=issued_s)
    refresh = encode_refresh_token(user_id, jti=jti, family=family, now=issued_s)
    session.add(
        SessionRow(
            jti=jti,
            user_id=user_id,
            family_id=family,
            expires_at=(issued_s + REFRESH_TTL_SECONDS) * 1000,
        )
    )
    await session.commit()
    set_auth_cookies(response, access, refresh)


class MockLoginBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=320, pattern=r".+@.+\..+")
    name: str | None = Field(default=None, max_length=120)


@router.post("/dev/mock-login")
async def mock_login(
    body: MockLoginBody, response: Response, session: SessionDep
) -> dict[str, object]:
    if not _mock_login_allowed():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalars().first()
    if user is None:
        user = User(id=str(uuid.uuid4()), email=body.email, google_sub=None)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    await _issue_session(response, session, user.id)
    return _user_dict(user)


def _is_production() -> bool:
    return os.environ.get("APP_ENV", "development") == "production"


@router.get("/login/google")
async def login_google(response: Response) -> dict[str, str]:
    """authUrl 발급 + CSRF state 쿠키 설정. 미구성이면 503(프론트가 안내)."""
    cfg = google_config()
    if cfg is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google OAuth not configured — use POST /api/auth/dev/mock-login",
        )
    state = str(uuid.uuid4())
    response.set_cookie(
        key=STATE_COOKIE_NAME,
        value=state,
        max_age=STATE_TTL_SECONDS,
        httponly=True,
        secure=_is_production(),
        samesite="lax",
        path=STATE_COOKIE_PATH,
    )
    return {"authUrl": build_auth_url(cfg, state)}


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    session: SessionDep,
    oauth_state: Annotated[str | None, Cookie(alias=STATE_COOKIE_NAME)] = None,
) -> RedirectResponse:
    """Google redirect → code 교환 → 사용자 upsert → 세션 발급 → 프론트로 리다이렉트."""
    cfg = google_config()
    if cfg is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google OAuth not configured")
    if not oauth_state or oauth_state != state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid oauth state")

    try:
        identity = await exchange_code(cfg, code)
    except GoogleOAuthError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"google oauth failed: {exc}") from exc

    # google_sub 우선 매칭 → 없으면 email 로 기존 계정 연결 → 둘 다 없으면 신규.
    user = (
        await session.execute(select(User).where(User.google_sub == identity.sub))
    ).scalars().first()
    if user is None:
        user = (
            await session.execute(select(User).where(User.email == identity.email))
        ).scalars().first()
        if user is not None:
            user.google_sub = identity.sub
        else:
            user = User(id=str(uuid.uuid4()), email=identity.email, google_sub=identity.sub)
            session.add(user)
        await session.commit()
        await session.refresh(user)

    redirect = RedirectResponse(post_login_redirect(), status_code=status.HTTP_302_FOUND)
    await _issue_session(redirect, session, user.id)
    redirect.delete_cookie(
        key=STATE_COOKIE_NAME, path=STATE_COOKIE_PATH, secure=_is_production(), samesite="lax"
    )
    return redirect


@router.post("/refresh")
async def refresh(
    response: Response,
    session: SessionDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> dict[str, str]:
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no refresh cookie")
    try:
        payload = decode_token(refresh_token)
    except JWTError as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, f"invalid refresh token: {exc}"
        ) from exc
    if payload.get("typ") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token type")
    jti = payload.get("jti")
    family = payload.get("family")
    sub = payload.get("sub")
    if not (isinstance(jti, str) and isinstance(family, str) and isinstance(sub, str)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "malformed refresh token")
    row = await session.get(SessionRow, jti)
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown session")
    if row.revoked_at is not None:
        # Reuse detected → revoke the whole family
        await session.execute(
            update(SessionRow)
            .where(SessionRow.family_id == row.family_id, SessionRow.revoked_at.is_(None))
            .values(revoked_at=_now_ms())
        )
        await session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh reuse detected")
    row.revoked_at = _now_ms()
    await session.commit()
    await _issue_session(response, session, sub, family_id=family)
    return {"status": "ok"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    session: SessionDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
) -> None:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti")
            if isinstance(jti, str):
                row = await session.get(SessionRow, jti)
                if row is not None and row.revoked_at is None:
                    row.revoked_at = _now_ms()
                    await session.commit()
        except JWTError:
            pass
    clear_auth_cookies(response)


@router.get("/me")
async def me(session: SessionDep, user_id: UserDep) -> dict[str, object]:
    user = await session.get(User, user_id)
    if user is None:
        # `anonymous` row is auto-created by storage.db._ensure_default_user.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return {**_user_dict(user), "anonymous": user.id == DEFAULT_USER_ID}
