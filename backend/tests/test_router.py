"""LLM router — task routing config (S10)."""

from __future__ import annotations

import pytest

from paperlight.providers import router


def test_candidates_explanation_order() -> None:
    cands = router.candidates("explanation")
    assert cands[0] == ("openrouter", "qwen/qwen3.6-35b-a3b")
    assert ("openai", "gpt-5") in cands


def test_candidates_figure_description_is_vision_first() -> None:
    cands = router.candidates("figure_description")
    assert cands[0] == ("openai", "gpt-5")


def test_candidates_unknown_task_falls_back_to_default() -> None:
    cands = router.candidates("does-not-exist")
    assert cands == [("openrouter", "qwen/qwen3.6-35b-a3b")]


def test_primary_model() -> None:
    assert router.primary_model("translation") == "qwen/qwen3.6-35b-a3b"
    assert router.primary_model("table_description") == "gemini-2.5-pro"


async def _collect(task: str, messages: list[dict[str, str]]) -> str:
    out = ""
    async for token in router.stream_task(task, messages):
        out += token
    return out


async def test_stream_task_stub_mode_is_deterministic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    messages = [{"role": "user", "content": "hi"}]
    out = await _collect("explanation", messages)
    assert out.startswith("[stub:qwen/qwen3.6-35b-a3b]")


async def test_stream_task_raises_when_all_providers_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        await _collect("explanation", [{"role": "user", "content": "hi"}])


async def test_stream_task_falls_back_past_unavailable_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    # figure_description: openai(primary) → gemini → openrouter. Only openrouter keyed.
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    captured: dict[str, str] = {}

    async def fake_stream(self: object, messages: list[dict[str, str]], model: str):  # type: ignore[no-untyped-def]
        captured["model"] = model
        yield "ok"

    monkeypatch.setattr(
        "paperlight.providers.openrouter_provider.OpenRouterProvider.stream_chat",
        fake_stream,
    )
    out = await _collect("figure_description", [{"role": "user", "content": "x"}])
    assert out == "ok"
    assert captured["model"] == "qwen/qwen3.6-35b-a3b"  # the openrouter fallback model
