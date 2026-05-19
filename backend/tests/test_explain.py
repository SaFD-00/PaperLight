"""Explain SSE smoke — Phase 0 S4 (T7)."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.storage.db import init_db, reset_engine


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def test_explain_streams_tokens(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_stream(
        self: object,
        messages: list[dict[str, str]],
        model: str,
    ) -> AsyncIterator[str]:
        yield "Hello "
        yield "world"

    monkeypatch.setattr(
        "paperlight.providers.openrouter_provider.OpenRouterProvider.stream_chat",
        fake_stream,
    )

    async with client.stream("POST", "/api/explain", json={"text": "sample"}) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        body = b""
        async for chunk in resp.aiter_bytes():
            body += chunk
    text = body.decode()
    assert "Hello" in text
    assert "world" in text
    assert "[DONE]" in text


async def test_explain_missing_key_emits_error_event(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    async with client.stream("POST", "/api/explain", json={"text": "sample"}) as resp:
        assert resp.status_code == 200
        body = b""
        async for chunk in resp.aiter_bytes():
            body += chunk
    text = body.decode()
    assert "error" in text
    assert "[DONE]" in text


async def test_explain_rejects_empty(client: AsyncClient) -> None:
    resp = await client.post("/api/explain", json={"text": ""})
    assert resp.status_code == 422
