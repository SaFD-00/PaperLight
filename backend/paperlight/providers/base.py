"""LLM provider protocols. See PRD §7.5."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol


class LLMProvider(Protocol):
    """Streaming chat-completion provider."""

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
    ) -> AsyncIterator[str]:
        """Yield content tokens for a streaming chat completion."""
        ...
