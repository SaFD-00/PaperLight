"""Papers API tests — S8/S9 (fixture-first import → ingest → search/isolation)."""

from __future__ import annotations

import asyncio
import contextlib
import os
import shutil
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from paperlight.storage.db import init_db, reset_engine
from paperlight.storage.object_store import reset_object_store

PILOT_ID = "2602.09856"
# 단일 사용자 모델: X-User-Id 헤더는 무시된다.
USER_A: dict[str, str] = {}


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    monkeypatch.setenv("LLM_PROVIDER", "stub")  # S11 pre-gen runs after ingest — keep offline
    data_dir = tempfile.mkdtemp(prefix="paperlight-data-")
    monkeypatch.setenv("PAPERLIGHT_DATA_DIR", data_dir)
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    reset_object_store()
    from paperlight.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await reset_engine()
    reset_object_store()
    shutil.rmtree(data_dir, ignore_errors=True)
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


async def test_list_papers_returns_imported(client: AsyncClient) -> None:
    await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    papers = (await client.get("/api/papers", headers=USER_A)).json()
    assert len(papers) == 1
    assert papers[0]["arxivId"] == PILOT_ID


async def test_get_missing_paper_404(client: AsyncClient) -> None:
    resp = await client.get("/api/papers/does-not-exist", headers=USER_A)
    assert resp.status_code == 404


async def test_pdf_url_and_stream(client: AsyncClient) -> None:
    created = (
        await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    ).json()
    paper_id = created["id"]
    url_resp = await client.get(f"/api/papers/{paper_id}/pdf-url", headers=USER_A)
    assert url_resp.status_code == 200
    url = url_resp.json()["url"]
    # 토큰/서명 없는 plain URL이어야 한다.
    assert url.endswith(f"/api/papers/{paper_id}/pdf")
    assert "exp=" not in url and "sig=" not in url

    stream = await client.get(f"/api/papers/{paper_id}/pdf")
    assert stream.status_code == 200
    assert stream.headers["content-type"] == "application/pdf"
    assert stream.content[:4] == b"%PDF"


async def test_ingestion_sse_reports_ready(client: AsyncClient) -> None:
    created = (
        await client.post("/api/papers/import", json={"arxivId": PILOT_ID}, headers=USER_A)
    ).json()
    resp = await client.get(f"/api/papers/{created['id']}/ingestion", headers=USER_A)
    assert resp.status_code == 200
    assert "ready" in resp.text
    assert "[DONE]" in resp.text


async def test_upload_pdf_creates_paper_and_serves_it(client: AsyncClient) -> None:
    pdf_path = (
        Path(__file__).resolve().parents[2]
        / "fixtures"
        / "pilot-papers"
        / f"{PILOT_ID}-code2world.pdf"
    )
    res = await client.post(
        "/api/papers/upload",
        files={"file": ("Code2World Study.pdf", pdf_path.read_bytes(), "application/pdf")},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "Code2World Study"  # 파일명에서 유도(.pdf 제거)
    paper_id = body["id"]

    listing = await client.get("/api/papers")
    assert any(p["id"] == paper_id for p in listing.json())

    assert await _wait_ready(client, paper_id, USER_A) == "ready"
    stream = await client.get(f"/api/papers/{paper_id}/pdf")
    assert stream.status_code == 200
    assert stream.content[:4] == b"%PDF"


async def test_upload_rejects_non_pdf(client: AsyncClient) -> None:
    res = await client.post(
        "/api/papers/upload",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )
    assert res.status_code == 400
