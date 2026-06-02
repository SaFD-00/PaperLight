"""Auth API tests — Phase 1 S7b (stub/mock mode + refresh rotation)."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.auth.cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from paperlight.auth.jwt import (
    ACCESS_TTL_SECONDS,
    JWTError,
    decode_token,
    encode_access_token,
)
from paperlight.storage.db import init_db, reset_engine


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


def test_jwt_roundtrip() -> None:
    import time as _t

    issued = int(_t.time())
    token = encode_access_token("user-1", now=issued)
    payload = decode_token(token)
    assert payload["sub"] == "user-1"
    assert payload["typ"] == "access"
    assert payload["exp"] == issued + ACCESS_TTL_SECONDS


def test_jwt_invalid_raises() -> None:
    import pytest

    with pytest.raises(JWTError):
        decode_token("not-a-token")


async def test_mock_login_creates_user_and_sets_cookies(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/dev/mock-login", json={"email": "alice@example.com"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "alice@example.com"
    assert ACCESS_COOKIE_NAME in resp.cookies
    assert REFRESH_COOKIE_NAME in resp.cookies


async def test_login_google_unconfigured_returns_503(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/login/google")
    assert resp.status_code == 503


async def test_me_returns_anonymous_when_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["anonymous"] is True


async def test_me_returns_user_after_login(client: AsyncClient) -> None:
    await client.post("/api/auth/dev/mock-login", json={"email": "bob@example.com"})
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "bob@example.com"
    assert body["anonymous"] is False


async def test_refresh_rotates_jti(client: AsyncClient) -> None:
    await client.post("/api/auth/dev/mock-login", json={"email": "carol@example.com"})
    old_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert old_refresh is not None
    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 200
    new_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert new_refresh is not None
    assert new_refresh != old_refresh


async def test_refresh_reuse_detected(client: AsyncClient) -> None:
    await client.post("/api/auth/dev/mock-login", json={"email": "dave@example.com"})
    first_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    assert first_refresh is not None
    # Rotate once → new refresh now in jar; original `first_refresh` is the revoked one.
    rotated = await client.post("/api/auth/refresh")
    assert rotated.status_code == 200
    # Replay the original refresh token → reuse detection
    client.cookies.set(REFRESH_COOKIE_NAME, first_refresh)
    replay = await client.post("/api/auth/refresh")
    assert replay.status_code == 401


async def test_logout_clears_cookies(client: AsyncClient) -> None:
    await client.post("/api/auth/dev/mock-login", json={"email": "eve@example.com"})
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 204
    # After logout the refresh cookie should be wiped (Max-Age=0)
    assert client.cookies.get(REFRESH_COOKIE_NAME) in (None, "")


async def test_tabs_isolated_per_login(client: AsyncClient) -> None:
    # alice creates a tab under her session
    await client.post("/api/auth/dev/mock-login", json={"email": "alice2@example.com"})
    now = 1_700_000_000_000
    await client.post(
        "/api/tabs",
        json={
            "id": "tabA",
            "paperId": None,
            "title": "A",
            "position": 0,
            "pinned": False,
            "isLibrary": False,
            "openedAt": now,
            "lastActiveAt": now,
            "updatedAt": now,
        },
    )
    # logout & login as bob → he should not see alice's tabs
    await client.post("/api/auth/logout")
    await client.post("/api/auth/dev/mock-login", json={"email": "bob2@example.com"})
    resp = await client.get("/api/tabs")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_login_google_unconfigured_503(
    client: AsyncClient, monkeypatch: "pytest.MonkeyPatch"
) -> None:
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_SECRET", raising=False)
    resp = await client.get("/api/auth/login/google")
    assert resp.status_code == 503


async def test_login_google_configured_returns_authurl(
    client: AsyncClient, monkeypatch: "pytest.MonkeyPatch"
) -> None:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid-123")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "secret-xyz")
    resp = await client.get("/api/auth/login/google")
    assert resp.status_code == 200
    auth_url = resp.json()["authUrl"]
    assert "accounts.google.com" in auth_url
    assert "client_id=cid-123" in auth_url
    assert "state=" in auth_url
    # CSRF state 쿠키가 설정되어야 함
    from paperlight.auth.google import STATE_COOKIE_NAME

    assert STATE_COOKIE_NAME in resp.cookies


async def test_google_callback_state_mismatch_400(
    client: AsyncClient, monkeypatch: "pytest.MonkeyPatch"
) -> None:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid-123")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "secret-xyz")
    # state 쿠키 없이 콜백 호출 → 400
    resp = await client.get("/api/auth/google/callback?code=abc&state=nope")
    assert resp.status_code == 400


async def test_google_callback_creates_user_and_sets_session(
    client: AsyncClient, monkeypatch: "pytest.MonkeyPatch"
) -> None:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid-123")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "secret-xyz")

    # 실제 Google 호출은 막고 identity 를 주입
    from paperlight.auth.google import GoogleIdentity

    async def _fake_exchange(_cfg: object, _code: str) -> GoogleIdentity:
        return GoogleIdentity(sub="google-sub-1", email="gmail-user@example.com")

    import paperlight.api.auth as auth_api

    monkeypatch.setattr(auth_api, "exchange_code", _fake_exchange)

    # 먼저 login 으로 state 쿠키 확보
    login = await client.get("/api/auth/login/google")
    import urllib.parse as _u

    state = _u.parse_qs(_u.urlparse(login.json()["authUrl"]).query)["state"][0]

    resp = await client.get(
        f"/api/auth/google/callback?code=abc&state={state}", follow_redirects=False
    )
    assert resp.status_code == 302
    assert ACCESS_COOKIE_NAME in resp.cookies
    assert REFRESH_COOKIE_NAME in resp.cookies

    # 발급된 세션으로 /me 조회 → 가입된 gmail 사용자
    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "gmail-user@example.com"
