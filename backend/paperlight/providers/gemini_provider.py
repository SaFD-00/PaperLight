"""Gemini streaming generateContent (PRD §7.5 — table/figure fallback)."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx
from httpx_sse import aconnect_sse

from paperlight.providers.content import to_gemini_parts, to_text

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = (
            api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
        )
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

    async def stream_chat(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        reasoning_effort: str | None = None,  # noqa: ARG002 — accepted for protocol parity
    ) -> AsyncIterator[str]:
        system_parts: list[dict[str, str]] = []
        contents: list[dict[str, Any]] = []
        for message in messages:
            content = message.get("content", "")
            role = message.get("role")
            if role == "system":
                system_parts.append({"text": to_text(content)})
            else:
                gemini_role = "model" if role == "assistant" else "user"
                contents.append({"role": gemini_role, "parts": to_gemini_parts(content)})
        payload: dict[str, Any] = {"contents": contents}
        if system_parts:
            payload["system_instruction"] = {"parts": system_parts}

        headers = {"content-type": "application/json"}
        params = {"alt": "sse", "key": self.api_key}
        url = f"{BASE_URL}/models/{model}:streamGenerateContent"
        timeout = httpx.Timeout(60.0, read=None)
        async with (
            httpx.AsyncClient(timeout=timeout) as client,
            aconnect_sse(
                client,
                "POST",
                url,
                headers=headers,
                params=params,
                json=payload,
            ) as event_source,
        ):
            async for sse in event_source.aiter_sse():
                if not sse.data:
                    continue
                try:
                    chunk = json.loads(sse.data)
                except json.JSONDecodeError:
                    continue
                candidates = chunk.get("candidates") or []
                if not candidates:
                    continue
                content = candidates[0].get("content") or {}
                for part in content.get("parts") or []:
                    text = part.get("text")
                    if text:
                        yield text
