"""Async SQLAlchemy setup.

Phase 1 S7a: `DATABASE_URL` (Postgres) 우선, `PAPERLIGHT_DB_URL`은 backward-compat.
default는 SQLite로 유지 — Phase 0 회귀 호환.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

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
    return create_async_engine(url, future=True, connect_args=connect_args)


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


DEFAULT_USER_ID = "anonymous"


async def init_db() -> None:
    import paperlight.models  # noqa: F401 — register all ORM tables before create_all

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Phase 1 S7a: ensure default user row exists for unauthenticated tab/library flows.
    # 실제 OAuth(S7b) 합류 시 anonymous는 게스트 모드로 격하.
    await _ensure_default_user()


async def _ensure_default_user() -> None:
    # Avoid import cycle: User imports Base from this module.
    from paperlight.models.user import User

    factory = get_session_factory()
    async with factory() as session:
        existing = await session.get(User, DEFAULT_USER_ID)
        if existing is None:
            session.add(
                User(
                    id=DEFAULT_USER_ID,
                    email="anonymous@local",
                    google_sub=None,
                )
            )
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
