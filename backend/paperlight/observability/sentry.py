"""Sentry error tracking (S15) — env-gated, no-op without SENTRY_DSN."""

from __future__ import annotations

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from paperlight.observability.settings import get_observability_settings


def init_sentry() -> bool:
    """Initialize Sentry if SENTRY_DSN is set. Returns True when enabled."""
    settings = get_observability_settings()
    if not settings.sentry_enabled:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )
    return True


def capture_exception(err: BaseException) -> None:
    """Report an exception to Sentry (no-op when uninitialized)."""
    sentry_sdk.capture_exception(err)
