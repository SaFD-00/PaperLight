"""Alembic env — async SQLAlchemy 2.0 (sync URL normalization for both sqlite and postgres)."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from paperlight.models import (  # noqa: F401 — import side-effect registers tables on Base.metadata
    Cache,
    Collection,
    Highlight,
    LibraryItem,
    Note,
    Paper,
    PaperTag,
    Podcast,
    Tab,
    Tag,
    User,
)
from paperlight.storage.db import Base, get_database_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolved_url() -> str:
    # `-x url=...` 또는 환경변수 DATABASE_URL 우선
    cli_url = context.get_x_argument(as_dictionary=True).get("url")
    return cli_url or get_database_url()


def run_migrations_offline() -> None:
    url = _resolved_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=url.startswith("sqlite"),
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    cfg = config.get_section(config.config_ini_section) or {}
    cfg["sqlalchemy.url"] = _resolved_url()
    connectable = async_engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    url = _resolved_url()
    if url.startswith("sqlite") and "+aiosqlite" not in url:
        # Plain sync sqlite path (rare) — fall back to sync engine.
        cfg = config.get_section(config.config_ini_section) or {}
        cfg["sqlalchemy.url"] = url
        connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
        with connectable.connect() as connection:
            do_run_migrations(connection)
        return
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
