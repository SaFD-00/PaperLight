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

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.api.papers import _get_owned
from paperlight.auth.dependencies import get_user_id
from paperlight.models.highlight import Highlight
from paperlight.models.note import Note
from paperlight.storage.db import get_session
from paperlight.storage.object_store import get_object_store, note_key

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


async def _owned_highlight(session: AsyncSession, hid: str, user_id: str) -> Highlight:
    h = await session.get(Highlight, hid)
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "highlight not found")
    if h.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "highlight belongs to another user")
    return h


@router.get("/papers/{pid}/highlights")
async def list_highlights(pid: str, session: SessionDep, user_id: UserDep) -> list[dict[str, Any]]:
    await _get_owned(session, pid, user_id)
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
    await _get_owned(session, pid, user_id)
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
    h = await _owned_highlight(session, hid, user_id)
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
    await _get_owned(session, pid, user_id)
    note = await _get_or_create_note(session, pid, user_id)
    return _note_dict(note)


@router.put("/papers/{pid}/note")
async def save_note(
    pid: str, body: NoteBody, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    await _get_owned(session, pid, user_id)
    note = await _get_or_create_note(session, pid, user_id)
    note.markdown_text = body.markdownText
    note.s3_backup_key = note_key(note.id)
    note.updated_at = int(time.time() * 1000)
    await asyncio.to_thread(get_object_store().put_text, note.s3_backup_key, body.markdownText)
    await session.commit()
    await session.refresh(note)
    return _note_dict(note)
