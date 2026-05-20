"""LLM router — task routing config (S10)."""

from __future__ import annotations

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
