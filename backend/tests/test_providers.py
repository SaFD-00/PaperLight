"""LLM providers — stub determinism + key-missing guard (S10)."""

from __future__ import annotations

import pytest

from paperlight.providers.gemini_provider import GeminiProvider
from paperlight.providers.openai_provider import OpenAIProvider
from paperlight.providers.stub_provider import StubProvider


async def _collect(provider: object, messages: list[dict[str, str]], model: str) -> str:
    out = ""
    async for token in provider.stream_chat(messages, model):  # type: ignore[attr-defined]
        out += token
    return out


async def test_stub_is_deterministic_and_keyless() -> None:
    messages = [{"role": "user", "content": "hello"}]
    a = await _collect(StubProvider(), messages, "m")
    b = await _collect(StubProvider(), messages, "m")
    assert a == b
    assert a.startswith("[stub:m]")


async def test_stub_varies_with_input() -> None:
    one = await _collect(StubProvider(), [{"role": "user", "content": "a"}], "m")
    two = await _collect(StubProvider(), [{"role": "user", "content": "b"}], "m")
    assert one != two


def test_openai_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        OpenAIProvider()


def test_gemini_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        GeminiProvider()
