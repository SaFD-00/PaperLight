"""Library tags + status/star/trash toggles + bulk actions — S13 (F-08)."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from tests.conftest import USER_A, MakePaper


async def _papers(client: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    resp = await client.get("/api/library/papers", params=params, headers=USER_A)
    assert resp.status_code == 200, resp.text
    body: list[dict[str, Any]] = resp.json()
    return body


async def test_tag_get_or_create_and_count(client: AsyncClient, make_paper: MakePaper) -> None:
    p1 = await make_paper("user-a", title="P1")
    p2 = await make_paper("user-a", title="P2")

    t1 = await client.post(f"/api/library/papers/{p1}/tags", json={"name": "AI"}, headers=USER_A)
    assert t1.status_code == 201
    tag_id = t1.json()["id"]
    # same name on another paper reuses the tag
    t2 = await client.post(f"/api/library/papers/{p2}/tags", json={"name": "AI"}, headers=USER_A)
    assert t2.json()["id"] == tag_id

    tags = (await client.get("/api/library/tags", headers=USER_A)).json()
    assert len(tags) == 1
    assert tags[0]["count"] == 2


async def test_tag_remove_and_scope_search(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="Tagged")
    await client.post(
        f"/api/library/papers/{pid}/tags", json={"name": "generative"}, headers=USER_A
    )

    found = await _papers(client, q="genera", scope="tag")
    assert {r["title"] for r in found} == {"Tagged"}

    tag_id = (await client.get("/api/library/tags", headers=USER_A)).json()[0]["id"]
    rem = await client.delete(f"/api/library/papers/{pid}/tags/{tag_id}", headers=USER_A)
    assert rem.status_code == 204
    assert await _papers(client, q="genera", scope="tag") == []


async def test_patch_status_star_trash(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="Doc")

    # status
    r = await client.patch(f"/api/library/papers/{pid}", json={"status": "read"}, headers=USER_A)
    assert r.status_code == 200
    assert r.json()["status"] == "read"

    # star → appears in __starred__
    await client.patch(f"/api/library/papers/{pid}", json={"starred": True}, headers=USER_A)
    starred = await _papers(client, collectionId="__starred__")
    assert {r["title"] for r in starred} == {"Doc"}
    # unstar → gone
    await client.patch(f"/api/library/papers/{pid}", json={"starred": False}, headers=USER_A)
    assert await _papers(client, collectionId="__starred__") == []

    # trash → leaves main list, appears in trash; restore brings it back
    await client.patch(f"/api/library/papers/{pid}", json={"trashed": True}, headers=USER_A)
    assert await _papers(client) == []
    assert {r["title"] for r in await _papers(client, collectionId="__trash__")} == {"Doc"}
    await client.patch(f"/api/library/papers/{pid}", json={"trashed": False}, headers=USER_A)
    assert {r["title"] for r in await _papers(client)} == {"Doc"}


async def test_bulk_actions(client: AsyncClient, make_paper: MakePaper) -> None:
    p1 = await make_paper("user-a", title="A")
    p2 = await make_paper("user-a", title="B")
    col = (await client.post("/api/library/collections", json={"name": "C"}, headers=USER_A)).json()

    # bulk status
    r = await client.post(
        "/api/library/bulk",
        json={"paperIds": [p1, p2], "action": "status", "value": "reading"},
        headers=USER_A,
    )
    assert r.status_code == 200 and r.json()["affected"] == 2
    assert all(p["status"] == "reading" for p in await _papers(client))

    # bulk addTag
    await client.post(
        "/api/library/bulk",
        json={"paperIds": [p1, p2], "action": "addTag", "value": "batch"},
        headers=USER_A,
    )
    assert (await client.get("/api/library/tags", headers=USER_A)).json()[0]["count"] == 2

    # bulk move
    await client.post(
        "/api/library/bulk",
        json={"paperIds": [p1, p2], "action": "move", "value": col["id"]},
        headers=USER_A,
    )
    assert len(await _papers(client, collectionId=col["id"])) == 2

    # bulk trash → restore
    await client.post(
        "/api/library/bulk", json={"paperIds": [p1, p2], "action": "trash"}, headers=USER_A
    )
    assert await _papers(client) == []
    await client.post(
        "/api/library/bulk", json={"paperIds": [p1, p2], "action": "restore"}, headers=USER_A
    )
    assert len(await _papers(client)) == 2


async def test_bulk_unknown_action_422(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    resp = await client.post(
        "/api/library/bulk", json={"paperIds": [pid], "action": "explode"}, headers=USER_A
    )
    assert resp.status_code == 422
