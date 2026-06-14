"""Ingestion pipeline tests — S8/S9 (fixture-first, 오프라인)."""

from __future__ import annotations

import contextlib
import os
import shutil
import tempfile
import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from paperlight.agents.chat import retrieve
from paperlight.ingestion.arxiv import fetch_pdf_bytes, normalize_arxiv_id, resolve_meta
from paperlight.ingestion.chunker import chunk_pages
from paperlight.ingestion.embedder import EMBED_DIM, embed
from paperlight.ingestion.parser import PageText, parse_pdf
from paperlight.ingestion.pipeline import ingest_paper
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import get_session_factory, init_db, reset_engine
from paperlight.storage.object_store import get_object_store, pdf_key, reset_object_store

PILOT_ID = "2602.09856"


def test_normalize_arxiv_id_from_raw_and_url() -> None:
    assert normalize_arxiv_id("2602.09856") == "2602.09856"
    assert normalize_arxiv_id("https://arxiv.org/abs/2602.09856") == "2602.09856"
    assert normalize_arxiv_id("https://arxiv.org/pdf/2602.09856v1.pdf") == "2602.09856"


async def test_resolve_meta_fixture_first() -> None:
    meta = await resolve_meta(PILOT_ID)
    assert meta.arxiv_id == PILOT_ID
    assert "Code2World" in meta.title
    assert meta.authors


def test_chunk_pages_skips_empty_and_indexes() -> None:
    chunks = chunk_pages([PageText(1, "a" * 4000), PageText(2, "   ")])
    assert len(chunks) >= 2
    assert all(c.page_num == 1 for c in chunks)
    assert chunks[0].idx == 0
    assert chunks[0].token_estimate > 0


def test_embed_deterministic_and_dim() -> None:
    v1, v2, v3 = embed(["alpha"]), embed(["alpha"]), embed(["beta"])
    assert len(v1[0]) == EMBED_DIM
    assert v1[0] == v2[0]
    assert v1[0] != v3[0]


async def test_parse_pdf_fixture_has_pages() -> None:
    data = await fetch_pdf_bytes(await resolve_meta(PILOT_ID))
    pages = parse_pdf(data)
    assert len(pages) > 0
    assert any(p.text.strip() for p in pages)


@pytest_asyncio.fixture
async def db_and_stores(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[None]:
    monkeypatch.setenv("LLM_PROVIDER", "stub")  # S11 pre-gen runs after ingest — keep offline
    data_dir = tempfile.mkdtemp(prefix="paperlight-data-")
    monkeypatch.setenv("PAPERLIGHT_DATA_DIR", data_dir)
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    reset_object_store()
    yield
    await reset_engine()
    reset_object_store()
    shutil.rmtree(data_dir, ignore_errors=True)
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def test_ingest_paper_end_to_end(db_and_stores: None) -> None:
    meta = await resolve_meta(PILOT_ID)
    data = await fetch_pdf_bytes(meta)
    paper_id = str(uuid.uuid4())
    factory = get_session_factory()
    async with factory() as session:
        session.add(
            Paper(id=paper_id, user_id="anonymous", title=meta.title, arxiv_id=meta.arxiv_id)
        )
        await session.commit()
    get_object_store().put_pdf(pdf_key(paper_id), data)

    await ingest_paper(paper_id)

    async with factory() as session:
        paper = await session.get(Paper, paper_id)
        assert paper is not None and paper.ingestion_status == "ready"
        count = await session.scalar(
            select(func.count()).select_from(Chunk).where(Chunk.paper_id == paper_id)
        )
        assert count and count > 0
        rows = (
            (
                await session.execute(
                    select(Chunk).where(Chunk.paper_id == paper_id).order_by(Chunk.idx)
                )
            )
            .scalars()
            .all()
        )
        first = rows[0] if rows else None
    assert first is not None
    # 모든 청크가 임베딩과 함께 SQLite에 기록되어야 한다(packed float32).
    assert all(c.embedding is not None for c in rows)

    # 첫 청크 본문으로 질의하면 SQLite cosine 검색이 같은 청크를 최상위로 돌려줘야 한다.
    hits = await retrieve(paper_id, first.text, top_k=1)
    assert hits and hits[0].chunk_id == first.id


async def test_ingest_pregen_failure_keeps_ready(
    db_and_stores: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def boom(paper_id: str) -> None:
        raise RuntimeError("pregen boom")

    monkeypatch.setattr("paperlight.ingestion.pipeline.pregen_paper", boom)

    meta = await resolve_meta(PILOT_ID)
    data = await fetch_pdf_bytes(meta)
    paper_id = str(uuid.uuid4())
    factory = get_session_factory()
    async with factory() as session:
        session.add(Paper(id=paper_id, user_id="anonymous", title=meta.title))
        await session.commit()
    get_object_store().put_pdf(pdf_key(paper_id), data)

    await ingest_paper(paper_id)  # pregen raises but is isolated

    async with factory() as session:
        paper = await session.get(Paper, paper_id)
    assert paper is not None and paper.ingestion_status == "ready"
