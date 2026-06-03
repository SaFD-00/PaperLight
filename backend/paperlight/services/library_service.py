"""Library service — F-09 관심 벡터(사용자 라이브러리 청크 임베딩 평균)."""

from __future__ import annotations

import asyncio

import numpy as np
from sqlalchemy import select

from paperlight.ingestion.embedder import embed
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import session_scope

_MAX_TEXTS = 40


async def _user_chunk_texts(user_id: str) -> list[str]:
    async with session_scope() as s:
        rows = (
            (
                await s.execute(
                    select(Chunk.text)
                    .join(Paper, Paper.id == Chunk.paper_id)
                    .where(Paper.user_id == user_id, Paper.soft_deleted_at.is_(None))
                    .limit(_MAX_TEXTS)
                )
            )
            .scalars()
            .all()
        )
    return [t for t in rows if t]


async def paper_count(user_id: str) -> int:
    async with session_scope() as s:
        rows = (
            (
                await s.execute(
                    select(Paper.id).where(
                        Paper.user_id == user_id, Paper.soft_deleted_at.is_(None)
                    )
                )
            )
            .scalars()
            .all()
        )
    return len(rows)


async def interest_vector(user_id: str) -> list[float] | None:
    """사용자 라이브러리 청크 임베딩의 정규화 평균(없으면 None)."""
    texts = await _user_chunk_texts(user_id)
    if not texts:
        return None
    vectors = await asyncio.to_thread(embed, texts)
    mean = np.asarray(vectors, dtype=float).mean(axis=0)
    norm = float(np.linalg.norm(mean))
    if norm == 0.0:
        return None
    return (mean / norm).tolist()
