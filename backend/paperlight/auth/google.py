"""Google OAuth 2.0 (authorization-code flow) — PRD §7.3.

userinfo 엔드포인트로 sub/email 을 받아 세션을 발급한다(id_token JWKS 검증은
생략하고 access_token 으로 userinfo 를 조회하는 단순·견고한 경로 사용).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"  # noqa: S105 - public OAuth endpoint
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"

STATE_COOKIE_NAME = "pl_oauth_state"
STATE_COOKIE_PATH = "/api/auth"
STATE_TTL_SECONDS = 600

_DEFAULT_REDIRECT_URI = "http://localhost:8000/api/auth/google/callback"
_DEFAULT_POST_LOGIN = "http://localhost:3000/library"


class GoogleOAuthError(Exception):
    """Token 교환·userinfo 조회 실패."""


@dataclass(frozen=True)
class GoogleConfig:
    client_id: str
    client_secret: str
    redirect_uri: str


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str


def google_config() -> GoogleConfig | None:
    """env 에 client_id·secret 이 모두 있으면 설정, 아니면 None(미구성)."""
    cid = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if not (cid and secret):
        return None
    redirect = os.environ.get("GOOGLE_OAUTH_REDIRECT_URI", _DEFAULT_REDIRECT_URI)
    return GoogleConfig(client_id=cid, client_secret=secret, redirect_uri=redirect)


def post_login_redirect() -> str:
    """콜백 성공 후 프론트로 돌려보낼 URL."""
    return os.environ.get("GOOGLE_OAUTH_POST_LOGIN_REDIRECT", _DEFAULT_POST_LOGIN)


def build_auth_url(cfg: GoogleConfig, state: str) -> str:
    params = {
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


async def exchange_code(cfg: GoogleConfig, code: str) -> GoogleIdentity:
    """authorization code → access_token → userinfo(sub, email)."""
    async with httpx.AsyncClient(timeout=10.0) as http:
        token_resp = await http.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": cfg.client_id,
                "client_secret": cfg.client_secret,
                "redirect_uri": cfg.redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise GoogleOAuthError(f"token exchange failed: {token_resp.status_code}")
        access_token = token_resp.json().get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise GoogleOAuthError("no access_token in token response")

        userinfo_resp = await http.get(
            USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise GoogleOAuthError(f"userinfo failed: {userinfo_resp.status_code}")
        info = userinfo_resp.json()

    sub = info.get("sub")
    email = info.get("email")
    if not (isinstance(sub, str) and sub and isinstance(email, str) and email):
        raise GoogleOAuthError("userinfo missing sub/email")
    return GoogleIdentity(sub=sub, email=email)
