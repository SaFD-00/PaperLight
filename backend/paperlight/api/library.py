"""Library REST API — S13 (F-08 Zotero 4-pane).

user-scoped via shared `get_user_id`. camelCase wire format (FE Zustand 1:1).
신규 ORM/마이그레이션 없음 — 0001 모델(Collection/Tag/PaperTag/LibraryItem) 재사용.
"""
# ruff: noqa: N815

from __future__ import annotations

import time
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.api.papers import _get_owned, _paper_dict
from paperlight.auth.dependencies import get_user_id
from paperlight.models.chunk import Chunk
from paperlight.models.collection import Collection
from paperlight.models.library_item import LibraryItem
from paperlight.models.paper import Paper
from paperlight.models.paper_tag import PaperTag
from paperlight.models.tag import Tag
from paperlight.storage.db import get_session

router = APIRouter(prefix="/api/library", tags=["library"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]

STARRED_KIND = "starred"
SENTINEL_STARRED = "__starred__"
SENTINEL_UNREAD = "__unread__"
SENTINEL_RECENT = "__recent__"
SENTINEL_TRASH = "__trash__"


def _now_ms() -> int:
    return int(time.time() * 1000)


async def _get_special(session: AsyncSession, user_id: str, kind: str) -> Collection | None:
    row: Collection | None = await session.scalar(
        select(Collection).where(
            Collection.user_id == user_id,
            Collection.is_special.is_(True),
            Collection.special_kind == kind,
        )
    )
    return row


async def _paper_payload(session: AsyncSession, paper: Paper) -> dict[str, Any]:
    base = _paper_dict(paper)
    tag_rows = (
        (
            await session.execute(
                select(Tag)
                .join(PaperTag, PaperTag.tag_id == Tag.id)
                .where(PaperTag.paper_id == paper.id)
                .order_by(Tag.name)
            )
        )
        .scalars()
        .all()
    )
    base["tags"] = [{"id": t.id, "name": t.name, "color": t.color} for t in tag_rows]
    coll_ids = (
        (
            await session.execute(
                select(LibraryItem.collection_id).where(LibraryItem.paper_id == paper.id)
            )
        )
        .scalars()
        .all()
    )
    base["collectionIds"] = list(coll_ids)
    return base


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


_SORT_COLUMNS = {
    "created": Paper.created_at,
    "title": Paper.title,
    "year": Paper.year,
    "status": Paper.status,
}


@router.get("/papers")
async def list_library_papers(
    session: SessionDep,
    user_id: UserDep,
    collection_id: Annotated[str | None, Query(alias="collectionId")] = None,
    tag_ids: Annotated[str | None, Query(alias="tagIds")] = None,
    paper_status: Annotated[str | None, Query(alias="status")] = None,
    q: str | None = None,
    scope: str = "title,author",
    sort: str = "created",
    order: str = "desc",
) -> list[dict[str, Any]]:
    stmt = select(Paper).where(Paper.user_id == user_id)

    if collection_id == SENTINEL_TRASH:
        stmt = stmt.where(Paper.soft_deleted_at.is_not(None))
    else:
        stmt = stmt.where(Paper.soft_deleted_at.is_(None))
        if collection_id == SENTINEL_UNREAD:
            stmt = stmt.where(Paper.status == "to_read")
        elif collection_id == SENTINEL_RECENT:
            stmt = stmt.where(Paper.status != "to_read")
        elif collection_id == SENTINEL_STARRED:
            starred = await _get_special(session, user_id, STARRED_KIND)
            if starred is None:
                return []
            stmt = stmt.where(
                Paper.id.in_(
                    select(LibraryItem.paper_id).where(LibraryItem.collection_id == starred.id)
                )
            )
        elif collection_id:
            col = await _owned_collection(session, collection_id, user_id)
            stmt = stmt.where(
                Paper.id.in_(
                    select(LibraryItem.paper_id).where(LibraryItem.collection_id == col.id)
                )
            )

    if paper_status:
        stmt = stmt.where(Paper.status == paper_status)

    if tag_ids:
        for tid in (t for t in tag_ids.split(",") if t):
            stmt = stmt.where(Paper.id.in_(select(PaperTag.paper_id).where(PaperTag.tag_id == tid)))

    if q:
        scopes = {s for s in scope.split(",") if s}
        like = f"%{q}%"
        conds = []
        if "title" in scopes:
            conds.append(Paper.title.ilike(like))
        if "author" in scopes:
            conds.append(cast(Paper.authors, String).ilike(like))
        if "tag" in scopes:
            conds.append(
                Paper.id.in_(
                    select(PaperTag.paper_id)
                    .join(Tag, Tag.id == PaperTag.tag_id)
                    .where(Tag.name.ilike(like))
                )
            )
        if "content" in scopes:
            conds.append(Paper.id.in_(select(Chunk.paper_id).where(Chunk.text.ilike(like))))
        if conds:
            stmt = stmt.where(or_(*conds))

    if collection_id == SENTINEL_RECENT:
        stmt = stmt.order_by(Paper.updated_at.desc())
    else:
        sort_col = _SORT_COLUMNS.get(sort, Paper.created_at)
        stmt = stmt.order_by(sort_col.asc() if order == "asc" else sort_col.desc())

    rows = (await session.execute(stmt)).scalars().all()
    return [await _paper_payload(session, p) for p in rows]


class MembershipBody(BaseModel):
    paperIds: list[str]


@router.post("/collections/{cid}/papers", status_code=status.HTTP_204_NO_CONTENT)
async def add_papers_to_collection(
    cid: str, body: MembershipBody, session: SessionDep, user_id: UserDep
) -> None:
    await _owned_collection(session, cid, user_id)
    for pid in body.paperIds:
        await _get_owned(session, pid, user_id)
        existing = await session.get(LibraryItem, {"paper_id": pid, "collection_id": cid})
        if existing is None:
            session.add(LibraryItem(paper_id=pid, collection_id=cid))
    await session.commit()


@router.delete("/collections/{cid}/papers/{pid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_paper_from_collection(
    cid: str, pid: str, session: SessionDep, user_id: UserDep
) -> None:
    await _owned_collection(session, cid, user_id)
    await session.execute(
        delete(LibraryItem).where(LibraryItem.collection_id == cid, LibraryItem.paper_id == pid)
    )
    await session.commit()
