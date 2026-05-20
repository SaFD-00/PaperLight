"""Chunker — S9. char 기반 ≈512토큰 슬라이딩 윈도우(페이지 내). tiktoken 미사용(오프라인)."""

from __future__ import annotations

from dataclasses import dataclass

from paperlight.ingestion.parser import PageText

TARGET_CHARS = 1800  # ≈512토큰 (1토큰 ≈ 3.5~4자)
OVERLAP_CHARS = 200
_CHARS_PER_TOKEN = 4


@dataclass(frozen=True)
class ChunkData:
    idx: int
    text: str
    page_num: int
    char_start: int
    char_end: int
    token_estimate: int


def chunk_pages(
    pages: list[PageText],
    *,
    target_chars: int = TARGET_CHARS,
    overlap_chars: int = OVERLAP_CHARS,
) -> list[ChunkData]:
    stride = max(1, target_chars - overlap_chars)
    chunks: list[ChunkData] = []
    idx = 0
    for page in pages:
        text = page.text
        if not text.strip():
            continue
        start = 0
        n = len(text)
        while start < n:
            end = min(start + target_chars, n)
            piece = text[start:end]
            if piece.strip():
                chunks.append(
                    ChunkData(
                        idx=idx,
                        text=piece,
                        page_num=page.page_num,
                        char_start=start,
                        char_end=end,
                        token_estimate=max(1, len(piece) // _CHARS_PER_TOKEN),
                    )
                )
                idx += 1
            if end >= n:
                break
            start += stride
    return chunks
