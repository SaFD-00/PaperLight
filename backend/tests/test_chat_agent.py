"""RAG chat agent units (S12) — retrieve / build_messages / followups.

검색은 SQLite에 저장된 청크 임베딩(packed float32) 기반 코사인 top-k다.
"""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
import pytest_asyncio

from paperlight.agents import chat as chat_agent
from paperlight.agents.chat import (
    RetrievedChunk,
    build_messages,
    context_signature,
    generate_followups,
    retrieve,
)
from paperlight.ingestion.embedder import embed, pack_embedding
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import get_session_factory, init_db, reset_engine


def test_build_messages_includes_context_history_and_question() -> None:
    chunks = [RetrievedChunk(chunk_id="c1", page=3, text="핵심 본문", score=0.9)]
    history = [
        {"role": "user", "content": "이전 질문"},
        {"role": "assistant", "content": "이전 답변"},
    ]
    messages = build_messages("새 질문", chunks, history)
    assert messages[0]["role"] == "system"
    assert {"role": "user", "content": "이전 질문"} in messages
    assert {"role": "assistant", "content": "이전 답변"} in messages
    user_turn = messages[-1]["content"]
    assert "페이지 3" in user_turn
    assert "핵심 본문" in user_turn
    assert "새 질문" in user_turn


def test_build_messages_without_chunks_marks_empty_context() -> None:
    messages = build_messages("질문", [], [])
    assert "관련 발췌문 없음" in messages[-1]["content"]


def test_context_signature_varies_with_history_and_chunks() -> None:
    chunks = [RetrievedChunk(chunk_id="c1", page=1, text="t", score=0.5)]
    sig_a = context_signature("Q", chunks, [])
    sig_b = context_signature("Q", chunks, [{"role": "user", "content": "earlier"}])
    sig_c = context_signature("Q", [], [])
    assert sig_a != sig_b
    assert sig_a != sig_c


@pytest_asyncio.fixture
async def db() -> AsyncIterator[None]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    yield
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def _seed_chunk(
    factory, paper_id: str, chunk_id: str, idx: int, page: int, text: str
) -> None:
    vec = embed([text])[0]
    async with factory() as session:
        session.add(
            Chunk(
                id=chunk_id,
                paper_id=paper_id,
                idx=idx,
                text=text,
                page_num=page,
                char_start=0,
                char_end=len(text),
                token_estimate=max(1, len(text) // 4),
                embedding=pack_embedding(vec),
            )
        )
        await session.commit()


async def test_retrieve_ranks_semantically_relevant_chunk_first(db: None) -> None:
    factory = get_session_factory()
    paper_id = str(uuid4())
    async with factory() as session:
        session.add(Paper(id=paper_id, user_id="local", title="P"))
        await session.commit()

    c1, c2 = str(uuid4()), str(uuid4())
    await _seed_chunk(factory, paper_id, c1, 0, 5, "transformer attention mechanism")
    await _seed_chunk(factory, paper_id, c2, 1, 6, "unrelated cooking recipe")

    out = await retrieve(paper_id, "transformer attention mechanism", top_k=2)
    assert len(out) == 2
    top = out[0]
    assert top.chunk_id == c1
    assert top.page == 5
    assert "transformer" in top.text


async def test_retrieve_scoped_to_paper(db: None) -> None:
    factory = get_session_factory()
    p1, p2 = str(uuid4()), str(uuid4())
    async with factory() as session:
        session.add(Paper(id=p1, user_id="local", title="P1"))
        session.add(Paper(id=p2, user_id="local", title="P2"))
        await session.commit()
    await _seed_chunk(factory, p1, str(uuid4()), 0, 1, "alpha content")
    await _seed_chunk(factory, p2, str(uuid4()), 0, 1, "beta content")

    out = await retrieve(p2, "anything", top_k=5)
    assert {c.text for c in out} == {"beta content"}


async def test_generate_followups_stub_returns_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    out = await generate_followups("핵심이 뭐야?", "핵심은 X 입니다.")
    assert isinstance(out, list)
    assert len(out) <= 3


async def test_generate_followups_failure_returns_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(task: str, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        raise RuntimeError("upstream down")
        yield  # pragma: no cover

    monkeypatch.setattr(chat_agent, "stream_task", boom)
    assert await generate_followups("q", "a") == []
