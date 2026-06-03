"""F-13 Podcast — 대본 파싱 / stub TTS / 생성 파이프라인 / API + ownership."""

from __future__ import annotations

from urllib.parse import urlparse
from uuid import uuid4

import pytest
from httpx import AsyncClient

from paperlight.agents.podcast_graph import EXPERT, HOST, parse_script
from paperlight.api.podcast import _generate
from paperlight.models.podcast import Podcast
from paperlight.providers.tts_openai import stub_audio
from paperlight.storage.db import session_scope
from tests.conftest import USER_A, USER_B, MakePaper


def test_parse_script_splits_speakers() -> None:
    script = f"{HOST}: 안녕하세요\n{EXPERT}: 핵심은 X 입니다\n잡담 줄"
    segs = parse_script(script)
    assert [(s.speaker, s.text) for s in segs] == [
        (HOST, "안녕하세요"),
        (EXPERT, "핵심은 X 입니다"),
    ]


def test_parse_script_fallback_single_segment() -> None:
    segs = parse_script("화자 표기가 없는 본문")
    assert len(segs) == 1
    assert segs[0].speaker == HOST


def test_stub_audio_is_deterministic_mp3() -> None:
    a, b = stub_audio("hello world"), stub_audio("hello world")
    assert a == b
    assert a[:2] == b"\xff\xfb"  # mp3 frame sync


async def test_create_returns_pending(
    client: AsyncClient, make_paper: MakePaper, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    pid = await make_paper("user-a")
    resp = await client.post("/api/podcast", json={"paperId": pid}, headers=USER_A)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["id"]


async def test_generate_pipeline_to_ready(
    client: AsyncClient, make_paper: MakePaper, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "stub")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    pid = await make_paper("user-a", chunks=["배경 텍스트", "방법 텍스트"])
    podid = str(uuid4())
    async with session_scope() as s:
        s.add(Podcast(id=podid, paper_id=pid, user_id="user-a", options={}, status="pending"))

    await _generate(podid)

    resp = await client.get(f"/api/podcast/{podid}", headers=USER_A)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["scriptMd"]
    assert body["durationSec"] and body["durationSec"] > 0
    assert body["audioUrl"]

    parsed = urlparse(body["audioUrl"])
    audio = await client.get(f"{parsed.path}?{parsed.query}")
    assert audio.status_code == 200
    assert audio.headers["content-type"] == "audio/mpeg"
    assert len(audio.content) > 0


async def test_get_podcast_ownership_403(client: AsyncClient, make_paper: MakePaper) -> None:
    pid = await make_paper("user-a")
    podid = str(uuid4())
    async with session_scope() as s:
        s.add(Podcast(id=podid, paper_id=pid, user_id="user-a", options={}, status="pending"))
    resp = await client.get(f"/api/podcast/{podid}", headers=USER_B)
    assert resp.status_code == 403


async def test_audio_invalid_token_403(client: AsyncClient) -> None:
    resp = await client.get("/api/podcast/whatever/audio?exp=9999999999&sig=bad")
    assert resp.status_code == 403
