"""오디오 세그먼트 결합 + 길이 추정 (F-13 MVP).

placeholder/실 mp3 모두 프레임 단위 단순 concat으로 연속 재생(재인코딩·크로스페이드 없음 — MVP).
"""

from __future__ import annotations

_CHARS_PER_SEC = 14  # 한국어 발화 대략치(자막/길이 추정용)


def stitch(segments: list[bytes]) -> bytes:
    return b"".join(segments)


def estimate_duration_sec(script_md: str) -> int:
    return max(1, len(script_md) // _CHARS_PER_SEC)
