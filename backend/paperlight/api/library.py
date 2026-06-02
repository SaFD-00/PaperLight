"""Library REST API — S13 (F-08 Zotero 4-pane).

user-scoped via shared `get_user_id`. camelCase wire format (FE Zustand 1:1).
신규 ORM/마이그레이션 없음 — 0001 모델(Collection/Tag/PaperTag/LibraryItem) 재사용.
"""
# ruff: noqa: N815

from __future__ import annotations

from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.agents import bib
from paperlight.api._ownership import get_owned_collection, get_owned_paper
from paperlight.api.papers import _paper_dict
from paperlight.auth.dependencies import get_user_id
from paperlight.models.chunk import Chunk
from paperlight.models.collection import Collection
from paperlight.models.library_item import LibraryItem
from paperlight.models.paper import Paper
from paperlight.models.paper_tag import PaperTag
from paperlight.models.tag import Tag
from paperlight.storage.db import get_session
from paperlight.utils.time import now_ms

router = APIRouter(prefix="/api/library", tags=["library"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[str, Depends(get_user_id)]

STARRED_KIND = "starred"
SENTINEL_STARRED = "__starred__"
SENTINEL_UNREAD = "__unread__"
SENTINEL_RECENT = "__recent__"
SENTINEL_TRASH = "__trash__"


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
        await get_owned_collection(session, body.parentId, user_id)
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
    col = await get_owned_collection(session, cid, user_id)
    fields = body.model_fields_set
    if "parentId" in fields:
        new_parent = body.parentId
        if new_parent is not None:
            if new_parent == cid:
                raise HTTPException(422, "collection cannot be its own parent")
            await get_owned_collection(session, new_parent, user_id)
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
    col.updated_at = now_ms()
    await session.commit()
    return await _collection_dict(session, col)


@router.delete("/collections/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(cid: str, session: SessionDep, user_id: UserDep) -> None:
    col = await get_owned_collection(session, cid, user_id)
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
            col = await get_owned_collection(session, collection_id, user_id)
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
    await get_owned_collection(session, cid, user_id)
    for pid in body.paperIds:
        await get_owned_paper(session, pid, user_id)
        existing = await session.get(LibraryItem, {"paper_id": pid, "collection_id": cid})
        if existing is None:
            session.add(LibraryItem(paper_id=pid, collection_id=cid))
    await session.commit()


@router.delete("/collections/{cid}/papers/{pid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_paper_from_collection(
    cid: str, pid: str, session: SessionDep, user_id: UserDep
) -> None:
    await get_owned_collection(session, cid, user_id)
    await session.execute(
        delete(LibraryItem).where(LibraryItem.collection_id == cid, LibraryItem.paper_id == pid)
    )
    await session.commit()


async def _get_or_create_tag(
    session: AsyncSession, user_id: str, name: str, color: str | None = None
) -> Tag:
    tag = await session.scalar(select(Tag).where(Tag.user_id == user_id, Tag.name == name))
    if tag is None:
        tag = Tag(id=str(uuid4()), user_id=user_id, name=name, color=color)
        session.add(tag)
        await session.flush()
    return tag


async def _get_or_create_special(
    session: AsyncSession, user_id: str, kind: str, name: str
) -> Collection:
    col = await _get_special(session, user_id, kind)
    if col is None:
        col = Collection(
            id=str(uuid4()),
            user_id=user_id,
            parent_id=None,
            name=name,
            is_special=True,
            special_kind=kind,
            position=0,
        )
        session.add(col)
        await session.flush()
    return col


@router.get("/tags")
async def list_tags(session: SessionDep, user_id: UserDep) -> list[dict[str, Any]]:
    tags = (
        (await session.execute(select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)))
        .scalars()
        .all()
    )
    out: list[dict[str, Any]] = []
    for t in tags:
        count = await session.scalar(
            select(func.count()).select_from(PaperTag).where(PaperTag.tag_id == t.id)
        )
        out.append({"id": t.id, "name": t.name, "color": t.color, "count": count or 0})
    return out


class TagBody(BaseModel):
    name: str = Field(min_length=1)
    color: str | None = None


@router.post("/papers/{pid}/tags", status_code=status.HTTP_201_CREATED)
async def add_paper_tag(
    pid: str, body: TagBody, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    await get_owned_paper(session, pid, user_id)
    tag = await _get_or_create_tag(session, user_id, body.name, body.color)
    if await session.get(PaperTag, {"paper_id": pid, "tag_id": tag.id}) is None:
        session.add(PaperTag(paper_id=pid, tag_id=tag.id))
    await session.commit()
    return {"id": tag.id, "name": tag.name, "color": tag.color}


@router.delete("/papers/{pid}/tags/{tid}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_paper_tag(pid: str, tid: str, session: SessionDep, user_id: UserDep) -> None:
    await get_owned_paper(session, pid, user_id)
    await session.execute(delete(PaperTag).where(PaperTag.paper_id == pid, PaperTag.tag_id == tid))
    await session.commit()


async def _set_starred(session: AsyncSession, user_id: str, pid: str, starred: bool) -> None:
    col = await _get_or_create_special(session, user_id, STARRED_KIND, "Starred")
    if starred:
        if await session.get(LibraryItem, {"paper_id": pid, "collection_id": col.id}) is None:
            session.add(LibraryItem(paper_id=pid, collection_id=col.id))
    else:
        await session.execute(
            delete(LibraryItem).where(
                LibraryItem.paper_id == pid, LibraryItem.collection_id == col.id
            )
        )


class PaperPatch(BaseModel):
    status: str | None = None
    starred: bool | None = None
    trashed: bool | None = None


@router.patch("/papers/{pid}")
async def patch_paper(
    pid: str, body: PaperPatch, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    paper = await get_owned_paper(session, pid, user_id, allow_deleted=True)
    if body.status is not None:
        paper.status = body.status
    if body.trashed is not None:
        paper.soft_deleted_at = now_ms() if body.trashed else None
    if body.starred is not None:
        await _set_starred(session, user_id, pid, body.starred)
    paper.updated_at = now_ms()
    await session.commit()
    return await _paper_payload(session, paper)


_BULK_ACTIONS = {"status", "addTag", "removeTag", "move", "trash", "restore"}


class BulkBody(BaseModel):
    paperIds: list[str]
    action: str
    value: str | None = None


@router.post("/bulk")
async def bulk_action(body: BulkBody, session: SessionDep, user_id: UserDep) -> dict[str, int]:
    if body.action not in _BULK_ACTIONS:
        raise HTTPException(422, f"unknown action: {body.action}")
    if body.action in {"status", "addTag", "removeTag", "move"} and not body.value:
        raise HTTPException(422, "value required for this action")

    target_collection = None
    if body.action == "move":
        assert body.value is not None
        target_collection = await get_owned_collection(session, body.value, user_id)

    affected = 0
    for pid in body.paperIds:
        paper = await session.get(Paper, pid)
        if paper is None or paper.user_id != user_id:
            continue
        if body.action == "status":
            paper.status = body.value or paper.status
            paper.updated_at = now_ms()
        elif body.action == "trash":
            paper.soft_deleted_at = now_ms()
        elif body.action == "restore":
            paper.soft_deleted_at = None
        elif body.action == "addTag":
            assert body.value is not None
            tag = await _get_or_create_tag(session, user_id, body.value)
            if await session.get(PaperTag, {"paper_id": pid, "tag_id": tag.id}) is None:
                session.add(PaperTag(paper_id=pid, tag_id=tag.id))
        elif body.action == "removeTag":
            existing_tag = await session.scalar(
                select(Tag).where(Tag.user_id == user_id, Tag.name == body.value)
            )
            if existing_tag is not None:
                await session.execute(
                    delete(PaperTag).where(
                        PaperTag.paper_id == pid, PaperTag.tag_id == existing_tag.id
                    )
                )
        elif body.action == "move":
            assert target_collection is not None
            if (
                await session.get(
                    LibraryItem,
                    {"paper_id": pid, "collection_id": target_collection.id},
                )
                is None
            ):
                session.add(LibraryItem(paper_id=pid, collection_id=target_collection.id))
        affected += 1
    await session.commit()
    return {"affected": affected}


class ImportBody(BaseModel):
    format: str
    content: str


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_references(
    body: ImportBody, session: SessionDep, user_id: UserDep
) -> dict[str, Any]:
    try:
        refs = bib.parse(body.format, body.content)
    except ValueError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from err
    created: list[Paper] = []
    for r in refs:
        paper = Paper(
            id=str(uuid4()),
            user_id=user_id,
            title=r.title,
            authors=r.authors or None,
            year=r.year,
            venue=r.venue,
            doi=r.doi,
            arxiv_id=r.arxiv_id,
            ingestion_status="pending",
        )
        session.add(paper)
        created.append(paper)
    await session.commit()
    return {"imported": len(created), "papers": [_paper_dict(p) for p in created]}


class ExportBody(BaseModel):
    paperIds: list[str]
    format: str


@router.post("/export")
async def export_references(
    body: ExportBody, session: SessionDep, user_id: UserDep
) -> PlainTextResponse:
    if body.format not in bib.FORMATS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown format: {body.format}")
    refs: list[bib.ParsedRef] = []
    for pid in body.paperIds:
        paper = await get_owned_paper(session, pid, user_id)
        refs.append(
            bib.ParsedRef(
                title=paper.title,
                authors=paper.authors or [],
                year=paper.year,
                venue=paper.venue,
                doi=paper.doi,
                arxiv_id=paper.arxiv_id,
            )
        )
    return PlainTextResponse(bib.export(body.format, refs))
