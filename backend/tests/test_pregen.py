"""Auto pre-gen pipeline (S11) — Cache rows, determinism, idempotency, isolation."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

from paperlight.agents import pregen
from paperlight.agents.pregen import pregen_paper
from paperlight.models.cache import Cache
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.providers import cache
from paperlight.providers.router import primary_model
from paperlight.storage.db import init_db, reset_engine, session_scope

PID = "paper-1"


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


def _key(task: str, chunk_id: str, version: str) -> str:
    return cache.cache_key(task, PID, chunk_id, primary_model(task), version)


async def _seed(chunks: list[tuple[str, str]]) -> None:
    """chunks: list of (chunk_id, text)."""
    async with session_scope() as session:
        session.add(Paper(id=PID, user_id="u1", title="Test Paper", authors=["A"]))
        for idx, (cid, text) in enumerate(chunks):
            session.add(
                Chunk(
                    id=cid,
                    paper_id=PID,
                    idx=idx,
                    text=text,
                    page_num=idx + 1,
                    char_start=0,
                    char_end=len(text),
                    token_estimate=len(text) // 4,
                )
            )


async def _get(key: str) -> Cache | None:
    async with session_scope() as session:
        return await session.get(Cache, key)


async def test_pregen_creates_cache_rows(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await _seed(
        [
            ("c1", "We introduce a method. See Figure 1 for the architecture."),
            ("c2", "Results are reported in Table 2 across benchmarks."),
        ]
    )
    await pregen_paper(PID)

    assert await _get(_key("summary", f"summary:{PID}", pregen.SUMMARY_PROMPT_VERSION)) is not None
    assert (
        await _get(_key("highlight", f"highlight:{PID}", pregen.HIGHLIGHT_PROMPT_VERSION))
        is not None
    )
    for cid in ("c1", "c2"):
        assert (
            await _get(_key("paragraph_description", cid, pregen.PARAGRAPH_DESC_PROMPT_VERSION))
            is not None
        )
        assert (
            await _get(
                _key("paragraph_importance", cid, pregen.PARAGRAPH_IMPORTANCE_PROMPT_VERSION)
            )
            is not None
        )
    assert await _get(_key("figure_description", "c1", pregen.FIGURE_PROMPT_VERSION)) is not None
    assert await _get(_key("table_description", "c2", pregen.TABLE_PROMPT_VERSION)) is not None
    # figure-only chunk has no table row and vice versa
    assert await _get(_key("table_description", "c1", pregen.TABLE_PROMPT_VERSION)) is None
    assert await _get(_key("figure_description", "c2", pregen.FIGURE_PROMPT_VERSION)) is None


async def test_pregen_rows_are_permanent(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await _seed([("c1", "Some text without captions.")])
    await pregen_paper(PID)
    row = await _get(_key("summary", f"summary:{PID}", pregen.SUMMARY_PROMPT_VERSION))
    assert row is not None
    assert row.expires_at is None


async def test_pregen_idempotent(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await _seed([("c1", "Deterministic body text.")])
    await pregen_paper(PID)
    first = await _get(_key("summary", f"summary:{PID}", pregen.SUMMARY_PROMPT_VERSION))
    assert first is not None
    text1 = first.response["text"]
    await pregen_paper(PID)  # second run = cache hit, no error
    second = await _get(_key("summary", f"summary:{PID}", pregen.SUMMARY_PROMPT_VERSION))
    assert second is not None
    assert second.response["text"] == text1


async def test_pregen_no_chunks_noop(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    async with session_scope() as session:
        session.add(Paper(id=PID, user_id="u1", title="Empty", authors=[]))
    await pregen_paper(PID)  # must not raise
    assert await _get(_key("summary", f"summary:{PID}", pregen.SUMMARY_PROMPT_VERSION)) is None


async def test_pregen_missing_paper_noop(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await pregen_paper("nope")  # must not raise


async def test_pregen_task_failure_isolated(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await _seed([("c1", "Body text.")])
    real = cache.stream_with_cache

    def fake(task: str, messages: list[dict[str, str]], **kw: object) -> AsyncIterator[str]:
        if task == "summary":

            async def boom() -> AsyncIterator[str]:
                raise RuntimeError("boom")
                yield ""  # pragma: no cover

            return boom()
        return real(task, messages, **kw)  # type: ignore[arg-type]

    monkeypatch.setattr("paperlight.agents.pregen.stream_with_cache", fake)
    await pregen_paper(PID)  # summary fails but others proceed

    assert await _get(_key("summary", f"summary:{PID}", pregen.SUMMARY_PROMPT_VERSION)) is None
    assert (
        await _get(_key("paragraph_description", "c1", pregen.PARAGRAPH_DESC_PROMPT_VERSION))
        is not None
    )
