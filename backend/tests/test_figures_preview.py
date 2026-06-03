"""F-07 Preview — figure cross-ref 미니 프리뷰 이미지 엔드포인트."""

from __future__ import annotations

import pymupdf
from httpx import AsyncClient

from paperlight.providers.cache import save_figure_layout
from paperlight.storage.object_store import get_object_store, pdf_key
from tests.conftest import USER_A, USER_B, MakePaper


def _one_page_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Figure 1: a chart")
    data: bytes = doc.tobytes()
    doc.close()
    return data


async def _seed_layout(pid: str) -> None:
    get_object_store().put_pdf(pdf_key(pid), _one_page_pdf())
    await save_figure_layout(
        pid,
        [
            {
                "page": 1,
                "kind": "figure",
                "label": "Figure 1",
                "bbox": {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.3},
                "captionText": "a chart",
            }
        ],
    )


async def test_figure_image_returns_png(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    await _seed_layout(pid)
    resp = await client.get(f"/api/papers/{pid}/figures/0/image", headers=USER_A)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"


async def test_figure_image_unknown_index_404(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    await _seed_layout(pid)
    resp = await client.get(f"/api/papers/{pid}/figures/9/image", headers=USER_A)
    assert resp.status_code == 404


async def test_figure_image_no_layout_404(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    resp = await client.get(f"/api/papers/{pid}/figures/0/image", headers=USER_A)
    assert resp.status_code == 404


async def test_figure_image_ownership_403(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    await _seed_layout(pid)
    resp = await client.get(f"/api/papers/{pid}/figures/0/image", headers=USER_B)
    assert resp.status_code == 403
