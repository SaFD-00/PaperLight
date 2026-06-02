"""Auth utilities — Phase 1 S7b.

Google OAuth 2.0(authorization-code flow)는 `auth/google.py`에 구현되어 있고,
`GOOGLE_OAUTH_CLIENT_ID/SECRET` 이 설정되면 활성화된다(미설정 시 dev mock-login).
JWT helpers, cookie helpers, the user-id dependency 가 여기 모여 api/auth.py 와
api/tabs.py 가 공유한다.
"""

from paperlight.auth.cookies import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    clear_auth_cookies,
    set_auth_cookies,
)
from paperlight.auth.jwt import (
    ACCESS_TTL_SECONDS,
    REFRESH_TTL_SECONDS,
    JWTError,
    decode_token,
    encode_access_token,
    encode_refresh_token,
)

__all__ = [
    "ACCESS_COOKIE_NAME",
    "ACCESS_TTL_SECONDS",
    "JWTError",
    "REFRESH_COOKIE_NAME",
    "REFRESH_COOKIE_PATH",
    "REFRESH_TTL_SECONDS",
    "clear_auth_cookies",
    "decode_token",
    "encode_access_token",
    "encode_refresh_token",
    "set_auth_cookies",
]
