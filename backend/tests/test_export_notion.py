"""Export-Notion (F-11 보강) — stub-first POST + format 검증 + ownership."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import USER_A, MakePaper


async def _seed(client: AsyncClient, pid: str) -> None:
    await client.put(
        f"/api/annotations/papers/{pid}/note",
        json={"markdownText": "내 메모"},
        headers=USER_A,
    )


async def test_notion_stub_returns_markdown(
    client: AsyncClient, make_paper: MakePaper, monkeypatch
) -> None:
    monkeypatch.delenv("NOTION_TOKEN", raising=False)
    pid = await make_paper("user-a", title="Diffusion Models")
    await _seed(client, pid)
    resp = await client.post(f"/api/annotations/papers/{pid}/export/notion", headers=USER_A)
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "stub"
    assert body["url"] is None
    assert "# Diffusion Models" in body["markdown"]
    assert "내 메모" in body["markdown"]


async def test_export_notion_format_get_is_markdown(
    client: AsyncClient, make_paper: MakePaper
) -> None:
    pid = await make_paper("user-a", title="Plain")
    resp = await client.get(f"/api/annotations/papers/{pid}/export?format=notion", headers=USER_A)
    assert resp.status_code == 200
    assert "# Plain" in resp.text
    assert not resp.text.startswith("---")  # notion = plain markdown, no frontmatter


async def test_export_unknown_format_still_422(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    resp = await client.get(f"/api/annotations/papers/{pid}/export?format=pdf", headers=USER_A)
    assert resp.status_code == 422
