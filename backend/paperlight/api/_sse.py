"""SSE 직렬화 — 모든 스트리밍 엔드포인트 공용."""

from __future__ import annotations

import json
from typing import Any


def format_sse(event: dict[str, Any]) -> str:
    """이벤트 dict를 SSE `data:` 프레임 문자열로 직렬화."""
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
