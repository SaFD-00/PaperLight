"""소유권 검증 헬퍼 — 대상이 없으면 404, 다른 사용자 소유면 403."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from paperlight.models.highlight import Highlight
from paperlight.models.paper import Paper


async def get_owned_paper(
    session: AsyncSession, paper_id: str, user_id: str, *, allow_deleted: bool = False
) -> Paper:
    """소유한 논문을 반환. allow_deleted=True면 soft-deleted 행도 허용(복원용)."""
    paper = await session.get(Paper, paper_id)
    if paper is None or (not allow_deleted and paper.soft_deleted_at is not None):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "paper not found")
    if paper.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "paper belongs to another user")
    return paper


async def get_owned_highlight(session: AsyncSession, hid: str, user_id: str) -> Highlight:
    """소유한 하이라이트를 반환."""
    h = await session.get(Highlight, hid)
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "highlight not found")
    if h.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "highlight belongs to another user")
    return h
