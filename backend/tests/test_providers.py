"""LLM providers — stub determinism + key-missing guard (S10)."""

from __future__ import annotations

import contextlib
import json
from typing import Any

import pytest

from paperlight.providers.content import openai_messages, to_gemini_parts, to_text
from paperlight.providers.gemini_provider import GeminiProvider
from paperlight.providers.openai_provider import OpenAIProvider
from paperlight.providers.openrouter_provider import OpenRouterProvider
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


class _FakeSSE:
    def __init__(self, data: str) -> None:
        self.data = data


class _FakeEventSource:
    async def aiter_sse(self) -> Any:
        yield _FakeSSE(json.dumps({"choices": [{"delta": {"content": "hi"}}]}))
        yield _FakeSSE("[DONE]")


async def _run_openrouter(monkeypatch: pytest.MonkeyPatch, **kwargs: Any) -> dict[str, Any]:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured: dict[str, Any] = {}

    @contextlib.asynccontextmanager
    async def fake_connect(client: Any, method: str, url: str, *, headers: Any, json: Any) -> Any:
        captured["payload"] = json
        yield _FakeEventSource()

    monkeypatch.setattr("paperlight.providers.openrouter_provider.aconnect_sse", fake_connect)
    out = ""
    async for tok in OpenRouterProvider().stream_chat(
        [{"role": "user", "content": "x"}], "qwen/qwen3.6-35b-a3b", **kwargs
    ):
        out += tok
    assert out == "hi"
    return captured["payload"]


async def test_openrouter_includes_reasoning_effort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = await _run_openrouter(monkeypatch, reasoning_effort="high")
    assert payload["reasoning"] == {"effort": "high"}


async def test_openrouter_omits_reasoning_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = await _run_openrouter(monkeypatch)
    assert "reasoning" not in payload


async def test_openrouter_includes_sampling_params(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = await _run_openrouter(monkeypatch, temperature=0.1, top_p=0.9, max_tokens=4000)
    assert payload["temperature"] == 0.1
    assert payload["top_p"] == 0.9
    assert payload["max_tokens"] == 4000


async def test_openrouter_omits_sampling_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = await _run_openrouter(monkeypatch)
    assert "temperature" not in payload
    assert "max_tokens" not in payload
