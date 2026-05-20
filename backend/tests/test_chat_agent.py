"""RAG chat agent units (S12) — retrieve / build_messages / followups."""

from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import uuid4

import pytest

from paperlight.agents import chat as chat_agent
from paperlight.agents.chat import (
    RetrievedChunk,
    build_messages,
    context_signature,
    generate_followups,
    retrieve,
)
from paperlight.ingestion.embedder import embed
from paperlight.storage.vector import get_vector_store, reset_vector_store


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


async def test_retrieve_returns_chunks_for_paper() -> None:
    reset_vector_store()
    store = get_vector_store()
    c1, c2 = str(uuid4()), str(uuid4())
    texts = ["transformer attention mechanism", "unrelated cooking recipe"]
    vectors = embed(texts)
    store.upsert(
        [
            (c1, vectors[0], {"paper_id": "p1", "page": 5, "text": texts[0]}),
            (c2, vectors[1], {"paper_id": "p1", "page": 6, "text": texts[1]}),
        ]
    )
    out = await retrieve("p1", "transformer attention mechanism", top_k=2)
    reset_vector_store()
    assert len(out) >= 1
    top = out[0]
    assert top.chunk_id == c1
    assert top.page == 5
    assert "transformer" in top.text


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
