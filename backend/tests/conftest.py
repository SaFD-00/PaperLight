"""Shared async fixtures for library/API tests (S13).

`client`는 임시 SQLite + ASGI AsyncClient. 기존 테스트 파일은 자체 `client` fixture를
정의하므로(모듈 우선) 영향 없음 — 본 conftest는 라이브러리 신규 테스트용.
"""

from __future__ import annotations

import contextlib
import os
import tempfile
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import init_db, reset_engine, session_scope
from paperlight.storage.object_store import reset_object_store
from paperlight.storage.vector import reset_vector_store

USER_A = {"X-User-Id": "user-a"}
USER_B = {"X-User-Id": "user-b"}


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    reset_object_store()
    reset_vector_store()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    reset_object_store()
    reset_vector_store()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


MakePaper = Callable[..., Awaitable[str]]


@pytest.fixture
def make_paper() -> MakePaper:
    async def _make(
        user_id: str,
        *,
        title: str = "Paper",
        authors: list[str] | None = None,
        year: int | None = 2024,
        venue: str | None = None,
        arxiv_id: str | None = None,
        doi: str | None = None,
        paper_status: str = "to_read",
        soft_deleted: bool = False,
        chunks: list[str] | None = None,
    ) -> str:
        pid = str(uuid4())
        async with session_scope() as s:
            s.add(
                Paper(
                    id=pid,
                    user_id=user_id,
                    title=title,
                    authors=authors,
                    year=year,
                    venue=venue,
                    arxiv_id=arxiv_id,
                    doi=doi,
                    status=paper_status,
                    soft_deleted_at=(int(time.time() * 1000) if soft_deleted else None),
                )
            )
            for i, text in enumerate(chunks or []):
                s.add(
                    Chunk(
                        id=str(uuid4()),
                        paper_id=pid,
                        idx=i,
                        text=text,
                        page_num=1,
                        char_start=0,
                        char_end=len(text),
                        token_estimate=max(1, len(text) // 4),
                    )
                )
        return pid

    return _make
