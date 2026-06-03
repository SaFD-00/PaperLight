"""SRT 자막 생성 (F-13, PRD §7.3). 세그먼트별 누적 시간으로 cue 작성."""

from __future__ import annotations

from paperlight.agents.podcast_graph import Segment


def _ts(sec: float) -> str:
    ms = int(sec * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(segments: list[Segment], per_seg_sec: list[float]) -> str:
    lines: list[str] = []
    t = 0.0
    for i, (seg, dur) in enumerate(zip(segments, per_seg_sec, strict=False), start=1):
        start, end = t, t + dur
        t = end
        lines.append(str(i))
        lines.append(f"{_ts(start)} --> {_ts(end)}")
        lines.append(f"{seg.speaker}: {seg.text}")
        lines.append("")
    return "\n".join(lines)
