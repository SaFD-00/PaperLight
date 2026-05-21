"""Seed pilot sample papers into the backend (demo library sample-1/sample-2).

The front-end hardcodes two pilot papers as `sample-1`/`sample-2`
(LibraryShell/Center) but no matching `papers` row exists, so the right-panel
AI tabs (Summary/Insights/Chat) call `/api/papers/sample-1/...` and get 404.
This module ingests the matching fixtures under anonymous ownership using the
existing pipeline, so those tabs work without a manual import.

Idempotent: skips the full parse/embed/pre-gen when chunks already exist, but
always re-asserts the Qdrant vectors — with the default in-memory Qdrant they
are wiped on every restart, which would otherwise leave Chat retrieval empty.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select

from paperlight.ingestion.embedder import embed
from paperlight.ingestion.pipeline import ingest_paper
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import DEFAULT_USER_ID, get_session_factory
from paperlight.storage.object_store import get_object_store, pdf_key
from paperlight.storage.vector import get_vector_store

logger = logging.getLogger(__name__)

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "pilot-papers"

# (paperId expected by the front-end, fixtures slug)
SAMPLES: list[tuple[str, str]] = [
    ("sample-1", "2602.09856-code2world"),
    ("sample-2", "2605.10347-mobile-world-model-gui-agents"),
]


async def _seed_one(paper_id: str, slug: str) -> None:
    meta_path = _FIXTURES / f"{slug}.meta.json"
    pdf_path = _FIXTURES / f"{slug}.pdf"
    if not meta_path.exists() or not pdf_path.exists():
        logger.warning("seed: fixture missing for %s (%s)", paper_id, slug)
        return
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    factory = get_session_factory()
    async with factory() as session:
        paper = await session.get(Paper, paper_id)
        if paper is None:
            session.add(
                Paper(
                    id=paper_id,
                    user_id=DEFAULT_USER_ID,
                    title=meta["title"],
                    authors=meta.get("authors") or [],
                    year=meta.get("year"),
                    venue=meta.get("venue"),
                    arxiv_id=meta.get("arxiv_id"),
                    doi=meta.get("doi"),
                    pdf_r2_key=pdf_key(paper_id),
                    ingestion_status="pending",
                )
            )
            await session.commit()
        chunks = list(
            (await session.execute(select(Chunk).where(Chunk.paper_id == paper_id)))
            .scalars()
            .all()
        )

    # PDF must be in the object store before ingest_paper reads it back.
    data = await asyncio.to_thread(pdf_path.read_bytes)
    await asyncio.to_thread(get_object_store().put_pdf, pdf_key(paper_id), data)

    if not chunks:
        # Full pipeline: parse → chunk → embed → Qdrant → pre-gen (cache persists).
        await ingest_paper(paper_id)
        return

    # Already ingested (chunks + cache persist in the DB); only the in-memory
    # Qdrant vectors are gone after a restart — re-upsert so Chat retrieval works.
    vectors = await asyncio.to_thread(embed, [c.text for c in chunks])
    points = [
        (c.id, vec, {"paper_id": paper_id, "page": c.page_num, "text": c.text})
        for c, vec in zip(chunks, vectors, strict=True)
    ]
    await asyncio.to_thread(get_vector_store().upsert, points)


async def seed_samples() -> None:
    """Seed each pilot paper, isolating failures so one bad fixture is contained."""
    for paper_id, slug in SAMPLES:
        try:
            await _seed_one(paper_id, slug)
        except Exception:
            logger.exception("seed failed for %s", paper_id)
