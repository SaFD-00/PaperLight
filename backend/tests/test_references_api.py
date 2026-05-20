"""GET /api/papers/{id}/references endpoint (S12, F-05)."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import init_db, reset_engine, session_scope

USER_A = {"X-User-Id": "user-a"}
USER_B = {"X-User-Id": "user-b"}


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    monkeypatch.delenv("REFERENCE_PROVIDER", raising=False)
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def _seed(paper_id: str, user_id: str, body: str) -> None:
    async with session_scope() as session:
        session.add(Paper(id=paper_id, user_id=user_id, title="T", authors=["A"]))
        session.add(
            Chunk(
                id=f"{paper_id}-c0",
                paper_id=paper_id,
                idx=0,
                text=body,
                page_num=1,
                char_start=0,
                char_end=len(body),
                token_estimate=1,
            )
        )


_BODY = "Body.\nReferences\n[1] Smith. 2020. Paper A.\n[2] Doe. 2021. Paper B.\n"


async def test_references_returns_cards(client: AsyncClient) -> None:
    await _seed("p1", "user-a", _BODY)
    resp = await client.get("/api/papers/p1/references", headers=USER_A)
    assert resp.status_code == 200
    cards = resp.json()
    assert len(cards) == 2
    assert cards[0]["marker"] == 1
    assert "Paper A" in cards[0]["raw"]


async def test_references_empty_for_paper_without_refs(client: AsyncClient) -> None:
    await _seed("p1", "user-a", "Just body, no bibliography.")
    resp = await client.get("/api/papers/p1/references", headers=USER_A)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_references_other_user_403(client: AsyncClient) -> None:
    await _seed("p1", "user-a", _BODY)
    resp = await client.get("/api/papers/p1/references", headers=USER_B)
    assert resp.status_code == 403


async def test_references_missing_paper_404(client: AsyncClient) -> None:
    resp = await client.get("/api/papers/nope/references", headers=USER_A)
    assert resp.status_code == 404
