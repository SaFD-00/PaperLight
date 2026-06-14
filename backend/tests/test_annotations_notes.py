"""S14 — per-paper Markdown note get-or-create + R2 backup + ownership."""

from __future__ import annotations

from httpx import AsyncClient

from paperlight.storage.object_store import get_object_store
from tests.conftest import USER_A, MakePaper


async def test_get_creates_empty_note(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    resp = await client.get(f"/api/annotations/papers/{pid}/note", headers=USER_A)
    assert resp.status_code == 200
    note = resp.json()
    assert note["markdownText"] == ""
    assert note["id"]
    assert note["s3BackupKey"] is None


async def test_put_persists_and_backs_up(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    md = "# 메모\n\n핵심 아이디어는 X."
    resp = await client.put(
        f"/api/annotations/papers/{pid}/note", json={"markdownText": md}, headers=USER_A
    )
    assert resp.status_code == 200
    note = resp.json()
    assert note["markdownText"] == md
    assert note["s3BackupKey"] == f"notes/{note['id']}.md"

    # backup content matches what was saved
    assert get_object_store().get_text(note["s3BackupKey"]) == md

    # second GET returns same note (no duplicate)
    again = (await client.get(f"/api/annotations/papers/{pid}/note", headers=USER_A)).json()
    assert again["id"] == note["id"]
    assert again["markdownText"] == md


async def test_put_updates_same_note(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    first = (
        await client.put(
            f"/api/annotations/papers/{pid}/note", json={"markdownText": "v1"}, headers=USER_A
        )
    ).json()
    second = (
        await client.put(
            f"/api/annotations/papers/{pid}/note", json={"markdownText": "v2"}, headers=USER_A
        )
    ).json()
    assert second["id"] == first["id"]
    assert second["markdownText"] == "v2"
