"""청크 본문 정제 — figure/table 캡션 라인을 제거해 RAG 검색 노이즈를 줄인다.

pymupdf `get_text("text")`는 좌표·폰트가 없어 프론트 bodyFilter.js만큼 정밀하진 않다.
캡션 머리말 라인(Figure/Table/Algorithm N …) 같은 **명백한 비본문**만 패턴으로 보수적으로
걷어낸다(좌표 기반 표 영역 제거는 pymupdf find_tables 과탐이 커 보류 — 표 셀·도표 내부
텍스트는 남는다). 보수성: 본문 과삭제 < 캡션 라벨 통과.

references 섹션은 절대 건드리지 않는다 — agents/references.py가 청크 텍스트를 이어붙여
`_HEADING_RE`로 헤딩을 찾고 이후를 서지로 추출하기 때문이다. 헤딩 감지 후 정제를 끄고
헤딩 라인과 이후 모든 라인(후속 페이지 포함)을 원본 그대로 보존한다.
"""

from __future__ import annotations

import logging
import re

from paperlight.ingestion.config import bodyfilter_enabled
from paperlight.ingestion.parser import PageText

logger = logging.getLogger(__name__)

# 프론트 CAPTION_RE(bodyFilter.js)의 Python 포팅. 영문(figure/fig/table/algorithm/listing +
# scheme/chart/plate/box/exhibit) + 다국어(그림/표/图/表/図) 머리말 + 부록 접두
# (Supplementary/Extended Data/Appendix)를 라인 시작에서만 매칭한다.
_CAPTION_RE = re.compile(
    r"^\s*(?:(?:supplementary|supp\.?|extended\s+data|appendix)\s+)?"
    r"(?:figure|fig\.?|table|algorithm|listing|scheme|chart|plate|box|exhibit|그림|표|图|表|図)"
    r"\s*\d+",
    re.IGNORECASE,
)

# agents/references.py `_HEADING_RE`와 문자 그대로 동일(여기선 라인 단위라 MULTILINE 불요).
# 이 라인부터 정제를 비활성화해 헤딩·서지 엔트리를 보존한다(extract_references 무손상).
_REF_HEADING_RE = re.compile(
    r"^\s*(?:\d+\.?\s+)?(references|bibliography|참고문헌)\s*$",
    re.IGNORECASE,
)


def _clean_page_text(text: str, *, ref_active: bool) -> tuple[str, bool]:
    """캡션 라인을 제거한 텍스트와 references 활성 여부(이후 페이지로 전파)를 반환."""
    if ref_active:
        return text, True  # references 진입 후엔 손대지 않는다.
    kept: list[str] = []
    for line in text.split("\n"):
        if _REF_HEADING_RE.match(line):
            ref_active = True
            kept.append(line)  # 헤딩 라인 자체 보존(references.py가 찾아야 함).
            continue
        if _CAPTION_RE.match(line):
            continue  # 캡션 시작 라인 제거(멀티라인 캡션은 보수적으로 머리말 위주).
        kept.append(line)
    return "\n".join(kept), ref_active


def filter_body_pages(pages: list[PageText]) -> list[PageText]:
    """캡션/도표 라벨 라인을 걷어낸 본문만 남긴다. references 섹션은 보존.

    게이트 off면 입력 그대로. 페이지별 예외는 원본 텍스트 유지(graceful, ingestion 무중단).
    .page_num/.figures는 보존하고 .text만 교체한다(chunker가 정제 텍스트로 offset 재계산).
    """
    if not bodyfilter_enabled():
        return pages
    out: list[PageText] = []
    ref_active = False
    for page in pages:
        try:
            cleaned, ref_active = _clean_page_text(page.text, ref_active=ref_active)
        except Exception:
            logger.exception("bodyfilter failed on page %s; keeping raw text", page.page_num)
            out.append(page)
            continue
        out.append(PageText(page_num=page.page_num, text=cleaned, figures=page.figures))
    return out
