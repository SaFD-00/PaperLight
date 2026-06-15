"""init_db() additive auto-migration 회귀 테스트.

`create_all` 은 기존 테이블에 새 컬럼을 추가하지 않으므로, 예전 스키마 DB 에 모델 신규
컬럼(예: `chunks.embedding`)이 없으면 `no such column` 으로 깨진다. init_db() 가 누락
컬럼을 `ALTER TABLE ADD COLUMN` 으로 자동 보강하는지 검증한다. (asyncio_mode=auto)
"""

from __future__ import annotations

import contextlib
import os
import tempfile

from sqlalchemy import inspect

from paperlight.storage.db import get_engine, init_db, reset_engine


def _columns(sync_conn: object, table: str) -> set[str]:
    return {c["name"] for c in inspect(sync_conn).get_columns(table)}


async def test_init_db_backfills_missing_column() -> None:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        await reset_engine(f"sqlite+aiosqlite:///{path}")
        await init_db()  # 전체 스키마 생성(chunks.embedding 포함)

        # 예전 스키마 재현: embedding 컬럼을 떼어내 'no such column' 상황을 만든다.
        async with get_engine().begin() as conn:
            assert "embedding" in await conn.run_sync(lambda c: _columns(c, "chunks"))
            await conn.exec_driver_sql("ALTER TABLE chunks DROP COLUMN embedding")
            assert "embedding" not in await conn.run_sync(lambda c: _columns(c, "chunks"))

        # 두 번째 init_db 가 누락 컬럼을 자동 복구해야 한다.
        await init_db()
        async with get_engine().begin() as conn:
            assert "embedding" in await conn.run_sync(lambda c: _columns(c, "chunks"))
    finally:
        await reset_engine()
        with contextlib.suppress(FileNotFoundError):
            os.unlink(path)
