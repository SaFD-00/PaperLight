"""S14 — annotation highlights CRUD + ownership."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from tests.conftest import USER_A, USER_B, MakePaper

BBOX = {"rects": [{"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.04}]}


async def _create(
    client: AsyncClient, pid: str, headers: dict[str, str], **over: Any
) -> dict[str, Any]:
    body = {"page": 1, "bbox": BBOX, "text": "selected", "color": "yellow", **over}
    resp = await client.post(
        f"/api/annotations/papers/{pid}/highlights", json=body, headers=headers
    )
    assert resp.status_code == 201, resp.text
    data: dict[str, Any] = resp.json()
    return data


async def test_create_and_list(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    created = await _create(client, pid, USER_A)
    assert created["source"] == "user"
    assert created["category"] == "user_custom"
    assert created["bbox"] == BBOX

    resp = await client.get(f"/api/annotations/papers/{pid}/highlights", headers=USER_A)
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["color"] == "yellow"
    assert rows[0]["page"] == 1


async def test_delete_removes_highlight(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    created = await _create(client, pid, USER_A)

    resp = await client.delete(f"/api/annotations/highlights/{created['id']}", headers=USER_A)
    assert resp.status_code == 204

    rows = (await client.get(f"/api/annotations/papers/{pid}/highlights", headers=USER_A)).json()
    assert rows == []


async def test_delete_unknown_404(client: AsyncClient) -> None:
    resp = await client.delete("/api/annotations/highlights/nope", headers=USER_A)
    assert resp.status_code == 404


async def test_list_other_user_forbidden(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    await _create(client, pid, USER_A)
    resp = await client.get(f"/api/annotations/papers/{pid}/highlights", headers=USER_B)
    assert resp.status_code == 403


async def test_delete_other_user_forbidden(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    created = await _create(client, pid, USER_A)
    resp = await client.delete(f"/api/annotations/highlights/{created['id']}", headers=USER_B)
    assert resp.status_code == 403


async def test_create_on_others_paper_forbidden(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    resp = await client.post(
        f"/api/annotations/papers/{pid}/highlights",
        json={"page": 1, "bbox": BBOX},
        headers=USER_B,
    )
    assert resp.status_code == 403
