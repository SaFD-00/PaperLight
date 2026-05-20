"""Reference extraction + enrichment + memo (S12, F-05)."""

from __future__ import annotations

import contextlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

from paperlight.agents import references as refs
from paperlight.agents.references import enrich, extract_references, get_references
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import init_db, reset_engine, session_scope


def _chunk(idx: int, text: str) -> Chunk:
    return Chunk(
        id=f"c{idx}",
        paper_id="p1",
        idx=idx,
        text=text,
        page_num=idx + 1,
        char_start=0,
        char_end=len(text),
        token_estimate=1,
    )


def test_extract_bracketed_references() -> None:
    body = (
        "We conclude here.\n"
        "References\n"
        "[1] Smith and Jones. 2020. A great paper. arXiv:2001.12345\n"
        "[2] Doe. 2021. Another study. 10.1000/xyz123\n"
    )
    entries = extract_references([_chunk(0, body)])
    assert len(entries) == 2
    assert "A great paper" in entries[0]
    assert "Another study" in entries[1]


def test_extract_no_heading_returns_empty() -> None:
    entries = extract_references([_chunk(0, "Just body text with no bibliography section.")])
    assert entries == []


async def test_enrich_stub_extracts_identifiers() -> None:
    card = await enrich("[1] Smith. 2020. Title. arXiv:2001.12345")
    assert card["source"] == "arxiv"
    assert card["url"] == "https://arxiv.org/abs/2001.12345"
    assert card["title"] is None
    card2 = await enrich("[2] Doe. 2021. Title. 10.1000/xyz123")
    assert card2["source"] == "doi"
    assert card2["url"] == "https://doi.org/10.1000/xyz123"


@pytest_asyncio.fixture
async def db(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[None]:
    monkeypatch.delenv("REFERENCE_PROVIDER", raising=False)
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    yield
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def test_get_references_builds_cards_and_memoizes(
    db: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = "Body.\nReferences\n[1] Smith. 2020. Paper A.\n[2] Doe. 2021. Paper B.\n"
    async with session_scope() as session:
        session.add(Paper(id="p1", user_id="user-a", title="T", authors=["A"]))
        session.add(_chunk(0, body))

    cards = await get_references("p1")
    assert len(cards) == 2
    assert cards[0]["marker"] == 1
    assert "Paper A" in cards[0]["raw"]

    calls = {"n": 0}
    real_extract = refs.extract_references

    def counting(chunks: list[Chunk]) -> list[str]:
        calls["n"] += 1
        return real_extract(chunks)

    monkeypatch.setattr(refs, "extract_references", counting)
    again = await get_references("p1")
    assert again == cards
    assert calls["n"] == 0  # served from memo, extraction not re-run


async def test_get_references_empty_when_no_refs(db: None) -> None:
    async with session_scope() as session:
        session.add(Paper(id="p2", user_id="user-a", title="T", authors=["A"]))
        session.add(
            Chunk(
                id="x0",
                paper_id="p2",
                idx=0,
                text="No bibliography here.",
                page_num=1,
                char_start=0,
                char_end=10,
                token_estimate=1,
            )
        )
    assert await get_references("p2") == []
