"""Ingestion config loader — S9. parser 선택(config/ingestion.yaml).

router.py의 config 로더 패턴을 따른다(`@lru_cache` + 모듈 경로). parser 선택은
env override를 최우선으로 둬 기존 `INGEST_PARSER` 계약과 테스트를 보존한다.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "ingestion.yaml"


@lru_cache(maxsize=1)
def _load() -> dict[str, Any]:
    if not _CONFIG_PATH.exists():
        return {}
    data = yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def get_parser() -> str:
    """Selected PDF parser — env INGEST_PARSER > ingestion.yaml > 'pymupdf'."""
    env = os.environ.get("INGEST_PARSER")
    if env:
        return env
    return str(_load().get("parser") or "pymupdf")
