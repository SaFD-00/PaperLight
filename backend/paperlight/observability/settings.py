"""Observability settings (S15) — Sentry + Langfuse env, all optional.

Read fresh from the environment so tests can monkeypatch keys per case. Existing
scattered ``os.environ.get`` access elsewhere is intentionally left untouched.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class ObservabilitySettings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", case_sensitive=False)

    sentry_dsn: str | None = None
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.0

    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str | None = None

    @property
    def sentry_enabled(self) -> bool:
        return bool(self.sentry_dsn)

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)


def get_observability_settings() -> ObservabilitySettings:
    return ObservabilitySettings()
