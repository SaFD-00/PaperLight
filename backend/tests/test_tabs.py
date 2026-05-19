"""Tabs API smoke tests — Phase 0 S3 (T5)."""

from __future__ import annotations

import contextlib
import os
import tempfile
import time
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.storage.db import init_db, reset_engine


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


def _now() -> int:
    return int(time.time() * 1000)


def _payload(**overrides: object) -> dict[str, object]:
    now = _now()
    base: dict[str, object] = {
        "id": "t1",
        "paperId": "p1",
        "title": "Sample",
        "position": 1,
        "pinned": False,
        "isLibrary": False,
        "openedAt": now,
        "lastActiveAt": now,
        "updatedAt": now,
    }
    base.update(overrides)
    return base


async def test_list_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/tabs")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_upsert_creates_library(client: AsyncClient) -> None:
    now = _now()
    resp = await client.post(
        "/api/tabs",
        json=_payload(
            id="library",
            paperId=None,
            title="📚",
            position=0,
            pinned=True,
            isLibrary=True,
            openedAt=now,
            lastActiveAt=now,
            updatedAt=now,
        ),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == "library"
    assert body["isLibrary"] is True


async def test_older_updated_at_ignored(client: AsyncClient) -> None:
    now = _now()
    await client.post("/api/tabs", json=_payload(title="Original", updatedAt=now + 1000))
    resp = await client.patch("/api/tabs/t1", json={"title": "Stale", "updatedAt": now})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Original"


async def test_newer_updated_at_wins(client: AsyncClient) -> None:
    now = _now()
    await client.post("/api/tabs", json=_payload(title="Old", updatedAt=now))
    resp = await client.patch("/api/tabs/t1", json={"title": "New", "updatedAt": now + 1000})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New"


async def test_delete_non_library(client: AsyncClient) -> None:
    await client.post("/api/tabs", json=_payload())
    resp = await client.delete("/api/tabs/t1")
    assert resp.status_code == 204
    assert (await client.get("/api/tabs")).json() == []


async def test_delete_library_forbidden(client: AsyncClient) -> None:
    now = _now()
    await client.post(
        "/api/tabs",
        json=_payload(
            id="library",
            paperId=None,
            title="📚",
            position=0,
            pinned=True,
            isLibrary=True,
            openedAt=now,
            lastActiveAt=now,
            updatedAt=now,
        ),
    )
    resp = await client.delete("/api/tabs/library")
    assert resp.status_code == 400


async def test_list_orders_by_position(client: AsyncClient) -> None:
    await client.post("/api/tabs", json=_payload(id="t2", position=2))
    await client.post("/api/tabs", json=_payload(id="t1", position=1))
    body = (await client.get("/api/tabs")).json()
    assert [t["id"] for t in body] == ["t1", "t2"]
