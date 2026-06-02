"""Deterministic offline provider for tests/dev (LLM_PROVIDER=stub). No API key."""

from __future__ import annotations

import hashlib
from collections.abc import AsyncIterator
from typing import Any

from paperlight.providers.content import to_text


class StubProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or ""

    async def stream_chat(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        reasoning_effort: str | None = None,  # noqa: ARG002 — accepted for protocol parity
        temperature: float | None = None,  # noqa: ARG002 — accepted for protocol parity
        top_p: float | None = None,  # noqa: ARG002 — accepted for protocol parity
        max_tokens: int | None = None,  # noqa: ARG002 — accepted for protocol parity
    ) -> AsyncIterator[str]:
        user = next(
            (to_text(m.get("content", "")) for m in reversed(messages) if m.get("role") == "user"),
            "",
        )
        digest = hashlib.sha256(user.encode("utf-8")).hexdigest()[:8]
        for token in (f"[stub:{model}] ", digest):
            yield token
