"""Whole-paper context builder units — summary + RAG injection (F-03/04/14/15)."""

from __future__ import annotations

import pytest

from paperlight.agents import context as ctx
from paperlight.agents.chat import RetrievedChunk


@pytest.fixture(autouse=True)
def _stub_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _summary(_task: str, **_kw: object) -> str | None:
        return "이 논문은 X를 제안한다."

    async def _retrieve(_paper_id: str, _query: str, *, top_k: int = 3) -> list[RetrievedChunk]:
        return [
            RetrievedChunk(chunk_id="self", page=1, text="대상 단락 자신", score=0.99),
            RetrievedChunk(chunk_id="c2", page=4, text="관련 본문 둘", score=0.8),
            RetrievedChunk(chunk_id="c3", page=7, text="관련 본문 셋", score=0.7),
        ][:top_k]

    monkeypatch.setattr(ctx, "read_cached", _summary)
    monkeypatch.setattr(ctx, "retrieve", _retrieve)


async def test_no_paper_id_returns_empty() -> None:
    assert await ctx.build_paper_context(None, "질문") == ""


async def test_summary_and_related_blocks() -> None:
    out = await ctx.build_paper_context("p1", "질문")
    assert "[논문 요약]" in out
    assert "이 논문은 X를 제안한다." in out
    assert "[관련 본문 발췌]" in out
    assert "페이지 4" in out


async def test_exclude_self_chunk() -> None:
    out = await ctx.build_paper_context("p1", "질문", exclude_chunk_id="self")
    assert "대상 단락 자신" not in out
    assert "관련 본문 둘" in out


async def test_summary_only_skips_related() -> None:
    out = await ctx.build_paper_context("p1", "질문", related=False)
    assert "[논문 요약]" in out
    assert "[관련 본문 발췌]" not in out


async def test_cache_miss_omits_summary_block(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _none(_task: str, **_kw: object) -> str | None:
        return None

    monkeypatch.setattr(ctx, "read_cached", _none)
    out = await ctx.build_paper_context("p1", "질문")
    assert "[논문 요약]" not in out
    assert "[관련 본문 발췌]" in out


async def test_precomputed_summary_skips_read(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _boom(_task: str, **_kw: object) -> str | None:
        raise AssertionError("read_cached should not be called")

    monkeypatch.setattr(ctx, "read_cached", _boom)
    out = await ctx.build_paper_context(
        "p1", "질문", related=False, precomputed_summary="미리 만든 요약"
    )
    assert "미리 만든 요약" in out


def test_apply_context_text_only() -> None:
    msgs = ctx.apply_context("시스템", "사용자 본문", "맥락 블록")
    assert ctx.GROUND_GUARD in msgs[0]["content"]
    assert "[논문 맥락]" in msgs[1]["content"]
    assert "맥락 블록" in msgs[1]["content"]
    assert "사용자 본문" in msgs[1]["content"]


def test_apply_context_empty_passthrough() -> None:
    msgs = ctx.apply_context("시스템", "사용자 본문", "")
    assert msgs[0]["content"] == "시스템"
    assert msgs[1]["content"] == "사용자 본문"
