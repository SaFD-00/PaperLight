"""Async SQLAlchemy setup — SQLite only (single-user local app).

`DATABASE_URL` 로 경로 재정의 가능, 기본은 로컬 `./paperlight.db`.
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)

_DEFAULT_URL = "sqlite+aiosqlite:///./paperlight.db"


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        os.environ.get("PAPERLIGHT_DB_URL", _DEFAULT_URL),
    )


def _build_engine(url: str) -> AsyncEngine:
    connect_args: dict[str, Any] = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    engine = create_async_engine(url, future=True, connect_args=connect_args)
    if url.startswith("sqlite"):
        # SQLite is single-writer: concurrent cache writes (translate/explain SSE +
        # pregen) otherwise fail instantly with "database is locked". busy_timeout
        # makes writers wait; WAL lets readers proceed during a write. :memory:
        # ignores WAL (no error).
        @event.listens_for(engine.sync_engine, "connect")
        def _sqlite_pragmas(dbapi_conn: Any, _record: Any) -> None:
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.close()

    return engine


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = _build_engine(get_database_url())
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def init_db() -> None:
    import paperlight.models  # noqa: F401 — register all ORM tables before create_all

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_additive_migrations)
    # Single-user app: ensure the one local user row exists for all data scoping.
    await _ensure_default_user()


def _apply_additive_migrations(sync_conn: Any) -> None:
    """기존 테이블에 모델 신규 컬럼을 보강하는 additive 마이그레이션.

    `create_all` 은 없는 테이블만 만들고 **이미 존재하는 테이블에 새 컬럼을 추가하지
    않는다**(Alembic 같은 마이그레이션 도구도 없음). 그래서 모델에 컬럼을 추가하면 예전에
    만들어진 DB 에는 그 컬럼이 없어 `no such column` 으로 깨진다(예: `chunks.embedding`).
    create_all 직후, 모델에는 있으나 실제 테이블에 없는 컬럼을 `ALTER TABLE ADD COLUMN`
    으로 채워 기존 DB 와 하위 호환을 맞춘다. 누락 컬럼이 없으면 no-op 이라 idempotent.

    한계: **추가(additive)만 안전하다.** 컬럼 rename/drop/타입 변경, 그리고 서버 기본값이
    없는 NOT NULL 컬럼 추가는 SQLite ALTER 제약상 자동 처리되지 않는다. 그런 컬럼은 경고만
    남기고 건너뛰며(서버는 계속 기동), DB 리셋 또는 수동 마이그레이션이 필요하다.
    """
    from sqlalchemy import inspect as sa_inspect
    from sqlalchemy.dialects.sqlite import dialect as sqlite_dialect
    from sqlalchemy.schema import CreateColumn

    inspector = sa_inspect(sync_conn)
    live_tables = set(inspector.get_table_names())
    dialect = sqlite_dialect()
    for table in Base.metadata.sorted_tables:
        if table.name not in live_tables:
            continue  # 신규 테이블은 create_all 이 이미 생성함
        live_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in live_cols:
                continue
            col_ddl = str(CreateColumn(column).compile(dialect=dialect))
            try:
                sync_conn.exec_driver_sql(
                    f'ALTER TABLE "{table.name}" ADD COLUMN {col_ddl}'
                )
                logger.info("schema: added missing column %s.%s", table.name, column.name)
            except OperationalError:
                logger.warning(
                    "schema: could not auto-add %s.%s (SQLite ALTER 제약). "
                    "DB 리셋 또는 수동 마이그레이션이 필요할 수 있음.",
                    table.name,
                    column.name,
                )


async def _ensure_default_user() -> None:
    # Avoid import cycle: User imports Base from this module.
    from paperlight.local_user import LOCAL_USER_ID
    from paperlight.models.user import User

    factory = get_session_factory()
    async with factory() as session:
        existing = await session.get(User, LOCAL_USER_ID)
        if existing is None:
            session.add(User(id=LOCAL_USER_ID, email="local@paperlight"))
            await session.commit()


async def reset_engine(url: str | None = None) -> None:
    """Test-only: dispose engine and rebuild with a fresh URL."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
    if url is not None:
        os.environ["DATABASE_URL"] = url
        os.environ["PAPERLIGHT_DB_URL"] = url
    else:
        os.environ.pop("DATABASE_URL", None)
        os.environ.pop("PAPERLIGHT_DB_URL", None)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency."""
    factory = get_session_factory()
    async with factory() as session:
        yield session
