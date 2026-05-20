"""LLM response cache — key policy + hit/miss/expiry (S10)."""

from __future__ import annotations

import contextlib
import hashlib
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

from paperlight.models.cache import Cache
from paperlight.providers import cache
from paperlight.providers.router import primary_model
from paperlight.storage.db import init_db, reset_engine, session_scope


@pytest_asyncio.fixture
async def db() -> AsyncIterator[None]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    yield
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


def _content_id(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


async def _collect(text: str, prompt_version: str = "v1") -> str:
    out = ""
    async for token in cache.stream_with_cache(
        "explanation",
        [{"role": "user", "content": text}],
        text=text,
        prompt_version=prompt_version,
    ):
        out += token
    return out


def test_cache_key_includes_prompt_version() -> None:
    k1 = cache.cache_key("explanation", None, "c", "m", "v1")
    k2 = cache.cache_key("explanation", None, "c", "m", "v2")
    assert k1 != k2


async def test_miss_then_write(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    out = await _collect("hello")
    assert out.startswith("[stub:")
    key = cache.cache_key(
        "explanation", None, _content_id("hello"), primary_model("explanation"), "v1"
    )
    async with session_scope() as session:
        row = await session.get(Cache, key)
    assert row is not None
    assert row.response["text"] == out


async def test_hit_replays_stored(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await _collect("hello")
    key = cache.cache_key(
        "explanation", None, _content_id("hello"), primary_model("explanation"), "v1"
    )
    async with session_scope() as session:
        row = await session.get(Cache, key)
        row.response = {"text": "SENTINEL", "model": "x"}  # type: ignore[union-attr]
    # second call must read the (overwritten) cache, not regenerate
    assert await _collect("hello") == "SENTINEL"


async def test_expired_is_ignored(db: None) -> None:
    await cache._write("k", "explanation", None, "txt", "m", 3600)
    async with session_scope() as session:
        row = await session.get(Cache, "k")
        row.expires_at = cache._now() - 10  # type: ignore[union-attr]
    assert await cache._read("k") is None


async def test_prompt_version_separates_keys(db: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    await _collect("hello", prompt_version="v1")
    await _collect("hello", prompt_version="v2")
    model = primary_model("explanation")
    k1 = cache.cache_key("explanation", None, _content_id("hello"), model, "v1")
    k2 = cache.cache_key("explanation", None, _content_id("hello"), model, "v2")
    async with session_scope() as session:
        assert await session.get(Cache, k1) is not None
        assert await session.get(Cache, k2) is not None
