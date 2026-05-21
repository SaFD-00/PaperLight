"""Ingestion orchestrator — S9.

PDF 로드 → parse → chunk → Chunk rows → embed → Qdrant upsert.
status 전이: pending → parsing → embedding → ready (실패 시 failed). 각 전이 commit →
SSE 폴링이 진행률 관측. BackgroundTask에서 호출되므로 CPU/sync IO는 to_thread로 위임.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from uuid import uuid4

from paperlight.agents.pregen import pregen_paper
from paperlight.ingestion.chunker import chunk_pages
from paperlight.ingestion.embedder import embed
from paperlight.ingestion.parser import parse_pdf
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.providers.cache import save_figure_layout
from paperlight.storage.db import get_session_factory
from paperlight.storage.object_store import get_object_store, pdf_key
from paperlight.storage.vector import get_vector_store

logger = logging.getLogger(__name__)


async def _set_status(paper_id: str, status: str) -> None:
    factory = get_session_factory()
    async with factory() as session:
        paper = await session.get(Paper, paper_id)
        if paper is not None:
            paper.ingestion_status = status
            await session.commit()


async def ingest_paper(paper_id: str) -> None:
    try:
        await _set_status(paper_id, "parsing")

        data = await asyncio.to_thread(get_object_store().get_pdf, pdf_key(paper_id))
        pages = await asyncio.to_thread(parse_pdf, data)
        chunk_datas = chunk_pages(pages)

        figures = [
            {
                "page": p.page_num,
                "kind": fig.kind,
                "label": fig.label,
                "bbox": fig.bbox,
                "captionText": fig.caption_text,
            }
            for p in pages
            for fig in p.figures
        ]
        if figures:
            await save_figure_layout(paper_id, figures)

        factory = get_session_factory()
        points_meta: list[tuple[str, str, int]] = []
        async with factory() as session:
            for cd in chunk_datas:
                cid = str(uuid4())
                session.add(
                    Chunk(
                        id=cid,
                        paper_id=paper_id,
                        idx=cd.idx,
                        text=cd.text,
                        page_num=cd.page_num,
                        char_start=cd.char_start,
                        char_end=cd.char_end,
                        token_estimate=cd.token_estimate,
                    )
                )
                points_meta.append((cid, cd.text, cd.page_num))
            await session.commit()

        await _set_status(paper_id, "embedding")

        if points_meta:
            vectors = await asyncio.to_thread(embed, [text for _, text, _ in points_meta])
            points = [
                (cid, vec, {"paper_id": paper_id, "page": page, "text": text})
                for (cid, text, page), vec in zip(points_meta, vectors, strict=True)
            ]
            await asyncio.to_thread(get_vector_store().upsert, points)

        await _set_status(paper_id, "ready")
    except Exception:
        logger.exception("ingestion failed for paper %s", paper_id)
        with contextlib.suppress(Exception):
            await _set_status(paper_id, "failed")
        return

    # S11 auto pre-gen runs only after successful ingestion; its failures must not
    # flip the already-`ready` status back to `failed`.
    with contextlib.suppress(Exception):
        await pregen_paper(paper_id)
