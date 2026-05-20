"""Papers REST API — S8 (arXiv import) + S9 (ingestion trigger / progress).

user-scoped via shared `get_user_id` dependency. PDF는 presigned URL only (PRD §7.3).
camelCase wire format (FE Zustand 1:1).
"""
# ruff: noqa: N815

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated, Any
from uuid import uuid4

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.auth.dependencies import get_user_id
from paperlight.ingestion.arxiv import fetch_pdf_bytes, resolve_meta
from paperlight.ingestion.pipeline import ingest_paper
from paperlight.models.paper import Paper
from paperlight.storage.db import get_session, get_session_factory
from paperlight.storage.object_store import (
    DEFAULT_TTL_SECONDS,
    get_object_store,
    pdf_key,
    verify_pdf_token,
)

router = APIRouter(prefix="/api/papers", tags=["papers"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]


class ImportBody(BaseModel):
    arxivId: str | None = None
    url: str | None = None


def _paper_dict(p: Paper) -> dict[str, Any]:
    return {
        "id": p.id,
        "title": p.title,
        "authors": p.authors,
        "year": p.year,
        "venue": p.venue,
        "arxivId": p.arxiv_id,
        "doi": p.doi,
        "status": p.status,
        "progressPct": p.progress_pct,
        "ingestionStatus": p.ingestion_status,
        "createdAt": p.created_at,
        "updatedAt": p.updated_at,
    }


def _format_sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def _get_owned(session: AsyncSession, paper_id: str, user_id: str) -> Paper:
    paper = await session.get(Paper, paper_id)
    if paper is None or paper.soft_deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "paper not found")
    if paper.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "paper belongs to another user")
    return paper


@router.get("")
async def list_papers(session: SessionDep, user_id: UserDep) -> list[dict[str, Any]]:
    result = await session.execute(
        select(Paper)
        .where(Paper.user_id == user_id, Paper.soft_deleted_at.is_(None))
        .order_by(Paper.created_at.desc())
    )
    return [_paper_dict(p) for p in result.scalars().all()]


@router.get("/arxiv/{arxiv_id}")
async def arxiv_meta(arxiv_id: str) -> dict[str, Any]:
    try:
        meta = await resolve_meta(arxiv_id)
    except ValueError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from err
    except httpx.HTTPError as err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"arXiv fetch failed: {err}") from err
    return {
        "arxivId": meta.arxiv_id,
        "title": meta.title,
        "authors": meta.authors,
        "year": meta.year,
        "abstract": meta.abstract,
        "doi": meta.doi,
        "categories": meta.categories,
        "pdfUrl": meta.pdf_url,
    }


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_paper(
    body: ImportBody,
    session: SessionDep,
    user_id: UserDep,
    background: BackgroundTasks,
) -> dict[str, Any]:
    value = body.arxivId or body.url
    if not value:
        raise HTTPException(422, "arxivId or url required")
    try:
        meta = await resolve_meta(value)
    except ValueError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from err
    except httpx.HTTPError as err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"arXiv fetch failed: {err}") from err

    paper_id = str(uuid4())
    paper = Paper(
        id=paper_id,
        user_id=user_id,
        title=meta.title,
        authors=meta.authors,
        year=meta.year,
        arxiv_id=meta.arxiv_id,
        doi=meta.doi,
        pdf_r2_key=pdf_key(paper_id),
        ingestion_status="pending",
    )
    session.add(paper)
    await session.commit()

    try:
        data = await fetch_pdf_bytes(meta)
        await asyncio.to_thread(get_object_store().put_pdf, pdf_key(paper_id), data)
    except (httpx.HTTPError, OSError):
        paper.ingestion_status = "failed"
        await session.commit()
        return _paper_dict(paper)

    background.add_task(ingest_paper, paper_id)
    await session.refresh(paper)
    return _paper_dict(paper)


@router.get("/{paper_id}")
async def get_paper(paper_id: str, session: SessionDep, user_id: UserDep) -> dict[str, Any]:
    return _paper_dict(await _get_owned(session, paper_id, user_id))


@router.get("/{paper_id}/pdf-url")
async def pdf_presigned_url(
    paper_id: str, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    await _get_owned(session, paper_id, user_id)
    url = get_object_store().presigned_get(pdf_key(paper_id))
    return {"url": url, "ttlSeconds": DEFAULT_TTL_SECONDS}


@router.get("/{paper_id}/pdf")
async def pdf_stream(
    paper_id: str,
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query()],
) -> Response:
    if not verify_pdf_token(paper_id, exp, sig):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "invalid or expired token")
    try:
        data = await asyncio.to_thread(get_object_store().get_pdf, pdf_key(paper_id))
    except FileNotFoundError as err:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "pdf not found") from err
    return Response(content=data, media_type="application/pdf")


@router.get("/{paper_id}/ingestion")
async def ingestion_progress(
    paper_id: str, session: SessionDep, user_id: UserDep
) -> StreamingResponse:
    await _get_owned(session, paper_id, user_id)

    async def _gen() -> AsyncIterator[str]:
        factory = get_session_factory()
        for _ in range(600):  # ~max 5min @ 0.5s
            async with factory() as poll:
                paper = await poll.get(Paper, paper_id)
                if paper is None:
                    yield _format_sse({"error": "paper not found"})
                    yield "data: [DONE]\n\n"
                    return
                yield _format_sse({"status": paper.ingestion_status})
                if paper.ingestion_status in ("ready", "failed"):
                    yield "data: [DONE]\n\n"
                    return
            await asyncio.sleep(0.5)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )
