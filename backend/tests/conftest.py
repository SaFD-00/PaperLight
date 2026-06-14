"""Shared async fixtures for API tests.

`client`는 임시 SQLite + 임시 object-store 디렉터리 + ASGI AsyncClient. 단일 로컬
사용자 모델이므로 `make_paper`는 `user_id` 인자와 무관하게 항상 LOCAL_USER_ID 소유로
논문을 만들고, 청크에는 임베딩을 채워 채팅 검색(SQLite cosine)이 동작하게 한다.
"""

from __future__ import annotations

import contextlib
import os
import shutil
import tempfile
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.ingestion.embedder import embed, pack_embedding
from paperlight.local_user import LOCAL_USER_ID
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.storage.db import init_db, reset_engine, session_scope
from paperlight.storage.object_store import reset_object_store

# 단일 사용자 모델: X-User-Id 헤더는 무시된다(get_user_id가 항상 LOCAL_USER_ID).
# 기존 호출부 호환을 위해 이름만 유지하고 실제 격리는 하지 않는다.
USER_A: dict[str, str] = {}
USER_B: dict[str, str] = {}


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    data_dir = tempfile.mkdtemp(prefix="paperlight-data-")
    prev_data_dir = os.environ.get("PAPERLIGHT_DATA_DIR")
    os.environ["PAPERLIGHT_DATA_DIR"] = data_dir
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    reset_object_store()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    reset_object_store()
    if prev_data_dir is None:
        os.environ.pop("PAPERLIGHT_DATA_DIR", None)
    else:
        os.environ["PAPERLIGHT_DATA_DIR"] = prev_data_dir
    shutil.rmtree(data_dir, ignore_errors=True)
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


MakePaper = Callable[..., Awaitable[str]]


@pytest.fixture
def make_paper() -> MakePaper:
    async def _make(
        user_id: str = LOCAL_USER_ID,
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
        # 단일 사용자 모델: 전달된 user_id는 무시하고 항상 로컬 사용자 소유로 생성한다.
        pid = str(uuid4())
        chunk_texts = chunks or []
        vectors = embed(chunk_texts) if chunk_texts else []
        async with session_scope() as s:
            s.add(
                Paper(
                    id=pid,
                    user_id=LOCAL_USER_ID,
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
            for i, text in enumerate(chunk_texts):
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
                        embedding=pack_embedding(vectors[i]),
                    )
                )
        return pid

    return _make
