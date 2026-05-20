"""Library import/export endpoints — S13 (F-08)."""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import USER_A, USER_B, MakePaper

BIBTEX = """@article{vaswani2017,
  title = {Attention Is All You Need},
  author = {Vaswani, Ashish and Shazeer, Noam},
  year = {2017},
  journal = {NeurIPS},
}"""

RIS = """TY  - JOUR
TI  - Deep Residual Learning
AU  - He, Kaiming
PY  - 2016
ER  - """

ENDNOTE = """%0 Journal Article
%T BERT
%A Devlin, Jacob
%D 2019"""


async def test_import_bibtex_creates_papers(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/library/import", json={"format": "bibtex", "content": BIBTEX}, headers=USER_A
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["imported"] == 1

    rows = (await client.get("/api/library/papers", headers=USER_A)).json()
    assert {r["title"] for r in rows} == {"Attention Is All You Need"}


async def test_import_each_format(client: AsyncClient) -> None:
    for fmt, content, title in (
        ("bibtex", BIBTEX, "Attention Is All You Need"),
        ("ris", RIS, "Deep Residual Learning"),
        ("endnote", ENDNOTE, "BERT"),
    ):
        resp = await client.post(
            "/api/library/import", json={"format": fmt, "content": content}, headers=USER_A
        )
        assert resp.status_code == 201, resp.text
        assert title in {p["title"] for p in resp.json()["papers"]}


async def test_import_unknown_format_400(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/library/import", json={"format": "xml", "content": "x"}, headers=USER_A
    )
    assert resp.status_code == 400


async def test_export_returns_text(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="My Paper", authors=["Doe, Jane"], year=2024)
    resp = await client.post(
        "/api/library/export", json={"paperIds": [pid], "format": "bibtex"}, headers=USER_A
    )
    assert resp.status_code == 200
    assert "My Paper" in resp.text
    assert "@article" in resp.text


async def test_export_other_user_forbidden(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a", title="Private")
    resp = await client.post(
        "/api/library/export", json={"paperIds": [pid], "format": "ris"}, headers=USER_B
    )
    assert resp.status_code == 403
