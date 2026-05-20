"""Per-request trace context (S15, PRD §7.9 trace keys).

``request_id`` is set by the middleware; ``user_id`` by the auth dependency;
``paper_id`` best-effort by LLM routes. ``current_trace_metadata`` returns only
the keys that are populated, for attaching to Langfuse generations / Sentry scope.
"""

from __future__ import annotations

from contextvars import ContextVar

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
paper_id_var: ContextVar[str | None] = ContextVar("paper_id", default=None)


def current_trace_metadata() -> dict[str, str]:
    meta: dict[str, str] = {}
    for key, var in (
        ("request_id", request_id_var),
        ("user_id", user_id_var),
        ("paper_id", paper_id_var),
    ):
        value = var.get()
        if value:
            meta[key] = value
    return meta
