"""Tab REST API — FE Zustand ↔ BE single source of truth (last-write-wins).

Phase 1 S7a: user-scoped via `X-User-Id` 헤더 (없으면 `anonymous` default user).
S7b OAuth 합류 시 헤더 대신 JWT subject로 교체.
camelCase 필드는 FE Zustand store wire format과 1:1 일치시키기 위함.
"""
# ruff: noqa: N815

from __future__ import annotations

import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.models import Tab
from paperlight.storage.db import DEFAULT_USER_ID, get_session

router = APIRouter(prefix="/api/tabs", tags=["tabs"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_user_id(x_user_id: Annotated[str | None, Header()] = None) -> str:
    return x_user_id or DEFAULT_USER_ID


UserDep = Annotated[str, Depends(get_user_id)]


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


def _to_orm(payload: TabPayload, user_id: str) -> Tab:
    updated = payload.updatedAt or _now_ms()
    return Tab(
        id=payload.id,
        user_id=user_id,
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
async def list_tabs(session: SessionDep, user_id: UserDep) -> list[dict[str, object]]:
    result = await session.execute(
        select(Tab).where(Tab.user_id == user_id).order_by(Tab.position)
    )
    return [t.to_dict() for t in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def upsert_tab(
    payload: TabPayload, session: SessionDep, user_id: UserDep
) -> dict[str, object]:
    existing = await session.get(Tab, payload.id)
    if existing is not None and existing.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "tab belongs to another user")
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
    new = _to_orm(payload, user_id)
    new.updated_at = incoming_updated
    session.add(new)
    await session.commit()
    await session.refresh(new)
    return new.to_dict()


@router.patch("/{tab_id}")
async def patch_tab(
    tab_id: str, patch: TabPatch, session: SessionDep, user_id: UserDep
) -> dict[str, object]:
    existing = await session.get(Tab, tab_id)
    if existing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tab not found")
    if existing.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "tab belongs to another user")
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
async def delete_tab(tab_id: str, session: SessionDep, user_id: UserDep) -> None:
    existing = await session.get(Tab, tab_id)
    if existing is None:
        return
    if existing.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "tab belongs to another user")
    if existing.is_library:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "library tab cannot be deleted")
    await session.delete(existing)
    await session.commit()
