"""청크 본문 정제(bodyfilter) — 캡션 제거·references 보존·게이트 회귀.

핵심 불변: references 섹션은 절대 손대지 않는다(agents/references.py가 청크 텍스트에서
헤딩을 찾아 서지를 추출하므로). 캡션 라인만 보수적으로 제거한다.
"""

from __future__ import annotations

import pytest

from paperlight.agents.references import extract_references
from paperlight.ingestion.bodyfilter import filter_body_pages
from paperlight.ingestion.parser import PageText
from paperlight.models.chunk import Chunk


def _page(num: int, text: str) -> PageText:
    return PageText(page_num=num, text=text)


def test_drops_caption_lines(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INGEST_BODYFILTER", raising=False)
    pages = [_page(1, "We study X.\nFigure 1: Overview of the method.\nThe results are strong.")]
    body = filter_body_pages(pages)[0].text
    assert "We study X." in body
    assert "The results are strong." in body
    assert "Figure 1" not in body


def test_drops_table_and_algorithm_captions(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INGEST_BODYFILTER", raising=False)
    text = "Intro line.\nTable 2: Accuracy comparison.\nAlgorithm 1 Training loop\nBody continues."
    body = filter_body_pages([_page(1, text)])[0].text
    assert "Table 2" not in body
    assert "Algorithm 1" not in body
    assert "Intro line." in body
    assert "Body continues." in body


def test_keeps_inline_figure_mention(monkeypatch: pytest.MonkeyPatch) -> None:
    # 'As shown in Figure 1, ...'처럼 본문 중간 언급은 캡션이 아니다(라인 시작만 매칭).
    monkeypatch.delenv("INGEST_BODYFILTER", raising=False)
    text = "As shown in Figure 1, the loss drops sharply over the first epochs."
    body = filter_body_pages([_page(1, text)])[0].text
    assert body == text


def test_preserves_references_section(monkeypatch: pytest.MonkeyPatch) -> None:
    # references 진입 후엔 캡션처럼 보이는 서지 라인(Figure/Table 인용)도 보존해야 한다.
    monkeypatch.delenv("INGEST_BODYFILTER", raising=False)
    text = (
        "Body text.\nReferences\n"
        "[1] A. Smith. Figure-ground organization. 2020.\n"
        "[2] B. Lee. Table methods for vision. 2021."
    )
    body = filter_body_pages([_page(1, text)])[0].text
    assert "References" in body
    assert "[1] A. Smith" in body
    assert "[2] B. Lee" in body


def test_references_preserved_across_pages(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("INGEST_BODYFILTER", raising=False)
    pages = [
        _page(1, "Figure 1: caption on body page.\nMain body."),
        _page(2, "References\n[1] First entry here, a long one."),
        _page(3, "[2] Second entry continues.\nFigure 9: cited inside refs."),
    ]
    out = filter_body_pages(pages)
    assert "Figure 1" not in out[0].text  # 본문 페이지 캡션은 제거
    assert "References" in out[1].text
    assert "[1] First entry here" in out[1].text
    # references 진입 후 페이지의 'Figure 9' 라인은 보존(서지 일부일 수 있음).
    assert "Figure 9" in out[2].text


def test_extract_references_still_works_after_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    # 통합 회귀: 정제 후 청크 텍스트에서도 references 추출이 깨지지 않는다.
    monkeypatch.delenv("INGEST_BODYFILTER", raising=False)
    text = (
        "Body.\nFigure 1: drop me.\nReferences\n"
        "[1] A. Smith. A paper title. arXiv:2101.00001.\n"
        "[2] B. Lee. Another paper. 2021."
    )
    body = filter_body_pages([_page(1, text)])[0].text
    chunk = Chunk(
        id="c1",
        paper_id="p1",
        idx=0,
        text=body,
        page_num=1,
        char_start=0,
        char_end=len(body),
        token_estimate=1,
    )
    refs = extract_references([chunk])
    assert len(refs) == 2
    assert any("A. Smith" in r for r in refs)


def test_gate_off_returns_input_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INGEST_BODYFILTER", "false")
    pages = [_page(1, "Figure 1: keep me when off.\nBody.")]
    out = filter_body_pages(pages)
    assert out[0].text == "Figure 1: keep me when off.\nBody."
