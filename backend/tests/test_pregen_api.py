"""Pre-gen read endpoints (S11) — GET summary/insights, ownership, graceful empty."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.agents.pregen import pregen_paper
from paperlight.local_user import LOCAL_USER_ID
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import init_db, reset_engine, session_scope
from paperlight.storage.object_store import reset_object_store

# 단일 사용자 모델: X-User-Id 헤더는 무시된다.
USER_A: dict[str, str] = {}


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    reset_object_store()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    reset_object_store()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def _seed(paper_id: str, user_id: str, chunks: list[tuple[str, str]]) -> None:
    # 단일 사용자 모델: user_id 인자는 호환용이며 항상 로컬 사용자 소유로 만든다.
    async with session_scope() as session:
        session.add(Paper(id=paper_id, user_id=LOCAL_USER_ID, title="T", authors=["A"]))
        for i, (cid, text) in enumerate(chunks):
            session.add(
                Chunk(
                    id=cid,
                    paper_id=paper_id,
                    idx=i,
                    text=text,
                    page_num=i + 1,
                    char_start=0,
                    char_end=len(text),
                    token_estimate=1,
                )
            )


async def test_summary_after_pregen(client: AsyncClient) -> None:
    await _seed("p1", "user-a", [("c1", "Intro body.")])
    await pregen_paper("p1")
    resp = await client.get("/api/papers/p1/summary", headers=USER_A)
    assert resp.status_code == 200
    assert resp.json()["text"].startswith("[stub:")


async def test_summary_before_pregen_graceful(client: AsyncClient) -> None:
    await _seed("p1", "user-a", [("c1", "Intro body.")])
    resp = await client.get("/api/papers/p1/summary", headers=USER_A)
    assert resp.status_code == 200
    assert resp.json()["text"] is None


async def test_insights_after_pregen(client: AsyncClient) -> None:
    await _seed(
        "p1",
        "user-a",
        [
            ("c1", "We propose a model. See Figure 1."),
            ("c2", "Numbers appear in Table 2."),
        ],
    )
    await pregen_paper("p1")
    resp = await client.get("/api/papers/p1/insights", headers=USER_A)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["paragraphs"]) == 2
    assert all(p["description"] and p["importance"] for p in body["paragraphs"])
    assert body["paragraphs"][0]["chunkId"] == "c1"
    kinds = {f["kind"] for f in body["figures"]}
    assert kinds == {"figure", "table"}
    assert body["highlights"].startswith("[stub:")


async def test_insights_before_pregen_graceful(client: AsyncClient) -> None:
    await _seed("p1", "user-a", [("c1", "Body.")])
    resp = await client.get("/api/papers/p1/insights", headers=USER_A)
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"paragraphs": [], "figures": [], "highlights": None}


async def test_insights_missing_paper_404(client: AsyncClient) -> None:
    resp = await client.get("/api/papers/nope/insights", headers=USER_A)
    assert resp.status_code == 404
