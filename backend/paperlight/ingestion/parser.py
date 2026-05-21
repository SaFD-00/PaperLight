"""PDF parser — S9. PyMuPDF(default, 경량). marker는 config/ingestion.yaml에서 게이팅.

marker 모드는 텍스트를 검증된 pymupdf로 뽑고 figure/table **bbox만** marker-pdf로
정밀 추출한다(정규화 top-left). marker 미설치/실패 시 경고 후 figure 없이 폴백 —
ingestion 자체는 절대 실패하지 않는다.
"""

from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass, field
from typing import Any

from paperlight.ingestion.config import get_parser

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FigureRegion:
    kind: str  # "figure" | "table"
    label: str
    bbox: dict[str, float]  # 정규화 top-left {x, y, w, h}
    caption_text: str = ""


@dataclass(frozen=True)
class PageText:
    page_num: int  # 1-based
    text: str
    figures: tuple[FigureRegion, ...] = field(default_factory=tuple)


def parse_pdf(data: bytes) -> list[PageText]:
    if get_parser() == "marker":
        return _parse_marker(data)
    return _parse_pymupdf(data)


def _parse_pymupdf(data: bytes) -> list[PageText]:
    import pymupdf

    pages: list[PageText] = []
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        for i, page in enumerate(doc):
            pages.append(PageText(page_num=i + 1, text=page.get_text("text")))
    return pages


def _parse_marker(data: bytes) -> list[PageText]:
    """텍스트는 pymupdf, figure/table bbox는 marker-pdf. 실패 시 figure 없이 폴백."""
    pages = _parse_pymupdf(data)
    try:
        by_page = _marker_figures(data)
    except Exception:
        logger.exception("marker figure extraction failed; falling back to text-only")
        return pages
    return [
        PageText(p.page_num, p.text, tuple(by_page.get(p.page_num, ())))
        for p in pages
    ]


def _marker_figures(data: bytes) -> dict[int, list[FigureRegion]]:
    """marker-pdf로 페이지별 Figure/Table 블록 bbox(정규화 top-left)를 추출."""
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict

    with tempfile.NamedTemporaryFile(suffix=".pdf") as tf:
        tf.write(data)
        tf.flush()
        cfg = ConfigParser({"output_format": "json"})
        converter = PdfConverter(
            config=cfg.generate_config_dict(),
            artifact_dict=create_model_dict(),
            renderer=cfg.get_renderer(),
        )
        rendered = converter(tf.name)
    return _collect_marker_figures(rendered)


def _battr(block: Any, name: str, default: Any = None) -> Any:
    """marker 블록은 객체 또는 dict일 수 있어 둘 다 지원."""
    if isinstance(block, dict):
        return block.get(name, default)
    return getattr(block, name, default)


def _marker_kind(block_type: str) -> str | None:
    t = (block_type or "").lower()
    if "table" in t:
        return "table"
    if "figure" in t or "picture" in t:
        return "figure"
    return None


def _iter_blocks(node: Any) -> list[Any]:
    out: list[Any] = []
    for child in _battr(node, "children", None) or []:
        out.append(child)
        out.extend(_iter_blocks(child))
    return out


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _collect_marker_figures(rendered: Any) -> dict[int, list[FigureRegion]]:
    out: dict[int, list[FigureRegion]] = {}
    pages = _battr(rendered, "children", None) or []
    counters = {"figure": 0, "table": 0}
    for pidx, page in enumerate(pages, start=1):
        pbox = _battr(page, "bbox", None) or [0, 0, 0, 0]
        pw = (pbox[2] - pbox[0]) or 1.0
        ph = (pbox[3] - pbox[1]) or 1.0
        regions: list[FigureRegion] = []
        for block in _iter_blocks(page):
            kind = _marker_kind(str(_battr(block, "block_type", "")))
            if kind is None:
                continue
            bb = _battr(block, "bbox", None)
            if not bb or len(bb) < 4:
                continue
            counters[kind] += 1
            head = "Table" if kind == "table" else "Figure"
            regions.append(
                FigureRegion(
                    kind=kind,
                    label=f"{head} {counters[kind]}",
                    bbox={
                        "x": _clamp01((bb[0] - pbox[0]) / pw),
                        "y": _clamp01((bb[1] - pbox[1]) / ph),
                        "w": _clamp01((bb[2] - bb[0]) / pw),
                        "h": _clamp01((bb[3] - bb[1]) / ph),
                    },
                )
            )
        if regions:
            out[pidx] = regions
    return out
