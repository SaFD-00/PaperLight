"""Langfuse client (S15) — LLM trace export, env-gated.

Built lazily and only when both LANGFUSE keys are present; otherwise ``None`` so
the LLM path runs with zero tracing overhead. ``set_langfuse``/``reset_langfuse``
are test hooks.
"""

from __future__ import annotations

from langfuse import Langfuse

from paperlight.observability.settings import get_observability_settings

_client: Langfuse | None = None
_initialized: bool = False


def _build_client() -> Langfuse | None:
    settings = get_observability_settings()
    if not settings.langfuse_enabled:
        return None
    return Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
    )


def get_langfuse() -> Langfuse | None:
    global _client, _initialized
    if not _initialized:
        _client = _build_client()
        _initialized = True
    return _client


def set_langfuse(client: Langfuse | None) -> None:
    global _client, _initialized
    _client = client
    _initialized = True


def reset_langfuse() -> None:
    global _client, _initialized
    _client = None
    _initialized = False


def shutdown_langfuse() -> None:
    if _client is not None:
        _client.flush()
