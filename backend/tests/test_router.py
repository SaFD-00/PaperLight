"""LLM router — agent routing config (S10)."""

from __future__ import annotations

import pytest

from paperlight.providers import router


def test_candidates_explanation_order() -> None:
    cands = router.candidates("explanation")
    assert cands[0] == ("openrouter", "qwen/qwen3.6-35b-a3b")
    assert ("openrouter", "qwen/qwen3.6-flash") in cands


def test_candidates_figure_description_primary() -> None:
    cands = router.candidates("figure_description")
    assert cands[0] == ("openrouter", "qwen/qwen3.6-plus")


def test_candidates_unknown_task_falls_back_to_default() -> None:
    cands = router.candidates("does-not-exist")
    assert cands == [("openrouter", "qwen/qwen3.6-35b-a3b")]


def test_primary_model() -> None:
    assert router.primary_model("translation") == "qwen/qwen3.6-flash"
    assert router.primary_model("table_description") == "qwen/qwen3.6-plus"


def test_reasoning_effort_per_agent_and_default() -> None:
    assert router.reasoning_effort("podcast_script") == "high"
    assert router.reasoning_effort("translation") == "none"
    assert router.reasoning_effort("summary") == "medium"
    # unknown agent inherits the default effort.
    assert router.reasoning_effort("does-not-exist") == "medium"


def test_hyperparameters_gated_by_reasoning() -> None:
    # reasoning agent (effort=medium) → temperature/top_p omitted, only max_tokens.
    assert router.hyperparameters("summary") == {"max_tokens": 3000}
    # non-reasoning agent (effort=none) → full sampling params (top_p from default).
    assert router.hyperparameters("translation") == {
        "temperature": 0.1,
        "top_p": 0.9,
        "max_tokens": 4000,
    }


def test_load_rejects_route_missing_required_keys(
    monkeypatch: pytest.MonkeyPatch, tmp_path: pytest.TempPathFactory
) -> None:
    bad = tmp_path / "agents.yaml"  # type: ignore[operator]
    bad.write_text(
        "default: {provider: openrouter, model: m}\n"
        "agents:\n  summary: {provider: openrouter}\n",  # missing model
        encoding="utf-8",
    )
    monkeypatch.setenv("PAPERLIGHT_AGENTS_CONFIG", str(bad))
    router._load.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="agents.summary needs provider"):
            router.candidates("summary")
    finally:
        router._load.cache_clear()


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
    with pytest.raises(RuntimeError):
        await _collect("explanation", [{"role": "user", "content": "hi"}])


async def test_stream_task_falls_back_past_failing_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    # figure_description: qwen3.6-plus(primary) → qwen3.6-35b-a3b(fallback), both openrouter.
    captured: dict[str, str | None] = {}

    async def fake_stream(  # type: ignore[no-untyped-def]
        self: object,
        messages: list[dict[str, str]],
        model: str,
        *,
        reasoning_effort: str | None = None,
        **kwargs: object,
    ):
        if model == "qwen/qwen3.6-plus":
            raise RuntimeError("primary model down before first token")
        captured["model"] = model
        captured["reasoning_effort"] = reasoning_effort
        captured["max_tokens"] = str(kwargs.get("max_tokens"))
        yield "ok"

    monkeypatch.setattr(
        "paperlight.providers.openrouter_provider.OpenRouterProvider.stream_chat",
        fake_stream,
    )
    out = await _collect("figure_description", [{"role": "user", "content": "x"}])
    assert out == "ok"
    assert captured["model"] == "qwen/qwen3.6-35b-a3b"  # the openrouter fallback model
    assert captured["reasoning_effort"] == "medium"  # figure_description effort
    assert captured["max_tokens"] == "1500"  # figure_description hyperparameter
