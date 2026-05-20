"""Papers API tests — S8/S9 (fixture-first import → ingest → search/isolation)."""

from __future__ import annotations

import asyncio
import contextlib
import os
import tempfile
from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlparse

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.storage.db import init_db, reset_engine
from paperlight.storage.object_store import reset_object_store
from paperlight.storage.vector import reset_vector_store

PILOT_ID = "2602.09856"
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


async def _wait_ready(client: AsyncClient, paper_id: str, headers: dict[str, str]) -> str:
    for _ in range(40):
        resp = await client.get(f"/api/papers/{paper_id}", headers=headers)
        ingestion = resp.json()["ingestionStatus"]
        if ingestion in ("ready", "failed"):
            return ingestion
        await asyncio.sleep(0.1)
    return "timeout"


async def test_arxiv_meta_fixture(client: AsyncClient) -> None:
    resp = await client.get(f"/api/papers/arxiv/{PILOT_ID}")
    assert resp.status_code == 200
    body = resp.json()
    assert "Code2World" in body["title"]
    assert body["arxivId"] == PILOT_ID
    assert body["authors"]


async def test_arxiv_meta_invalid_id_400(client: AsyncClient) -> None:
    resp = await client.get("/api/papers/arxiv/not-an-id")
    assert resp.status_code == 400


async def test_import_creates_paper_and_ingests(client: AsyncClient) -> None:
    resp = await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    assert resp.status_code == 201
    paper = resp.json()
    assert paper["arxivId"] == PILOT_ID
    assert paper["id"]
    assert await _wait_ready(client, paper["id"], USER_A) == "ready"


async def test_import_requires_id_or_url(client: AsyncClient) -> None:
    resp = await client.post("/api/papers/import", json={}, headers=USER_A)
    assert resp.status_code == 422


async def test_list_papers_isolated_per_user(client: AsyncClient) -> None:
    await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    a_list = (await client.get("/api/papers", headers=USER_A)).json()
    b_list = (await client.get("/api/papers", headers=USER_B)).json()
    assert len(a_list) == 1
    assert len(b_list) == 0


async def test_get_paper_forbidden_for_other_user(client: AsyncClient) -> None:
    created = (
        await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    ).json()
    resp = await client.get(f"/api/papers/{created['id']}", headers=USER_B)
    assert resp.status_code == 403


async def test_pdf_url_presigned_and_stream(client: AsyncClient) -> None:
    created = (
        await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    ).json()
    paper_id = created["id"]
    url_resp = await client.get(f"/api/papers/{paper_id}/pdf-url", headers=USER_A)
    assert url_resp.status_code == 200
    url = url_resp.json()["url"]
    assert f"/api/papers/{paper_id}/pdf" in url

    qs = parse_qs(urlparse(url).query)
    stream = await client.get(
        f"/api/papers/{paper_id}/pdf", params={"exp": qs["exp"][0], "sig": qs["sig"][0]}
    )
    assert stream.status_code == 200
    assert stream.headers["content-type"] == "application/pdf"
    assert stream.content[:4] == b"%PDF"


async def test_pdf_stream_bad_token_403(client: AsyncClient) -> None:
    created = (
        await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    ).json()
    resp = await client.get(
        f"/api/papers/{created['id']}/pdf", params={"exp": 9999999999, "sig": "bad"}
    )
    assert resp.status_code == 403


async def test_ingestion_sse_reports_ready(client: AsyncClient) -> None:
    created = (
        await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    ).json()
    resp = await client.get(f"/api/papers/{created['id']}/ingestion", headers=USER_A)
    assert resp.status_code == 200
    assert "ready" in resp.text
    assert "[DONE]" in resp.text
