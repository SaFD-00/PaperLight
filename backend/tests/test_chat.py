"""Chat SSE endpoint + history persistence (S12)."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.agents.chat import RetrievedChunk
from paperlight.models.paper import Paper
from paperlight.storage.db import init_db, reset_engine, session_scope
from paperlight.storage.object_store import reset_object_store
from paperlight.storage.vector import reset_vector_store

USER_A = {"X-User-Id": "user-a"}
USER_B = {"X-User-Id": "user-b"}


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    reset_object_store()
    reset_vector_store()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    reset_object_store()
    reset_vector_store()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def _seed_paper(paper_id: str, user_id: str) -> None:
    async with session_scope() as session:
        session.add(Paper(id=paper_id, user_id=user_id, title="T", authors=["A"]))


def _fixed_retrieve(page: int = 3, text: str = "근거 본문") -> object:
    async def fake(paper_id: str, question: str, *, top_k: int = 4) -> list[RetrievedChunk]:
        return [RetrievedChunk(chunk_id="cc", page=page, text=text, score=0.9)]

    return fake


async def _collect(client: AsyncClient, body: dict[str, str], headers: dict[str, str]) -> str:
    chunks = b""
    async with client.stream("POST", "/api/chat", json=body, headers=headers) as resp:
        assert resp.status_code == 200
        async for c in resp.aiter_bytes():
            chunks += c
    return chunks.decode()


async def test_chat_missing_paper_404(client: AsyncClient) -> None:
    resp = await client.post("/api/chat", json={"paperId": "nope", "question": "q"}, headers=USER_A)
    assert resp.status_code == 404


async def test_chat_other_user_403(client: AsyncClient) -> None:
    await _seed_paper("p1", "user-a")
    resp = await client.post("/api/chat", json={"paperId": "p1", "question": "q"}, headers=USER_B)
    assert resp.status_code == 403


async def test_chat_streams_tokens_citations_followups(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_paper("p1", "user-a")
    monkeypatch.setattr("paperlight.api.chat.retrieve", _fixed_retrieve(page=3))
    text = await _collect(client, {"paperId": "p1", "question": "핵심이 뭐야?"}, USER_A)
    assert "[stub:" in text
    assert "citations" in text
    assert '"page": 3' in text
    assert "followups" in text
    assert "[DONE]" in text


async def test_chat_persists_user_and_assistant(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_paper("p1", "user-a")
    monkeypatch.setattr("paperlight.api.chat.retrieve", _fixed_retrieve(page=5))
    await _collect(client, {"paperId": "p1", "question": "질문1"}, USER_A)
    hist = (await client.get("/api/chat/p1", headers=USER_A)).json()
    assert hist["sessionId"] is not None
    roles = [m["role"] for m in hist["messages"]]
    assert roles == ["user", "assistant"]
    assert hist["messages"][0]["content"] == "질문1"
    assert hist["messages"][1]["citations"] == [{"chunkId": "cc", "page": 5}]


async def test_chat_multiturn_appends_to_same_session(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _seed_paper("p1", "user-a")
    monkeypatch.setattr("paperlight.api.chat.retrieve", _fixed_retrieve())
    await _collect(client, {"paperId": "p1", "question": "질문1"}, USER_A)
    await _collect(client, {"paperId": "p1", "question": "질문2"}, USER_A)
    hist = (await client.get("/api/chat/p1", headers=USER_A)).json()
    assert [m["role"] for m in hist["messages"]] == ["user", "assistant", "user", "assistant"]
    assert hist["messages"][2]["content"] == "질문2"


async def test_chat_history_empty_before_chat(client: AsyncClient) -> None:
    await _seed_paper("p1", "user-a")
    resp = await client.get("/api/chat/p1", headers=USER_A)
    assert resp.status_code == 200
    assert resp.json() == {"sessionId": None, "messages": []}


async def test_chat_history_other_user_403(client: AsyncClient) -> None:
    await _seed_paper("p1", "user-a")
    resp = await client.get("/api/chat/p1", headers=USER_B)
    assert resp.status_code == 403
