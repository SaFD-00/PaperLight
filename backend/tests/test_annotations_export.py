"""S14 — annotation export (markdown / obsidian) + ownership."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import USER_A, MakePaper

BBOX = {"rects": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.04}]}


async def _seed(client: AsyncClient, pid: str) -> None:
    await client.post(
        f"/api/annotations/papers/{pid}/highlights",
        json={"page": 2, "bbox": BBOX, "text": "key sentence", "color": "yellow"},
        headers=USER_A,
    )
    await client.put(
        f"/api/annotations/papers/{pid}/note",
        json={"markdownText": "내 메모 본문"},
        headers=USER_A,
    )


async def test_export_markdown(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="Diffusion Models", authors=["Ho, J."])
    await _seed(client, pid)
    resp = await client.get(f"/api/annotations/papers/{pid}/export?format=markdown", headers=USER_A)
    assert resp.status_code == 200
    body = resp.text
    assert "# Diffusion Models" in body
    assert "key sentence" in body
    assert "내 메모 본문" in body
    assert not body.startswith("---")  # no frontmatter for plain markdown


async def test_export_obsidian_has_frontmatter(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="GUI World Model", arxiv_id="2605.10347")
    await _seed(client, pid)
    resp = await client.get(f"/api/annotations/papers/{pid}/export?format=obsidian", headers=USER_A)
    assert resp.status_code == 200
    body = resp.text
    assert body.startswith("---")
    assert "title: GUI World Model" in body
    assert "arxiv: 2605.10347" in body
    assert "내 메모 본문" in body


async def test_export_default_is_markdown(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="Plain")
    resp = await client.get(f"/api/annotations/papers/{pid}/export", headers=USER_A)
    assert resp.status_code == 200
    assert "# Plain" in resp.text


async def test_export_unknown_format_422(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    resp = await client.get(f"/api/annotations/papers/{pid}/export?format=pdf", headers=USER_A)
    assert resp.status_code == 422
