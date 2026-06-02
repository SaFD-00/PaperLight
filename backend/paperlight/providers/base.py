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
        *,
        reasoning_effort: str | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """Return an async iterator of content tokens (async-generator method).

        reasoning_effort (none|low|medium|high) requests a model's thinking budget;
        only OpenRouter consumes it today, others accept-and-ignore. temperature/top_p/
        max_tokens are the per-agent sampling params from config/agents.yaml; the stub
        ignores them.
        """
        ...
