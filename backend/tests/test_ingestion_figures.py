"""Ingestion figure bbox — S9 follow-up (T3).

config 게이팅(env override 우선순위), pymupdf figure 회귀, marker 미설치 graceful
폴백, figure_layout 직접 Cache row 저장/조회를 검증한다(marker 의존성 불필요).
"""

from __future__ import annotations

import base64
import contextlib
import importlib.util
import os
import tempfile
from collections.abc import AsyncIterator

import pymupdf
import pytest
import pytest_asyncio

from paperlight.ingestion.config import get_parser
from paperlight.ingestion.parser import parse_pdf
from paperlight.ingestion.render import render_region
from paperlight.providers.cache import load_figure_layout, save_figure_layout
from paperlight.storage.db import init_db, reset_engine

_HAS_MARKER = importlib.util.find_spec("marker") is not None


def _blank_pdf() -> bytes:
    doc = pymupdf.open()
    doc.new_page()
    data: bytes = doc.tobytes()
    doc.close()
    return data


def test_get_parser_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INGEST_PARSER", "marker")
    assert get_parser() == "marker"
    monkeypatch.delenv("INGEST_PARSER", raising=False)
    assert get_parser() == "pymupdf"  # ingestion.yaml 기본


def test_pymupdf_yields_no_figures(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INGEST_PARSER", raising=False)
    pages = parse_pdf(_blank_pdf())
    assert pages
    assert all(p.figures == () for p in pages)


@pytest.mark.skipif(
    _HAS_MARKER, reason="marker 설치 시 실제 모델 로드 경로 — 폴백 검증 불가(E2E는 수동)"
)
def test_marker_without_dependency_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    # marker-pdf 미설치 환경: 텍스트는 살아있고 figure는 빈 채로 폴백(ingestion 실패 금지).
    monkeypatch.setenv("INGEST_PARSER", "marker")
    pages = parse_pdf(_blank_pdf())
    assert pages
    assert all(p.figures == () for p in pages)


def test_render_region_returns_png() -> None:
    b64 = render_region(_blank_pdf(), 1, {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5})
    png = base64.b64decode(b64)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"  # PNG 시그니처


@pytest_asyncio.fixture
async def _db() -> AsyncIterator[None]:
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    await reset_engine(f"sqlite+aiosqlite:///{path}")
    await init_db()
    yield
    await reset_engine()
    with contextlib.suppress(FileNotFoundError):
        os.unlink(path)


async def test_figure_layout_roundtrip(_db: None) -> None:
    figures = [
        {
            "page": 1,
            "kind": "figure",
            "label": "Figure 1",
            "bbox": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4},
            "captionText": "Overview",
        }
    ]
    await save_figure_layout("p1", figures)
    assert await load_figure_layout("p1") == figures
    assert await load_figure_layout("missing") == []
    # 재저장(upsert)도 동작
    await save_figure_layout("p1", [])
    assert await load_figure_layout("p1") == []
