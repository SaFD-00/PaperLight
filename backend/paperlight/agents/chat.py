"""RAG chat pipeline — S12 (F-03).

질문 임베딩 → Qdrant top-k chunk 검색(S9) → grounded 프롬프트 구성 → task별 라우터/캐시(S10)
스트리밍. 답변 후 후속 질문 3개를 best-effort로 생성한다.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from paperlight.ingestion.embedder import embed
from paperlight.providers.router import stream_task
from paperlight.storage.vector import get_vector_store

logger = logging.getLogger(__name__)

CHAT_PROMPT_VERSION = "chat-v2"  # v2: 논문 요약을 전체 맥락으로 system에 주입

_TOP_K = 4
_HISTORY_TURNS = 6
_CHUNK_CHARS = 1500
_SUMMARY_CAP = 1200

SYSTEM_PROMPT = (
    "당신은 학술 논문 질의응답 어시스턴트입니다. 아래 제공된 [발췌문]만 근거로 한국어로 답하세요. "
    "발췌문에서 근거를 찾지 못하면 '본문에서 근거를 찾지 못했습니다'라고 답하고 추측하지 마세요. "
    "답변은 간결한 마크다운으로 작성하고, 가능하면 어떤 페이지를 참고했는지 언급하세요."
)

_FOLLOWUP_SYSTEM = (
    "당신은 학술 논문 대화의 후속 질문을 제안하는 어시스턴트입니다. "
    "직전 질문과 답변을 바탕으로 사용자가 이어서 물어볼 만한 한국어 질문 3개를 제안하세요. "
    "각 질문을 한 줄씩, 번호나 불릿 없이 질문 문장만 출력하세요."
)


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    page: int
    text: str
    score: float


async def retrieve(paper_id: str, question: str, *, top_k: int = _TOP_K) -> list[RetrievedChunk]:
    """Embed the question and fetch top-k similar chunks for this paper from Qdrant."""
    vectors = await asyncio.to_thread(embed, [question])
    results = await asyncio.to_thread(
        get_vector_store().search, vectors[0], top_k=top_k, paper_id=paper_id
    )
    out: list[RetrievedChunk] = []
    for r in results:
        payload = r.get("payload") or {}
        out.append(
            RetrievedChunk(
                chunk_id=str(r.get("id")),
                page=int(payload.get("page", 0)),
                text=str(payload.get("text", "")),
                score=float(r.get("score", 0.0)),
            )
        )
    return out


def build_messages(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[dict[str, str]],
    *,
    paper_summary: str = "",
) -> list[dict[str, str]]:
    """System + prior turns (≤N) + grounded user turn with retrieved context.

    paper_summary(있으면)는 전체 논문 맥락으로 system 에 덧붙인다. 답변 근거는 여전히
    [발췌문]이며 요약은 흐름 파악용 — 인용/캐시 키(질문+검색 chunk+히스토리)는 불변.
    """
    system = SYSTEM_PROMPT
    if paper_summary:
        system = (
            f"{SYSTEM_PROMPT}\n\n아래 [논문 요약]은 전체 맥락 파악용입니다. 답변의 근거는 "
            f"여전히 [발췌문]에서 찾되, 요약으로 논문 전체 흐름을 이해하세요.\n"
            f"[논문 요약]\n{paper_summary[:_SUMMARY_CAP]}"
        )
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    messages.extend(history[-_HISTORY_TURNS:])
    if chunks:
        context = "\n\n".join(f"[페이지 {c.page}] {c.text[:_CHUNK_CHARS]}" for c in chunks)
    else:
        context = "(관련 발췌문 없음)"
    messages.append({"role": "user", "content": f"[발췌문]\n{context}\n\n[질문]\n{question}"})
    return messages


def context_signature(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[dict[str, str]],
) -> str:
    """Cache content key 재료 — 동일 (질문+검색 chunk+히스토리)만 캐시 재사용(멀티턴 정확성)."""
    chunk_ids = ",".join(c.chunk_id for c in chunks)
    hist = "|".join(f"{m['role']}:{m['content']}" for m in history[-_HISTORY_TURNS:])
    return f"{question}\n##chunks:{chunk_ids}\n##hist:{hist}"


async def generate_followups(question: str, answer: str) -> list[str]:
    """Suggest up to 3 follow-up questions. Best-effort — failures yield an empty list."""
    messages = [
        {"role": "system", "content": _FOLLOWUP_SYSTEM},
        {"role": "user", "content": f"[직전 질문]\n{question}\n\n[답변]\n{answer}"},
    ]
    try:
        buffer: list[str] = []
        async for token in stream_task("chat", messages):
            buffer.append(token)
        text = "".join(buffer)
    except Exception:
        logger.exception("followup generation failed")
        return []
    lines = [ln.strip(" -•\t") for ln in text.splitlines() if ln.strip()]
    return lines[:3]
