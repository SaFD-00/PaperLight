"""Config loader stub — PRD §7.5.8.

TODO:
  - Load all YAML files under `config/` into Pydantic models.
  - Validate against schemas.
  - Watch files for hot reload.
"""
from pathlib import Path

import yaml
from pydantic import BaseModel

CONFIG_ROOT = Path(__file__).resolve().parent


class ModelRoute(BaseModel):
    provider: str
    model: str
    fallback: list[dict] = []


def load_models() -> dict:
    return yaml.safe_load((CONFIG_ROOT / "models.yaml").read_text(encoding="utf-8"))
