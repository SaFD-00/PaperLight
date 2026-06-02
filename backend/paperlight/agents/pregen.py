"""Auto pre-generation after ingestion (S11).

ingestion `ready` 직후 호출되어 다층 Summary + Auto-Highlight(F-10) + Figure/Table
설명(F-14) + 단락별 통찰(F-15)을 task별 라우터/캐시(S10) 경유로 생성한다. 모든 산출물은
`Cache` 테이블에 영구(ttl=0) 저장 — 전용 테이블/마이그레이션 없음. figure/table은 marker-pdf
부재로 본문 텍스트 reasoning만 수행(이미지 없음). 마지막으로 References(F-05)도 미리 추출/보강해
Cache memo(30일)에 채워 패널 첫 클릭 대기를 없앤다. 각 task는 격리되어 1개 실패가 전체를
중단하지 않는다.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import re
from typing import Any

from sqlalchemy import select

from paperlight.agents.context import (
    GROUND_GUARD,
    apply_context,
    build_paper_context,
)
from paperlight.agents.references import get_references
from paperlight.ingestion.render import render_region
from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.providers.cache import load_figure_layout, read_cached, stream_with_cache
from paperlight.storage.db import get_session_factory
from paperlight.storage.object_store import get_object_store, pdf_key

logger = logging.getLogger(__name__)

SUMMARY_PROMPT_VERSION = "summary-v1"
HIGHLIGHT_PROMPT_VERSION = "highlight-v1"
PARAGRAPH_DESC_PROMPT_VERSION = "paragraph-desc-v2"  # v2: 요약+RAG 맥락 주입
PARAGRAPH_IMPORTANCE_PROMPT_VERSION = "paragraph-importance-v2"  # v2: 요약 맥락 주입
FIGURE_PROMPT_VERSION = "figure-v3"  # v2: marker bbox 비전 입력 / v3: 논문 맥락 주입
TABLE_PROMPT_VERSION = "table-v3"

_SUMMARY_CORPUS_CHARS = 12000

_FIGURE_RE = re.compile(r"(?i)\b(?:figure|fig\.)\s*\d+|그림\s*\d+")
_TABLE_RE = re.compile(r"(?i)\btable\s*\d+|표\s*\d+")

_SUMMARY_SYSTEM = (
    "당신은 학술 논문 요약 어시스턴트입니다. 한국어 마크다운으로 다층 요약을 작성하세요: "
    "## TL;DR(한 문장) / ## 3줄 요약(문제·방법·결과) / ## 섹션별 요약 / ## 핵심 기여 / "
    "## 키워드 사전(핵심 용어와 한 줄 정의). 본문에 없는 내용을 지어내지 마세요."
)
_HIGHLIGHT_SYSTEM = (
    "당신은 논문에서 핵심 문장을 카테고리별로 추출하는 어시스턴트입니다. 한국어 마크다운으로 "
    "기여(Contribution) / 방법(Method) / 결과(Result) / 한계(Limitation) 4개 섹션을 만들고, "
    "각 항목은 인용 문장과 가능하면 페이지를 표기하세요. 본문에 없는 내용은 추가하지 마세요."
)
_PARAGRAPH_DESC_SYSTEM = (
    "[대상 단락]의 핵심을 한국어 한 문장으로 요약하세요. [논문 요약]·[관련 본문 발췌]가 "
    "있으면 논문 전체 흐름을 고려하되, 지어내지 말고 군더더기 없이 한 문장만 출력하세요."
)
_PARAGRAPH_IMPORTANCE_SYSTEM = (
    "[대상 단락]이 논문 전체에서 갖는 중요도를 Critical, Important, Normal 중 하나로만 "
    "분류해 한 단어로 출력하세요. [논문 요약]은 판단 참고용입니다."
)
_FIGURE_SYSTEM = (
    "다음 본문에 언급된 그림(Figure)을 한국어로 설명하세요. 이미지 없이 텍스트만으로 추론하며, "
    "확신할 수 없는 부분은 단정하지 마세요."
)
_TABLE_SYSTEM = (
    "다음 본문에 언급된 표(Table)를 한국어로 설명하세요. 이미지 없이 텍스트만으로 추론하며, "
    "확신할 수 없는 부분은 단정하지 마세요."
)
_FIGURE_VISION_SYSTEM = (
    "당신은 학술 논문의 그림(Figure)을 설명하는 도우미입니다. 제공된 그림 이미지와 캡션·주변 "
    "본문을 함께 활용해 한국어 마크다운으로 설명하세요: 무엇을 보여주는지 → 핵심 관찰/결과 → "
    "본문에서의 의미. 이미지에서 확인되지 않는 내용은 단정하지 마세요."
)
_TABLE_VISION_SYSTEM = (
    "당신은 학술 논문의 표(Table)를 설명하는 도우미입니다. 제공된 표 이미지와 캡션·주변 본문을 "
    "함께 활용해 한국어 마크다운으로 설명하세요: 표가 비교하는 항목 → 핵심 수치/경향 → "
    "본문에서의 의미. 이미지에서 확인되지 않는 내용은 단정하지 마세요."
)


async def _safe_run(
    task: str,
    messages: list[dict[str, Any]],
    *,
    paper_id: str,
    chunk_id: str,
    version: str,
) -> None:
    """Drain the cache-backed stream (write happens inside); isolate failures."""
    try:
        async for _ in stream_with_cache(
            task,
            messages,
            text="",
            prompt_version=version,
            paper_id=paper_id,
            chunk_id=chunk_id,
            ttl=0,
        ):
            pass
    except Exception:
        logger.exception("pregen task %s failed for paper %s chunk %s", task, paper_id, chunk_id)


def _group_by_page(layout: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    out: dict[int, list[dict[str, Any]]] = {}
    for fig in layout:
        out.setdefault(int(fig.get("page", 0)), []).append(fig)
    return out


async def _figure_pregen(
    paper_id: str,
    ch: Chunk,
    kind: str,
    figures_by_page: dict[int, list[dict[str, Any]]],
    pdf_data: bytes | None,
    paper_summary: str | None,
) -> None:
    """이 청크 페이지에 bbox가 있으면 영역을 렌더해 비전으로, 없으면 텍스트로 설명."""
    is_table = kind == "table"
    task = "table_description" if is_table else "figure_description"
    version = TABLE_PROMPT_VERSION if is_table else FIGURE_PROMPT_VERSION
    context = await build_paper_context(
        paper_id, ch.text, exclude_chunk_id=ch.id, precomputed_summary=paper_summary
    )

    region: dict[str, Any] | None = None
    if pdf_data is not None:
        region = next(
            (f for f in figures_by_page.get(ch.page_num, []) if f.get("kind") == kind), None
        )

    if region is not None and pdf_data is not None:
        b64: str | None = None
        with contextlib.suppress(Exception):
            b64 = await asyncio.to_thread(render_region, pdf_data, ch.page_num, region["bbox"])
        if b64:
            noun = "표" if is_table else "그림"
            prompt = (
                f"{region.get('label') or kind} 캡션:\n{region.get('captionText') or '(없음)'}\n\n"
                f"주변 본문:\n{ch.text[:1500]}\n\n위 {noun}를 설명해주세요."
            )
            system = _TABLE_VISION_SYSTEM if is_table else _FIGURE_VISION_SYSTEM
            if context:
                system = f"{system}\n\n{GROUND_GUARD}"
                prompt = f"[논문 맥락]\n{context}\n\n{prompt}"
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image", "mime": "image/png", "data": b64},
                    ],
                },
            ]
            await _safe_run(task, messages, paper_id=paper_id, chunk_id=ch.id, version=version)
            return

    # 텍스트 폴백(bbox/이미지 없음 — pymupdf 모드 또는 렌더 실패)
    await _safe_run(
        task,
        apply_context(_TABLE_SYSTEM if is_table else _FIGURE_SYSTEM, ch.text, context),
        paper_id=paper_id,
        chunk_id=ch.id,
        version=version,
    )


def _corpus(chunks: list[Chunk]) -> str:
    out: list[str] = []
    total = 0
    for ch in chunks:
        out.append(ch.text)
        total += len(ch.text)
        if total >= _SUMMARY_CORPUS_CHARS:
            break
    return "\n\n".join(out)[:_SUMMARY_CORPUS_CHARS]


async def pregen_paper(paper_id: str) -> None:
    factory = get_session_factory()
    async with factory() as session:
        paper = await session.get(Paper, paper_id)
        if paper is None:
            return
        title = paper.title
        authors = paper.authors or []
        chunks = list(
            (
                await session.execute(
                    select(Chunk).where(Chunk.paper_id == paper_id).order_by(Chunk.idx)
                )
            )
            .scalars()
            .all()
        )
    if not chunks:
        return

    # marker 모드에서 채워진 figure/table bbox(없으면 텍스트 폴백). PDF는 비전용 1회 로드.
    layout = await load_figure_layout(paper_id)
    figures_by_page = _group_by_page(layout)
    pdf_data: bytes | None = None
    if layout:
        with contextlib.suppress(Exception):
            pdf_data = await asyncio.to_thread(get_object_store().get_pdf, pdf_key(paper_id))

    header = f"제목: {title}\n저자: {', '.join(authors)}\n\n"
    corpus = header + _corpus(chunks)

    await _safe_run(
        "summary",
        [
            {"role": "system", "content": _SUMMARY_SYSTEM},
            {"role": "user", "content": corpus},
        ],
        paper_id=paper_id,
        chunk_id=f"summary:{paper_id}",
        version=SUMMARY_PROMPT_VERSION,
    )
    await _safe_run(
        "highlight",
        [
            {"role": "system", "content": _HIGHLIGHT_SYSTEM},
            {"role": "user", "content": corpus},
        ],
        paper_id=paper_id,
        chunk_id=f"highlight:{paper_id}",
        version=HIGHLIGHT_PROMPT_VERSION,
    )

    # summary 생성(위) 직후 1회 읽어 per-chunk 맥락 주입에 재사용(DB 왕복·재계산 최소화).
    paper_summary = await read_cached(
        "summary",
        paper_id=paper_id,
        chunk_id=f"summary:{paper_id}",
        prompt_version=SUMMARY_PROMPT_VERSION,
    )

    for ch in chunks:
        # 단락 설명: 요약 + 관련 본문(자기 자신 제외). 분류기보다 풍부한 맥락.
        desc_ctx = await build_paper_context(
            paper_id, ch.text, top_k=2, exclude_chunk_id=ch.id, precomputed_summary=paper_summary
        )
        desc_user = f"{desc_ctx}\n\n[대상 단락]\n{ch.text}" if desc_ctx else ch.text
        await _safe_run(
            "paragraph_description",
            [
                {"role": "system", "content": _PARAGRAPH_DESC_SYSTEM},
                {"role": "user", "content": desc_user},
            ],
            paper_id=paper_id,
            chunk_id=ch.id,
            version=PARAGRAPH_DESC_PROMPT_VERSION,
        )
        # 중요도: 요약만(분류기엔 RAG 노이즈). 한 단어 출력 유지 위해 가드 미사용.
        imp_ctx = await build_paper_context(
            paper_id, ch.text, related=False, precomputed_summary=paper_summary
        )
        imp_user = f"{imp_ctx}\n\n[대상 단락]\n{ch.text}" if imp_ctx else ch.text
        await _safe_run(
            "paragraph_importance",
            [
                {"role": "system", "content": _PARAGRAPH_IMPORTANCE_SYSTEM},
                {"role": "user", "content": imp_user},
            ],
            paper_id=paper_id,
            chunk_id=ch.id,
            version=PARAGRAPH_IMPORTANCE_PROMPT_VERSION,
        )
        if _FIGURE_RE.search(ch.text):
            await _figure_pregen(paper_id, ch, "figure", figures_by_page, pdf_data, paper_summary)
        if _TABLE_RE.search(ch.text):
            await _figure_pregen(paper_id, ch, "table", figures_by_page, pdf_data, paper_summary)

    # References(F-05): 추출+보강을 미리 Cache memo에 채워 패널 첫 클릭 대기 제거. 격리.
    try:
        await get_references(paper_id)
    except Exception:
        logger.exception("pregen references failed for paper %s", paper_id)
