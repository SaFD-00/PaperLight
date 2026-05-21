"""Provider-neutral multimodal message content (PRD §7.5 — figure/table vision).

A message ``content`` is either a plain ``str`` (text-only, unchanged) or a list
of parts, each one of::

    {"type": "text",  "text": <str>}
    {"type": "image", "mime": <str>, "data": <base64 str>}

Each provider translates parts into its own wire format; the stub drops images.
Text-only messages pass through untouched so existing call sites are unaffected.
"""

from __future__ import annotations

from typing import Any


def to_text(content: Any) -> str:
    """Flatten to text (images dropped) — for the stub provider and cache hashing."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if p.get("type") == "text")
    return str(content)


def to_openai_content(content: Any) -> Any:
    """OpenAI/OpenRouter content: ``str`` stays ``str``; parts → text/image_url blocks."""
    if not isinstance(content, list):
        return content
    out: list[dict[str, Any]] = []
    for part in content:
        if part.get("type") == "image":
            url = f"data:{part.get('mime', 'image/png')};base64,{part['data']}"
            out.append({"type": "image_url", "image_url": {"url": url}})
        else:
            out.append({"type": "text", "text": part.get("text", "")})
    return out


def openai_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map each message's content into OpenAI-compatible form (no-op for text)."""
    return [{**m, "content": to_openai_content(m.get("content", ""))} for m in messages]


def to_gemini_parts(content: Any) -> list[dict[str, Any]]:
    """Gemini parts: ``[{"text": ...}]`` and/or ``[{"inline_data": {...}}]``."""
    if isinstance(content, str):
        return [{"text": content}]
    if not isinstance(content, list):
        return [{"text": str(content)}]
    out: list[dict[str, Any]] = []
    for part in content:
        if part.get("type") == "image":
            out.append(
                {
                    "inline_data": {
                        "mime_type": part.get("mime", "image/png"),
                        "data": part["data"],
                    }
                }
            )
        else:
            out.append({"text": part.get("text", "")})
    return out
