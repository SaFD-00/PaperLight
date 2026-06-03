"""OpenAI TTS (F-13, PRD §7.5) — stub-first.

OPENAI_API_KEY 없으면 결정적 placeholder mp3(오프라인/CI), 있으면 tts-1-hd 실호출.
embedder 의 결정적 stub·env-gating 패턴과 동일.
"""

from __future__ import annotations

import os

import httpx

_HTTP_TIMEOUT = 60.0
# MPEG-1 Layer III, 128kbps/44.1kHz 프레임 헤더(0xFFFB9064) — placeholder 동기 바이트.
_MP3_FRAME = b"\xff\xfb\x90\x64" + b"\x00" * 413


def tts_enabled() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


def stub_audio(text: str) -> bytes:
    """텍스트 길이에 비례한 결정적 무음 mp3 프레임(오프라인/CI)."""
    frames = max(1, len(text) // 8)
    return _MP3_FRAME * frames


async def synthesize(text: str, voice: str) -> bytes:
    """tts-1-hd로 mp3 합성. 키 없으면 stub_audio."""
    if not tts_enabled():
        return stub_audio(text)
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
        resp = await http.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            json={"model": "tts-1-hd", "voice": voice, "input": text, "response_format": "mp3"},
        )
        resp.raise_for_status()
        return resp.content
