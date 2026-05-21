"""Task → provider/model routing (PRD §7.5.4 models.yaml). See also stream_task."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

from paperlight.observability.context import current_trace_metadata
from paperlight.observability.langfuse_client import get_langfuse
from paperlight.providers.base import LLMProvider
from paperlight.providers.gemini_provider import GeminiProvider
from paperlight.providers.openai_provider import OpenAIProvider
from paperlight.providers.openrouter_provider import OpenRouterProvider
from paperlight.providers.stub_provider import StubProvider

_DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "models.yaml"

PROVIDER_REGISTRY: dict[str, Callable[[], LLMProvider]] = {
    "openrouter": OpenRouterProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
    "stub": StubProvider,
}


def _config_path() -> Path:
    override = os.environ.get("PAPERLIGHT_MODELS_CONFIG")
    return Path(override) if override else _DEFAULT_CONFIG_PATH


@lru_cache(maxsize=1)
def _load(path: str) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        raise RuntimeError(f"models.yaml must be a mapping: {path}")
    return data


def load_models_config() -> dict[str, Any]:
    return _load(str(_config_path()))


def _entry(task: str) -> dict[str, Any]:
    cfg = load_models_config()
    tasks = cfg.get("tasks") or {}
    entry = tasks.get(task)
    if entry is None:
        entry = cfg["default"]
    if not isinstance(entry, dict):
        raise RuntimeError(f"invalid models.yaml entry for task {task!r}")
    return entry


def candidates(task: str) -> list[tuple[str, str]]:
    """Return [(provider, model), *fallback] for a task (default if unknown)."""
    entry = _entry(task)
    result: list[tuple[str, str]] = [(entry["provider"], entry["model"])]
    for fb in entry.get("fallback") or []:
        result.append((fb["provider"], fb["model"]))
    return result


def primary_model(task: str) -> str:
    """The primary (non-fallback) model for a task — used as the cache key model."""
    model: str = _entry(task)["model"]
    return model


async def _stream_candidates(
    task: str,
    messages: list[dict[str, Any]],
    holder: dict[str, str],
) -> AsyncIterator[str]:
    """Run the provider chain; record the model that actually yields in holder."""
    if os.environ.get("LLM_PROVIDER") == "stub":
        holder["model"] = primary_model(task)
        async for token in StubProvider().stream_chat(messages, holder["model"]):
            yield token
        return

    last_error: Exception | None = None
    for provider_name, model in candidates(task):
        cls = PROVIDER_REGISTRY.get(provider_name)
        if cls is None:
            continue
        try:
            provider = cls()
        except RuntimeError as err:
            last_error = err
            continue
        yielded = False
        try:
            async for token in provider.stream_chat(messages, model):
                if not yielded:
                    holder["model"] = model
                yielded = True
                yield token
            return
        except Exception as err:  # noqa: BLE001 — fall back only before first token
            last_error = err
            if yielded:
                raise
            continue

    raise RuntimeError(
        str(last_error) if last_error else f"no provider available for task {task!r}"
    )


async def stream_task(
    task: str,
    messages: list[dict[str, Any]],
) -> AsyncIterator[str]:
    """Stream a task through its provider chain, traced via Langfuse when enabled.

    LLM_PROVIDER=stub forces the offline deterministic provider. Otherwise each
    candidate is tried in order; an unavailable provider (missing key) or a
    failure *before the first token* falls through to the next. A failure after
    tokens were already emitted is re-raised (cannot un-send a partial stream).
    With no Langfuse keys the call delegates with zero tracing overhead.
    """
    holder: dict[str, str] = {"model": primary_model(task)}
    langfuse = get_langfuse()
    if langfuse is None:
        async for token in _stream_candidates(task, messages, holder):
            yield token
        return

    with langfuse.start_as_current_observation(
        name=f"llm.{task}",
        as_type="generation",
        input=messages,
        model=holder["model"],
        metadata=current_trace_metadata(),
    ) as generation:
        buffer: list[str] = []
        try:
            async for token in _stream_candidates(task, messages, holder):
                buffer.append(token)
                yield token
        except Exception as err:
            generation.update(level="ERROR", status_message=str(err), model=holder["model"])
            raise
        generation.update(output="".join(buffer), model=holder["model"])
