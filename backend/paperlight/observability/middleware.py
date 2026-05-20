"""Request correlation middleware (S15).

Pure ASGI (not BaseHTTPMiddleware) so it never buffers SSE streaming responses
(chat/explain/translate). Assigns a request_id, exposes it on the trace context
and the ``X-Request-Id`` response header, and tags the Sentry scope.
"""

from __future__ import annotations

from uuid import uuid4

import sentry_sdk
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from paperlight.observability.context import request_id_var


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid4())
        token = request_id_var.set(request_id)
        sentry_sdk.set_tag("request_id", request_id)

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message).append("X-Request-Id", request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            request_id_var.reset(token)
