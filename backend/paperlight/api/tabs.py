"""Tab REST API — FE Zustand ↔ BE single source of truth (last-write-wins).

Phase 0 단일 사용자 모드. Phase 1에서 user_id 도입.
camelCase 필드는 FE Zustand store wire format과 1:1 일치시키기 위함.
"""
# ruff: noqa: N815

from __future__ import annotations

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.models import Tab
from paperlight.storage.db import get_session

router = APIRouter(prefix="/api/tabs", tags=["tabs"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class TabPayload(BaseModel):
    id: str = Field(..., min_length=1)
    paperId: str | None = None
    title: str = Field(..., min_length=1)
    position: int = 0
    pinned: bool = False
    isLibrary: bool = False
    openedAt: int
    lastActiveAt: int
    updatedAt: int | None = None


class TabPatch(BaseModel):
    paperId: str | None = None
    title: str | None = None
    position: int | None = None
    pinned: bool | None = None
    lastActiveAt: int | None = None
    updatedAt: int | None = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _to_orm(payload: TabPayload) -> Tab:
    updated = payload.updatedAt or _now_ms()
    return Tab(
        id=payload.id,
        paper_id=payload.paperId,
        title=payload.title,
        position=payload.position,
        pinned=payload.pinned,
        is_library=payload.isLibrary,
        opened_at=payload.openedAt,
        last_active_at=payload.lastActiveAt,
        updated_at=updated,
    )


@router.get("")
async def list_tabs(session: SessionDep) -> list[dict[str, object]]:
    result = await session.execute(select(Tab).order_by(Tab.position))
    return [t.to_dict() for t in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def upsert_tab(payload: TabPayload, session: SessionDep) -> dict[str, object]:
    existing = await session.get(Tab, payload.id)
    incoming_updated = payload.updatedAt or _now_ms()
    if existing is not None:
        # last-write-wins
        if existing.updated_at >= incoming_updated:
            return existing.to_dict()
        existing.paper_id = payload.paperId
        existing.title = payload.title
        existing.position = payload.position
        existing.pinned = payload.pinned
        existing.is_library = payload.isLibrary
        existing.opened_at = payload.openedAt
        existing.last_active_at = payload.lastActiveAt
        existing.updated_at = incoming_updated
        await session.commit()
        await session.refresh(existing)
        return existing.to_dict()
    new = _to_orm(payload)
    new.updated_at = incoming_updated
    session.add(new)
    await session.commit()
    await session.refresh(new)
    return new.to_dict()


@router.patch("/{tab_id}")
async def patch_tab(tab_id: str, patch: TabPatch, session: SessionDep) -> dict[str, object]:
    existing = await session.get(Tab, tab_id)
    if existing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tab not found")
    incoming_updated = patch.updatedAt or _now_ms()
    if existing.updated_at >= incoming_updated:
        return existing.to_dict()
    if patch.paperId is not None:
        existing.paper_id = patch.paperId
    if patch.title is not None:
        existing.title = patch.title
    if patch.position is not None:
        existing.position = patch.position
    if patch.pinned is not None:
        existing.pinned = patch.pinned
    if patch.lastActiveAt is not None:
        existing.last_active_at = patch.lastActiveAt
    existing.updated_at = incoming_updated
    await session.commit()
    await session.refresh(existing)
    return existing.to_dict()


@router.delete("/{tab_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tab(tab_id: str, session: SessionDep) -> None:
    existing = await session.get(Tab, tab_id)
    if existing is None:
        return
    if existing.is_library:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "library tab cannot be deleted")
    await session.delete(existing)
    await session.commit()
