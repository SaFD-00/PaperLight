"""Auth utilities — Phase 1 S7b (stub/mock 모드).

Real Google OAuth flow integration deferred until OAuth client credentials are
provisioned. JWT helpers, cookie helpers, and the user-id dependency live here
so api/auth.py and api/tabs.py can share them.
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
