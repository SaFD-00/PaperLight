"""OpenAI streaming chat completion (PRD §7.5 — vision/fallback for figure tasks)."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx
from httpx_sse import aconnect_sse

from paperlight.providers.content import openai_messages

BASE_URL = "https://api.openai.com/v1"


class OpenAIProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

    async def stream_chat(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        reasoning_effort: str | None = None,  # noqa: ARG002 — accepted for protocol parity
        temperature: float | None = None,
        top_p: float | None = None,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "content-type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": model,
            "messages": openai_messages(messages),
            "stream": True,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        if top_p is not None:
            payload["top_p"] = top_p
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        timeout = httpx.Timeout(60.0, read=None)
        async with (
            httpx.AsyncClient(timeout=timeout) as client,
            aconnect_sse(
                client,
                "POST",
                f"{BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            ) as event_source,
        ):
            async for sse in event_source.aiter_sse():
                if not sse.data or sse.data == "[DONE]":
                    if sse.data == "[DONE]":
                        return
                    continue
                try:
                    chunk = json.loads(sse.data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content
