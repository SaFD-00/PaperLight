"""Library REST API — S13 (F-08 Zotero 4-pane).

user-scoped via shared `get_user_id`. camelCase wire format (FE Zustand 1:1).
신규 ORM/마이그레이션 없음 — 0001 모델(Collection/Tag/PaperTag/LibraryItem) 재사용.
"""
# ruff: noqa: N815

from __future__ import annotations

import time
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.auth.dependencies import get_user_id
from paperlight.models.collection import Collection
from paperlight.models.library_item import LibraryItem
from paperlight.storage.db import get_session

router = APIRouter(prefix="/api/library", tags=["library"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]


def _now_ms() -> int:
    return int(time.time() * 1000)


async def _owned_collection(session: AsyncSession, cid: str, user_id: str) -> Collection:
    col = await session.get(Collection, cid)
    if col is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "collection not found")
    if col.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "collection belongs to another user")
    return col


async def _collection_dict(session: AsyncSession, col: Collection) -> dict[str, Any]:
    count = await session.scalar(
        select(func.count()).select_from(LibraryItem).where(LibraryItem.collection_id == col.id)
    )
    return {
        "id": col.id,
        "name": col.name,
        "parentId": col.parent_id,
        "color": col.color,
        "position": col.position,
        "isSpecial": col.is_special,
        "specialKind": col.special_kind,
        "paperCount": count or 0,
    }


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1)
    parentId: str | None = None
    color: str | None = None


class CollectionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    color: str | None = None
    parentId: str | None = None
    position: int | None = None


@router.get("/collections")
async def list_collections(session: SessionDep, user_id: UserDep) -> list[dict[str, Any]]:
    result = await session.execute(
        select(Collection)
        .where(Collection.user_id == user_id)
        .order_by(Collection.position, Collection.name)
    )
    return [await _collection_dict(session, c) for c in result.scalars().all()]


@router.post("/collections", status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    if body.parentId is not None:
        await _owned_collection(session, body.parentId, user_id)
    pos_q = select(func.max(Collection.position)).where(Collection.user_id == user_id)
    pos_q = (
        pos_q.where(Collection.parent_id.is_(None))
        if body.parentId is None
        else pos_q.where(Collection.parent_id == body.parentId)
    )
    max_pos = await session.scalar(pos_q)
    col = Collection(
        id=str(uuid4()),
        user_id=user_id,
        parent_id=body.parentId,
        name=body.name,
        color=body.color,
        position=(max_pos or 0) + 1,
    )
    session.add(col)
    await session.commit()
    return await _collection_dict(session, col)


@router.patch("/collections/{cid}")
async def update_collection(
    cid: str, body: CollectionPatch, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    col = await _owned_collection(session, cid, user_id)
    fields = body.model_fields_set
    if "parentId" in fields:
        new_parent = body.parentId
        if new_parent is not None:
            if new_parent == cid:
                raise HTTPException(422, "collection cannot be its own parent")
            await _owned_collection(session, new_parent, user_id)
            ancestor: str | None = new_parent
            seen: set[str] = set()
            while ancestor is not None and ancestor not in seen:
                if ancestor == cid:
                    raise HTTPException(422, "cannot move collection under its own descendant")
                seen.add(ancestor)
                parent_row = await session.get(Collection, ancestor)
                ancestor = parent_row.parent_id if parent_row else None
        col.parent_id = new_parent
    if body.name is not None:
        col.name = body.name
    if "color" in fields:
        col.color = body.color
    if body.position is not None:
        col.position = body.position
    col.updated_at = _now_ms()
    await session.commit()
    return await _collection_dict(session, col)


@router.delete("/collections/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(cid: str, session: SessionDep, user_id: UserDep) -> None:
    col = await _owned_collection(session, cid, user_id)
    if col.is_special:
        raise HTTPException(422, "cannot delete special collection")
    all_cols = (
        (await session.execute(select(Collection).where(Collection.user_id == user_id)))
        .scalars()
        .all()
    )
    children: dict[str | None, list[str]] = {}
    for c in all_cols:
        children.setdefault(c.parent_id, []).append(c.id)
    to_delete: list[str] = []
    stack = [cid]
    while stack:
        cur = stack.pop()
        to_delete.append(cur)
        stack.extend(children.get(cur, []))
    await session.execute(delete(LibraryItem).where(LibraryItem.collection_id.in_(to_delete)))
    await session.execute(delete(Collection).where(Collection.id.in_(to_delete)))
    await session.commit()
