"""Observability gating tests (S15).

With no env keys every integration must be a no-op so the rest of the suite runs
untouched. A fake Langfuse client verifies the stream_task tracing wrapper.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from paperlight.observability.context import (
    current_trace_metadata,
    paper_id_var,
    request_id_var,
    user_id_var,
)
from paperlight.observability.langfuse_client import (
    get_langfuse,
    reset_langfuse,
    set_langfuse,
)
from paperlight.observability.sentry import init_sentry
from paperlight.providers.router import stream_task


def test_init_sentry_noop_without_dsn(monkeypatch: Any) -> None:
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert init_sentry() is False


def test_get_langfuse_none_without_keys(monkeypatch: Any) -> None:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    reset_langfuse()
    try:
        assert get_langfuse() is None
    finally:
        reset_langfuse()


def test_current_trace_metadata_only_set_keys() -> None:
    rt = request_id_var.set("r1")
    ut = user_id_var.set("u1")
    pt = paper_id_var.set("p1")
    try:
        assert current_trace_metadata() == {"request_id": "r1", "user_id": "u1", "paper_id": "p1"}
    finally:
        request_id_var.reset(rt)
        user_id_var.reset(ut)
        paper_id_var.reset(pt)


async def test_request_id_response_header(client: AsyncClient) -> None:
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("x-request-id")


async def test_stream_task_delegates_without_langfuse(monkeypatch: Any) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    reset_langfuse()
    try:
        tokens = [t async for t in stream_task("explanation", [{"role": "user", "content": "hi"}])]
    finally:
        reset_langfuse()
    assert "".join(tokens)


class _FakeGeneration:
    def __init__(self) -> None:
        self.updates: list[dict[str, Any]] = []

    def update(self, **kwargs: Any) -> None:
        self.updates.append(kwargs)


class _FakeCM:
    def __init__(self, gen: _FakeGeneration, calls: list[dict[str, Any]], kwargs: dict[str, Any]):
        self._gen = gen
        self._calls = calls
        self._kwargs = kwargs

    def __enter__(self) -> _FakeGeneration:
        self._calls.append(self._kwargs)
        return self._gen

    def __exit__(self, *exc: Any) -> bool:
        return False


class _FakeLangfuse:
    def __init__(self) -> None:
        self.generation = _FakeGeneration()
        self.calls: list[dict[str, Any]] = []

    def start_as_current_observation(self, **kwargs: Any) -> _FakeCM:
        return _FakeCM(self.generation, self.calls, kwargs)


async def test_stream_task_traces_with_langfuse(monkeypatch: Any) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    fake = _FakeLangfuse()
    set_langfuse(fake)  # type: ignore[arg-type]
    try:
        tokens = [t async for t in stream_task("explanation", [{"role": "user", "content": "hi"}])]
    finally:
        reset_langfuse()
    assert "".join(tokens)
    assert fake.calls and fake.calls[0]["name"] == "llm.explanation"
    assert fake.calls[0]["as_type"] == "generation"
    assert any("output" in u for u in fake.generation.updates)
