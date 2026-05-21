"""LLM providers — stub determinism + key-missing guard (S10)."""

from __future__ import annotations

import pytest

from paperlight.providers.content import openai_messages, to_gemini_parts, to_text
from paperlight.providers.gemini_provider import GeminiProvider
from paperlight.providers.openai_provider import OpenAIProvider
from paperlight.providers.stub_provider import StubProvider


async def _collect(provider: object, messages: list[dict[str, object]], model: str) -> str:
    out = ""
    async for token in provider.stream_chat(messages, model):  # type: ignore[attr-defined]
        out += token
    return out


def _image_part() -> dict[str, str]:
    return {"type": "image", "mime": "image/png", "data": "AAA"}


def test_to_text_flattens_image_parts() -> None:
    content = [{"type": "text", "text": "caption"}, _image_part()]
    assert to_text(content) == "caption"
    assert to_text("plain") == "plain"


def test_openai_messages_builds_image_url_and_passes_text() -> None:
    msgs = [{"role": "user", "content": [{"type": "text", "text": "hi"}, _image_part()]}]
    parts = openai_messages(msgs)[0]["content"]
    assert parts[0] == {"type": "text", "text": "hi"}
    assert parts[1] == {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAA"}}
    # 문자열 content는 그대로 통과(기존 호출부 영향 없음).
    assert openai_messages([{"role": "user", "content": "plain"}]) == [
        {"role": "user", "content": "plain"}
    ]


def test_to_gemini_parts_inline_data() -> None:
    parts = to_gemini_parts([{"type": "text", "text": "hi"}, _image_part()])
    assert parts[0] == {"text": "hi"}
    assert parts[1] == {"inline_data": {"mime_type": "image/png", "data": "AAA"}}
    assert to_gemini_parts("plain") == [{"text": "plain"}]


async def test_stub_handles_image_parts() -> None:
    msgs = [{"role": "user", "content": [{"type": "text", "text": "a"}, _image_part()]}]
    out = await _collect(StubProvider(), msgs, "m")
    assert out.startswith("[stub:m]")


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
