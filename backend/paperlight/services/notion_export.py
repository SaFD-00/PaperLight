"""Notion export (F-11 보강) — stub-first.

NOTION_TOKEN(+NOTION_PARENT_PAGE_ID) 미설정 시 마크다운 fallback(graceful),
설정 시 Notion pages.create best-effort. references.enrich 와 동일한 env-gating·
try/except 폴백 패턴.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 15.0


def notion_enabled() -> bool:
    return bool(os.environ.get("NOTION_TOKEN") and os.environ.get("NOTION_PARENT_PAGE_ID"))


async def export_to_notion(title: str, markdown: str) -> dict[str, Any]:
    """{"mode": "stub"|"created", "url": str|None, "markdown": str|None}.

    미연동/실패 → stub(마크다운 동봉, FE가 클립보드 복사). 연동 → created(url).
    """
    if not notion_enabled():
        return {"mode": "stub", "url": None, "markdown": markdown}
    try:
        url = await _create_page(title, markdown)
        return {"mode": "created", "url": url, "markdown": None}
    except Exception:  # noqa: BLE001 — external API best-effort, fall back to markdown
        logger.exception("notion export failed")
        return {"mode": "stub", "url": None, "markdown": markdown}


async def _create_page(title: str, markdown: str) -> str:
    token = os.environ["NOTION_TOKEN"]
    parent = os.environ["NOTION_PARENT_PAGE_ID"]
    payload = {
        "parent": {"page_id": parent},
        "properties": {"title": {"title": [{"text": {"content": title}}]}},
        "children": [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"text": {"content": markdown[:1900]}}]},
            }
        ],
    }
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
        resp = await http.post(
            "https://api.notion.com/v1/pages",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28"},
        )
        resp.raise_for_status()
        return str(resp.json().get("url", ""))
