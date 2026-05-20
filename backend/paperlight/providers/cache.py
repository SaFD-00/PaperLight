"""LLM response cache (PRD §7.5 key). Wraps router.stream_task with read/replay.

Cache key = sha256(task | paper_id | content_id | model | prompt_version) where
content_id is the chunk_id when known, else a hash of the input text so ad-hoc
selections don't collide. prompt_version invalidates the cache when a prompt
changes (PRD §7.5 — omitting it causes cache pollution).
"""

from __future__ import annotations

import hashlib
import os
import time
from collections.abc import AsyncIterator

from paperlight.models.cache import Cache
from paperlight.providers.router import primary_model, stream_task
from paperlight.storage.db import session_scope

DEFAULT_TTL_SECONDS = int(os.environ.get("LLM_CACHE_TTL_SECONDS", str(30 * 24 * 3600)))


def _now() -> int:
    return int(time.time())


def cache_key(
    task: str,
    paper_id: str | None,
    chunk_id: str | None,
    model: str,
    prompt_version: str,
) -> str:
    raw = f"{task}|{paper_id or ''}|{chunk_id or ''}|{model}|{prompt_version}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _read(key: str) -> str | None:
    async with session_scope() as session:
        row = await session.get(Cache, key)
        if row is None:
            return None
        if row.expires_at is not None and row.expires_at < _now():
            return None
        text = row.response.get("text")
        return text if isinstance(text, str) else None


async def _write(
    key: str,
    task: str,
    paper_id: str | None,
    text: str,
    model: str,
    ttl: int,
) -> None:
    payload = {"text": text, "model": model}
    expires_at = _now() + ttl if ttl else None
    async with session_scope() as session:
        existing = await session.get(Cache, key)
        if existing is not None:
            existing.response = payload
            existing.expires_at = expires_at
        else:
            session.add(
                Cache(
                    key=key,
                    task=task,
                    paper_id=paper_id,
                    response=payload,
                    expires_at=expires_at,
                )
            )


async def read_cached(
    task: str,
    *,
    paper_id: str | None,
    chunk_id: str,
    prompt_version: str,
) -> str | None:
    """Read a cached response without triggering generation (pre-gen GET path)."""
    key = cache_key(task, paper_id, chunk_id, primary_model(task), prompt_version)
    return await _read(key)


async def stream_with_cache(
    task: str,
    messages: list[dict[str, str]],
    *,
    text: str,
    prompt_version: str,
    paper_id: str | None = None,
    chunk_id: str | None = None,
    ttl: int = DEFAULT_TTL_SECONDS,
) -> AsyncIterator[str]:
    model = primary_model(task)
    content_id = chunk_id or hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    key = cache_key(task, paper_id, content_id, model, prompt_version)

    cached = await _read(key)
    if cached is not None:
        yield cached
        return

    buffer: list[str] = []
    async for token in stream_task(task, messages):
        buffer.append(token)
        yield token
    full = "".join(buffer)
    if full.strip():
        await _write(key, task, paper_id, full, model, ttl)
