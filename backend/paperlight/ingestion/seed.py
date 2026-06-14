"""Seed pilot sample papers into the backend (demo library sample-1/sample-2).

The front-end hardcodes two pilot papers as `sample-1`/`sample-2`
(LibraryShell/Center) but no matching `papers` row exists, so the right-panel
AI tabs (Summary/Insights/Chat) call `/api/papers/sample-1/...` and get 404.
This module ingests the matching fixtures for the local user using the existing
pipeline, so those tabs work without a manual import.

Idempotent: chunks, embeddings and the LLM cache all persist in SQLite, so once a
sample is ingested a restart re-uses everything — only missing samples are ingested.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select

from paperlight.ingestion.pipeline import ingest_paper
from paperlight.local_user import LOCAL_USER_ID
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import get_session_factory
from paperlight.storage.object_store import get_object_store, pdf_key

logger = logging.getLogger(__name__)

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "pilot-papers"

# (paperId expected by the front-end, fixtures slug)
# sample-3..sample-10 = 학회 양식 다양성 픽스처(NeurIPS/ICML/CVPR/EMNLP/AAAI/ACM/Nature/IEEE).
# 프론트의 SLUG_TO_FILE(route.ts)·PDF_URL_MAP(Center.tsx)와 paperId 매핑을 일치시킬 것.
SAMPLES: list[tuple[str, str]] = [
    ("sample-1", "2602.09856-code2world"),
    ("sample-2", "2605.10347-mobile-world-model-gui-agents"),
    ("sample-3", "2305.10601-tree-of-thoughts"),
    ("sample-4", "2310.16834-icml-score-entropy"),
    ("sample-5", "2201.03545-convnext-cvpr"),
    ("sample-6", "2311.09210-chain-of-note-emnlp"),
    ("sample-7", "2501.02997-calm-aaai"),
    ("sample-8", "2405.07011-fair-graph-www"),
    ("sample-9", "natcomm-2022-precip-nowcasting"),
    ("sample-10", "2310.15641-coverage-tpami"),
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
                    user_id=LOCAL_USER_ID,
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
        already_ingested = (
            await session.execute(select(Chunk.id).where(Chunk.paper_id == paper_id).limit(1))
        ).first() is not None

    # PDF must be in the object store before ingest_paper reads it back.
    data = await asyncio.to_thread(pdf_path.read_bytes)
    await asyncio.to_thread(get_object_store().put_pdf, pdf_key(paper_id), data)

    if not already_ingested:
        # Full pipeline: parse → chunk → embed → Chunk rows → pre-gen (all persist in SQLite).
        await ingest_paper(paper_id)


async def seed_samples() -> None:
    """Seed each pilot paper, isolating failures so one bad fixture is contained."""
    for paper_id, slug in SAMPLES:
        try:
            await _seed_one(paper_id, slug)
        except Exception:
            logger.exception("seed failed for %s", paper_id)
