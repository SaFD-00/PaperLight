"""F-09 Deep Search — 관심 벡터 / stub 추천 / API + 사용자 격리."""

from __future__ import annotations

from httpx import AsyncClient

from paperlight.ingestion.embedder import EMBED_DIM
from paperlight.services.library_service import interest_vector
from tests.conftest import USER_A, USER_B, MakePaper


async def test_interest_vector_is_normalized(make_paper: MakePaper) -> None:
    await make_paper("user-a", chunks=["트랜스포머 구조", "어텐션 메커니즘"])
    vec = await interest_vector("user-a")
    assert vec is not None
    assert len(vec) == EMBED_DIM
    norm = sum(x * x for x in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-6


async def test_interest_vector_none_without_chunks(make_paper: MakePaper) -> None:
    await make_paper("user-b")  # 청크 없음
    assert await interest_vector("user-b") is None


async def test_deep_search_returns_deterministic_results(
    client: AsyncClient, make_paper: MakePaper
) -> None:
    await make_paper("user-a", chunks=["배경"])
    r1 = await client.post(
        "/api/deep-search", json={"query": "diffusion", "limit": 5}, headers=USER_A
    )
    r2 = await client.post(
        "/api/deep-search", json={"query": "diffusion", "limit": 5}, headers=USER_A
    )
    assert r1.status_code == 200
    results = r1.json()["results"]
    assert len(results) == 5
    assert all(c["why"] for c in results)
    assert all("diffusion" in c["title"] for c in results)
    assert r1.json() == r2.json()  # deterministic


async def test_interests_endpoint_reports_count(client: AsyncClient, make_paper: MakePaper) -> None:
    await make_paper("user-a", chunks=["내용"])
    resp = await client.get("/api/deep-search/interests", headers=USER_A)
    assert resp.status_code == 200
    body = resp.json()
    assert body["paperCount"] == 1
    assert body["ready"] is True


async def test_interests_empty_for_other_user(client: AsyncClient, make_paper: MakePaper) -> None:
    await make_paper("user-a", chunks=["내용"])
    resp = await client.get("/api/deep-search/interests", headers=USER_B)
    assert resp.json() == {"ready": False, "paperCount": 0}
