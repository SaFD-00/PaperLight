"""Task → provider/model routing (PRD §7.5.4 models.yaml). See also stream_task."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

_DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "models.yaml"


def _config_path() -> Path:
    override = os.environ.get("PAPERLIGHT_MODELS_CONFIG")
    return Path(override) if override else _DEFAULT_CONFIG_PATH


@lru_cache(maxsize=1)
def _load(path: str) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        raise RuntimeError(f"models.yaml must be a mapping: {path}")
    return data


def load_models_config() -> dict[str, Any]:
    return _load(str(_config_path()))


def _entry(task: str) -> dict[str, Any]:
    cfg = load_models_config()
    tasks = cfg.get("tasks") or {}
    entry = tasks.get(task)
    if entry is None:
        entry = cfg["default"]
    if not isinstance(entry, dict):
        raise RuntimeError(f"invalid models.yaml entry for task {task!r}")
    return entry


def candidates(task: str) -> list[tuple[str, str]]:
    """Return [(provider, model), *fallback] for a task (default if unknown)."""
    entry = _entry(task)
    result: list[tuple[str, str]] = [(entry["provider"], entry["model"])]
    for fb in entry.get("fallback") or []:
        result.append((fb["provider"], fb["model"]))
    return result


def primary_model(task: str) -> str:
    """The primary (non-fallback) model for a task — used as the cache key model."""
    model: str = _entry(task)["model"]
    return model
