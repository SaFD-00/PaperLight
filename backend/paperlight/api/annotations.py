"""Annotations REST API — S14 (Markup / F-11).

User highlights (bbox-anchored) + per-paper Markdown note with R2 backup +
Markdown/Obsidian export. user-scoped via shared `get_user_id`. camelCase wire.
"""
# ruff: noqa: N815

from __future__ import annotations

import asyncio
import time
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.api._ownership import get_owned_highlight, get_owned_paper
from paperlight.local_user import get_user_id
from paperlight.models.highlight import Highlight
from paperlight.models.note import Note
from paperlight.models.paper import Paper
from paperlight.services.notion_export import export_to_notion
from paperlight.storage.db import get_session
from paperlight.storage.object_store import get_object_store, note_key

EXPORT_FORMATS = ("markdown", "obsidian", "notion")

router = APIRouter(prefix="/api/annotations", tags=["annotations"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]


class HighlightBody(BaseModel):
    page: int
    bbox: dict[str, Any]
    text: str = ""
    color: str | None = None
    category: str = "user_custom"


def _highlight_dict(h: Highlight) -> dict[str, Any]:
    return {
        "id": h.id,
        "paperId": h.paper_id,
        "page": h.page,
        "bbox": h.bbox,
        "text": h.text,
        "color": h.color,
        "category": h.category,
        "source": h.source,
        "createdAt": h.created_at,
    }


@router.get("/papers/{pid}/highlights")
async def list_highlights(pid: str, session: SessionDep, user_id: UserDep) -> list[dict[str, Any]]:
    await get_owned_paper(session, pid, user_id)
    result = await session.execute(
        select(Highlight)
        .where(Highlight.paper_id == pid, Highlight.user_id == user_id)
        .order_by(Highlight.page, Highlight.created_at)
    )
    return [_highlight_dict(h) for h in result.scalars().all()]


@router.post("/papers/{pid}/highlights", status_code=status.HTTP_201_CREATED)
async def create_highlight(
    pid: str, body: HighlightBody, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    await get_owned_paper(session, pid, user_id)
    h = Highlight(
        id=str(uuid4()),
        user_id=user_id,
        paper_id=pid,
        page=body.page,
        bbox=body.bbox,
        text=body.text,
        color=body.color,
        category=body.category,
        source="user",
    )
    session.add(h)
    await session.commit()
    return _highlight_dict(h)


@router.delete("/highlights/{hid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(hid: str, session: SessionDep, user_id: UserDep) -> None:
    h = await get_owned_highlight(session, hid, user_id)
    await session.delete(h)
    await session.commit()


class NoteBody(BaseModel):
    markdownText: str


def _note_dict(n: Note) -> dict[str, Any]:
    return {
        "id": n.id,
        "paperId": n.paper_id,
        "markdownText": n.markdown_text,
        "s3BackupKey": n.s3_backup_key,
        "createdAt": n.created_at,
        "updatedAt": n.updated_at,
    }


async def _get_or_create_note(session: AsyncSession, pid: str, user_id: str) -> Note:
    note = await session.scalar(select(Note).where(Note.paper_id == pid, Note.user_id == user_id))
    if note is None:
        note = Note(id=str(uuid4()), user_id=user_id, paper_id=pid, markdown_text="")
        session.add(note)
        await session.commit()
        await session.refresh(note)
    return note


@router.get("/papers/{pid}/note")
async def get_note(pid: str, session: SessionDep, user_id: UserDep) -> dict[str, Any]:
    await get_owned_paper(session, pid, user_id)
    note = await _get_or_create_note(session, pid, user_id)
    return _note_dict(note)


@router.put("/papers/{pid}/note")
async def save_note(
    pid: str, body: NoteBody, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    await get_owned_paper(session, pid, user_id)
    note = await _get_or_create_note(session, pid, user_id)
    note.markdown_text = body.markdownText
    note.s3_backup_key = note_key(note.id)
    note.updated_at = int(time.time() * 1000)
    await asyncio.to_thread(get_object_store().put_text, note.s3_backup_key, body.markdownText)
    await session.commit()
    await session.refresh(note)
    return _note_dict(note)


def _render_export(paper: Paper, highlights: list[Highlight], note: Note | None, fmt: str) -> str:
    authors = ", ".join(paper.authors or [])
    lines: list[str] = []
    if fmt == "obsidian":
        lines.append("---")
        lines.append(f"title: {paper.title}")
        if authors:
            lines.append(f"authors: {authors}")
        if paper.arxiv_id:
            lines.append(f"arxiv: {paper.arxiv_id}")
        lines.append("---")
        lines.append("")
    lines.append(f"# {paper.title}")
    if authors:
        lines.append(f"_{authors}_")
    lines.append("")
    lines.append("## Highlights")
    if highlights:
        for h in highlights:
            label = h.color or h.category
            lines.append(f"- (p.{h.page}, {label}) {h.text}")
    else:
        lines.append("_(없음)_")
    lines.append("")
    lines.append("## Notes")
    lines.append(note.markdown_text if note and note.markdown_text else "_(없음)_")
    return "\n".join(lines) + "\n"


async def _load_export(
    session: AsyncSession, pid: str, user_id: str
) -> tuple[Paper, list[Highlight], Note | None]:
    paper = await get_owned_paper(session, pid, user_id)
    highlights = list(
        (
            await session.execute(
                select(Highlight)
                .where(Highlight.paper_id == pid, Highlight.user_id == user_id)
                .order_by(Highlight.page, Highlight.created_at)
            )
        ).scalars()
    )
    note = await session.scalar(select(Note).where(Note.paper_id == pid, Note.user_id == user_id))
    return paper, highlights, note


@router.get("/papers/{pid}/export")
async def export_annotations(
    pid: str,
    session: SessionDep,
    user_id: UserDep,
    fmt: Annotated[str, Query(alias="format")] = "markdown",
) -> PlainTextResponse:
    if fmt not in EXPORT_FORMATS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "unknown format")
    paper, highlights, note = await _load_export(session, pid, user_id)
    return PlainTextResponse(
        _render_export(paper, highlights, note, fmt), media_type="text/markdown"
    )


@router.post("/papers/{pid}/export/notion")
async def export_notion(pid: str, session: SessionDep, user_id: UserDep) -> dict[str, Any]:
    """Notion 동기화(F-11). 미연동 시 mode=stub + 마크다운 반환(graceful)."""
    paper, highlights, note = await _load_export(session, pid, user_id)
    markdown = _render_export(paper, highlights, note, "markdown")
    return await export_to_notion(paper.title, markdown)
