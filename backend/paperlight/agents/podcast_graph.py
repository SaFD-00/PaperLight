"""Podcast 대본 생성 (F-13, PRD §7.3).

논문 요약/발췌 → 2인(진행자·전문가) 한국어 대담 대본을 stream_task("podcast_script")로
생성하고 화자별 세그먼트로 파싱. LLM_PROVIDER=stub 에서도 결정적으로 동작.
"""

from __future__ import annotations

from dataclasses import dataclass

from paperlight.providers.router import stream_task

PODCAST_PROMPT_VERSION = "podcast-v1"
HOST = "진행자"
EXPERT = "전문가"
_CONTEXT_CAP = 2000

_SYSTEM = (
    f"당신은 논문을 두 사람({HOST}, {EXPERT})의 한국어 대담 팟캐스트 대본으로 만드는 작가입니다. "
    f"각 줄을 '{HOST}: ...' 또는 '{EXPERT}: ...' 형식으로 작성하세요. "
    f"{HOST}는 청취자 대신 질문하고, {EXPERT}는 핵심 기여·방법·결과·한계를 쉽게 설명합니다. "
    "8~14개의 대화 턴으로 도입→핵심→마무리 흐름을 갖추세요."
)


@dataclass(frozen=True)
class Segment:
    speaker: str
    text: str


async def build_script(title: str, summary: str, chunk_texts: list[str]) -> str:
    """2인 대담 대본 markdown을 생성(스트리밍 누적)."""
    context = summary[:_CONTEXT_CAP] if summary else "\n\n".join(chunk_texts)[:_CONTEXT_CAP]
    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": f"[제목]\n{title}\n\n[논문 요약/발췌]\n{context}"},
    ]
    buffer: list[str] = []
    async for token in stream_task("podcast_script", messages):
        buffer.append(token)
    return "".join(buffer)


def parse_script(script_md: str) -> list[Segment]:
    """'진행자:/전문가:' 라인을 세그먼트로 분리. 화자 라인이 없으면 전체를 1개 세그먼트로."""
    segments: list[Segment] = []
    for raw in script_md.splitlines():
        line = raw.strip()
        if not line:
            continue
        speaker, sep, text = line.partition(":")
        speaker = speaker.strip()
        if sep and speaker in (HOST, EXPERT) and text.strip():
            segments.append(Segment(speaker=speaker, text=text.strip()))
    if not segments:
        body = script_md.strip()
        if body:
            segments.append(Segment(speaker=HOST, text=body))
    return segments
