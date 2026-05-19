"""Translate SSE smoke — Phase 0 S5 (T8)."""

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


async def test_translate_streams_tokens(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_stream(
        self: object,
        messages: list[dict[str, str]],
        model: str,
    ) -> AsyncIterator[str]:
        yield "안녕"
        yield "하세요"

    monkeypatch.setattr(
        "paperlight.providers.openrouter_provider.OpenRouterProvider.stream_chat",
        fake_stream,
    )

    async with client.stream("POST", "/api/translate", json={"text": "Hello"}) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        body = b""
        async for chunk in resp.aiter_bytes():
            body += chunk
    text = body.decode()
    assert "안녕" in text
    assert "하세요" in text
    assert "[DONE]" in text


async def test_translate_rejects_empty(client: AsyncClient) -> None:
    resp = await client.post("/api/translate", json={"text": ""})
    assert resp.status_code == 422
