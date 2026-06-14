"""Single local user.

PaperLight is a self-hosted, single-user app with no authentication. Every row
belongs to the one local user, so the `get_user_id` dependency simply returns a
constant. Routes keep their `user_id` parameter and ownership filters unchanged.
"""

from __future__ import annotations

LOCAL_USER_ID = "local"


async def get_user_id() -> str:
    """FastAPI dependency — always the single local user (no auth)."""
    return LOCAL_USER_ID
