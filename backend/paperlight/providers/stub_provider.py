"""Deterministic offline provider for tests/dev (LLM_PROVIDER=stub). No API key."""

from __future__ import annotations

import hashlib
from collections.abc import AsyncIterator


class StubProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or ""

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
    ) -> AsyncIterator[str]:
        user = next(
            (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        digest = hashlib.sha256(user.encode("utf-8")).hexdigest()[:8]
        for token in (f"[stub:{model}] ", digest):
            yield token
