"""LLM provider protocols. See PRD §7.5."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextvars import ContextVar
from typing import Any, Protocol

# Optional per-request sink for streaming reasoning ("thinking") deltas. The chat
# endpoint sets it so a reasoning model's thoughts can be surfaced live instead of
# the user staring at a silent stream; when None (default) providers drop reasoning.
reasoning_sink: ContextVar[Callable[[str], None] | None] = ContextVar(
    "reasoning_sink", default=None
)


class LLMProvider(Protocol):
    """Streaming chat-completion provider."""

    def stream_chat(
        self,
        messages: list[dict[str, Any]],
        model: str,
    ) -> AsyncIterator[str]:
        """Return an async iterator of content tokens (async-generator method)."""
        ...
