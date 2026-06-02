"""시간 유틸 — epoch milliseconds."""

from __future__ import annotations

import time


def now_ms() -> int:
    """현재 시각을 epoch milliseconds(int)로 반환."""
    return int(time.time() * 1000)
