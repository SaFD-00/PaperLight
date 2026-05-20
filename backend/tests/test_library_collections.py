"""Library collection CRUD + tree tests — S13 (F-08)."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from tests.conftest import USER_A, USER_B


async def _create(client: AsyncClient, name: str, parent_id: str | None = None) -> dict[str, Any]:
    resp = await client.post(
        "/api/library/collections",
        json={"name": name, "parentId": parent_id},
        headers=USER_A,
    )
    assert resp.status_code == 201, resp.text
    body: dict[str, Any] = resp.json()
    return body


async def test_create_and_list_tree(client: AsyncClient) -> None:
    root = await _create(client, "GUI")
    child = await _create(client, "Mobile", root["id"])

    tree = (await client.get("/api/library/collections", headers=USER_A)).json()
    by_id = {c["id"]: c for c in tree}
    assert by_id[root["id"]]["parentId"] is None
    assert by_id[child["id"]]["parentId"] == root["id"]
    assert by_id[root["id"]]["paperCount"] == 0


async def test_rename_collection(client: AsyncClient) -> None:
    col = await _create(client, "Old")
    resp = await client.patch(
        f"/api/library/collections/{col['id']}", json={"name": "New"}, headers=USER_A
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


async def test_move_collection_cycle_rejected(client: AsyncClient) -> None:
    a = await _create(client, "A")
    b = await _create(client, "B", a["id"])
    # move A under its own descendant B → 422
    resp = await client.patch(
        f"/api/library/collections/{a['id']}", json={"parentId": b["id"]}, headers=USER_A
    )
    assert resp.status_code == 422
    # self-parent → 422
    resp2 = await client.patch(
        f"/api/library/collections/{a['id']}", json={"parentId": a["id"]}, headers=USER_A
    )
    assert resp2.status_code == 422


async def test_delete_collection_cascades_children(client: AsyncClient) -> None:
    root = await _create(client, "Root")
    child = await _create(client, "Child", root["id"])
    resp = await client.delete(f"/api/library/collections/{root['id']}", headers=USER_A)
    assert resp.status_code == 204
    tree = (await client.get("/api/library/collections", headers=USER_A)).json()
    ids = {c["id"] for c in tree}
    assert root["id"] not in ids
    assert child["id"] not in ids


async def test_owner_isolation(client: AsyncClient) -> None:
    col = await _create(client, "Mine")
    # other user cannot see it
    tree_b = (await client.get("/api/library/collections", headers=USER_B)).json()
    assert col["id"] not in {c["id"] for c in tree_b}
    # other user cannot patch/delete
    assert (
        await client.patch(
            f"/api/library/collections/{col['id']}", json={"name": "X"}, headers=USER_B
        )
    ).status_code == 403
    assert (
        await client.delete(f"/api/library/collections/{col['id']}", headers=USER_B)
    ).status_code == 403


async def test_patch_unknown_collection_404(client: AsyncClient) -> None:
    resp = await client.patch("/api/library/collections/nope", json={"name": "X"}, headers=USER_A)
    assert resp.status_code == 404
