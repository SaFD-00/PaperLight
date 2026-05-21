"""PDF 영역 렌더 — S11 pregen 비전용. pymupdf get_pixmap(clip).

정규화 top-left bbox(0~1)를 page.rect의 points로 환산해 그 영역만 PNG로 렌더한다
(pdf.js 프론트 crop과 좌표계 일치: top-left, y-downward).
"""

from __future__ import annotations

import base64


def render_region(data: bytes, page_num: int, bbox: dict[str, float], *, dpi: int = 150) -> str:
    """1-based page의 정규화 bbox 영역을 PNG로 렌더해 base64 문자열로 반환."""
    import pymupdf

    with pymupdf.open(stream=data, filetype="pdf") as doc:
        page = doc[page_num - 1]
        r = page.rect  # points, top-left origin
        clip = pymupdf.Rect(
            r.x0 + bbox["x"] * r.width,
            r.y0 + bbox["y"] * r.height,
            r.x0 + (bbox["x"] + bbox["w"]) * r.width,
            r.y0 + (bbox["y"] + bbox["h"]) * r.height,
        )
        pix = page.get_pixmap(clip=clip, dpi=dpi)
        png: bytes = pix.tobytes("png")
    return base64.b64encode(png).decode("ascii")
