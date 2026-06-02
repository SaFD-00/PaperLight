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


class AgentRoute(BaseModel):
    provider: str
    model: str
    reasoning_effort: str | None = None
    fallback: list[dict] = []


def load_agents() -> dict:
    return yaml.safe_load((CONFIG_ROOT / "agents.yaml").read_text(encoding="utf-8"))
