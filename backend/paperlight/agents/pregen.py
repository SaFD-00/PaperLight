"""Auto pre-generation after ingestion (S11).

ingestion `ready` 직후 호출되어 다층 Summary + Auto-Highlight(F-10) + Figure/Table
설명(F-14) + 단락별 통찰(F-15)을 task별 라우터/캐시(S10) 경유로 생성한다. 모든 산출물은
`Cache` 테이블에 영구(ttl=0) 저장 — 전용 테이블/마이그레이션 없음. figure/table은 marker-pdf
부재로 본문 텍스트 reasoning만 수행(이미지 없음). 각 task는 격리되어 1개 실패가 전체를
중단하지 않는다.
"""

from __future__ import annotations

import logging
import re

from sqlalchemy import select

from paperlight.models.chunk import Chunk
from paperlight.models.paper import Paper
from paperlight.providers.cache import stream_with_cache
from paperlight.storage.db import get_session_factory

logger = logging.getLogger(__name__)

SUMMARY_PROMPT_VERSION = "summary-v1"
HIGHLIGHT_PROMPT_VERSION = "highlight-v1"
PARAGRAPH_DESC_PROMPT_VERSION = "paragraph-desc-v1"
PARAGRAPH_IMPORTANCE_PROMPT_VERSION = "paragraph-importance-v1"
FIGURE_PROMPT_VERSION = "figure-v1"
TABLE_PROMPT_VERSION = "table-v1"

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
    "다음 단락의 핵심을 한국어 한 문장으로 요약하세요. 군더더기 없이 요점만 출력하세요."
)
_PARAGRAPH_IMPORTANCE_SYSTEM = (
    "다음 단락의 중요도를 Critical, Important, Normal 중 하나로만 분류해 한 단어로 출력하세요."
)
_FIGURE_SYSTEM = (
    "다음 본문에 언급된 그림(Figure)을 한국어로 설명하세요. 이미지 없이 텍스트만으로 추론하며, "
    "확신할 수 없는 부분은 단정하지 마세요."
)
_TABLE_SYSTEM = (
    "다음 본문에 언급된 표(Table)를 한국어로 설명하세요. 이미지 없이 텍스트만으로 추론하며, "
    "확신할 수 없는 부분은 단정하지 마세요."
)


async def _safe_run(
    task: str,
    messages: list[dict[str, str]],
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

    for ch in chunks:
        await _safe_run(
            "paragraph_description",
            [
                {"role": "system", "content": _PARAGRAPH_DESC_SYSTEM},
                {"role": "user", "content": ch.text},
            ],
            paper_id=paper_id,
            chunk_id=ch.id,
            version=PARAGRAPH_DESC_PROMPT_VERSION,
        )
        await _safe_run(
            "paragraph_importance",
            [
                {"role": "system", "content": _PARAGRAPH_IMPORTANCE_SYSTEM},
                {"role": "user", "content": ch.text},
            ],
            paper_id=paper_id,
            chunk_id=ch.id,
            version=PARAGRAPH_IMPORTANCE_PROMPT_VERSION,
        )
        if _FIGURE_RE.search(ch.text):
            await _safe_run(
                "figure_description",
                [
                    {"role": "system", "content": _FIGURE_SYSTEM},
                    {"role": "user", "content": ch.text},
                ],
                paper_id=paper_id,
                chunk_id=ch.id,
                version=FIGURE_PROMPT_VERSION,
            )
        if _TABLE_RE.search(ch.text):
            await _safe_run(
                "table_description",
                [
                    {"role": "system", "content": _TABLE_SYSTEM},
                    {"role": "user", "content": ch.text},
                ],
                paper_id=paper_id,
                chunk_id=ch.id,
                version=TABLE_PROMPT_VERSION,
            )
