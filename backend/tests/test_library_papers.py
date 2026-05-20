"""Library paper list (filter/search/sort/sentinel) + membership — S13 (F-08)."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from tests.conftest import USER_A, USER_B, MakePaper


async def _papers(
    client: AsyncClient, headers: dict[str, str], **params: Any
) -> list[dict[str, Any]]:
    resp = await client.get("/api/library/papers", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    body: list[dict[str, Any]] = resp.json()
    return body


async def test_list_excludes_other_users_and_soft_deleted(
    client: AsyncClient, make_paper: MakePaper
) -> None:
    await make_paper("user-a", title="Mine")
    await make_paper("user-a", title="Trashed", soft_deleted=True)
    await make_paper("user-b", title="Theirs")

    rows = await _papers(client, USER_A)
    titles = {r["title"] for r in rows}
    assert titles == {"Mine"}


async def test_filter_by_collection_and_membership(
    client: AsyncClient, make_paper: MakePaper
) -> None:
    pid = await make_paper("user-a", title="Target")
    await make_paper("user-a", title="Outside")
    col = (await client.post("/api/library/collections", json={"name": "C"}, headers=USER_A)).json()

    # add to collection
    add = await client.post(
        f"/api/library/collections/{col['id']}/papers",
        json={"paperIds": [pid]},
        headers=USER_A,
    )
    assert add.status_code == 204

    rows = await _papers(client, USER_A, collectionId=col["id"])
    assert {r["title"] for r in rows} == {"Target"}
    assert rows[0]["collectionIds"] == [col["id"]]

    # remove
    rem = await client.delete(f"/api/library/collections/{col['id']}/papers/{pid}", headers=USER_A)
    assert rem.status_code == 204
    assert await _papers(client, USER_A, collectionId=col["id"]) == []


async def test_status_and_special_folders(client: AsyncClient, make_paper: MakePaper) -> None:
    await make_paper("user-a", title="Todo", paper_status="to_read")
    await make_paper("user-a", title="Reading", paper_status="reading")
    await make_paper("user-a", title="Gone", soft_deleted=True)

    unread = await _papers(client, USER_A, collectionId="__unread__")
    assert {r["title"] for r in unread} == {"Todo"}

    recent = await _papers(client, USER_A, collectionId="__recent__")
    assert {r["title"] for r in recent} == {"Reading"}

    trash = await _papers(client, USER_A, collectionId="__trash__")
    assert {r["title"] for r in trash} == {"Gone"}

    by_status = await _papers(client, USER_A, status="reading")
    assert {r["title"] for r in by_status} == {"Reading"}


async def test_search_scopes(client: AsyncClient, make_paper: MakePaper) -> None:
    await make_paper(
        "user-a",
        title="Diffusion Models",
        authors=["Ho", "Jain"],
        chunks=["this paper studies denoising probabilistic processes"],
    )
    await make_paper("user-a", title="Graph Networks", authors=["Kipf"], chunks=["spectral graphs"])

    # title scope
    assert {r["title"] for r in await _papers(client, USER_A, q="diffusion", scope="title")} == {
        "Diffusion Models"
    }
    # author scope
    assert {r["title"] for r in await _papers(client, USER_A, q="kipf", scope="author")} == {
        "Graph Networks"
    }
    # content (fulltext) scope
    res = await _papers(client, USER_A, q="denoising", scope="content")
    assert {r["title"] for r in res} == {"Diffusion Models"}


async def test_sort_order(client: AsyncClient, make_paper: MakePaper) -> None:
    await make_paper("user-a", title="Bravo", year=2020)
    await make_paper("user-a", title="Alpha", year=2024)

    asc = await _papers(client, USER_A, sort="title", order="asc")
    assert [r["title"] for r in asc] == ["Alpha", "Bravo"]
    desc = await _papers(client, USER_A, sort="year", order="desc")
    assert [r["title"] for r in desc] == ["Alpha", "Bravo"]


async def test_membership_requires_owned_collection(
    client: AsyncClient, make_paper: MakePaper
) -> None:
    pid = await make_paper("user-a")
    col = (await client.post("/api/library/collections", json={"name": "C"}, headers=USER_A)).json()
    resp = await client.post(
        f"/api/library/collections/{col['id']}/papers",
        json={"paperIds": [pid]},
        headers=USER_B,
    )
    assert resp.status_code == 403
