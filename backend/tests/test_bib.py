"""BibTeX/RIS/EndNote parse + export round-trips — S13 (F-08)."""

from __future__ import annotations

import pytest

from paperlight.agents.bib import ParsedRef, export, parse

SAMPLE = [
    ParsedRef(
        title="Attention Is All You Need",
        authors=["Vaswani, Ashish", "Shazeer, Noam"],
        year=2017,
        venue="NeurIPS",
        doi="10.5555/3295222",
    ),
    ParsedRef(title="Deep Residual Learning", authors=["He, Kaiming"], year=2016),
]


@pytest.mark.parametrize("fmt", ["bibtex", "ris", "endnote"])
def test_export_then_parse_roundtrip(fmt: str) -> None:
    text = export(fmt, SAMPLE)
    parsed = parse(fmt, text)
    assert len(parsed) == 2
    assert parsed[0].title == "Attention Is All You Need"
    assert parsed[0].authors == ["Vaswani, Ashish", "Shazeer, Noam"]
    assert parsed[0].year == 2017
    assert parsed[0].venue == "NeurIPS"
    assert parsed[0].doi == "10.5555/3295222"
    assert parsed[1].title == "Deep Residual Learning"
    assert parsed[1].year == 2016


def test_parse_real_bibtex() -> None:
    text = """@article{vaswani2017,
  title = {Attention Is All You Need},
  author = {Vaswani, Ashish and Shazeer, Noam},
  year = {2017},
  journal = {NeurIPS},
}"""
    refs = parse("bibtex", text)
    assert len(refs) == 1
    assert refs[0].authors == ["Vaswani, Ashish", "Shazeer, Noam"]


def test_parse_broken_input_is_graceful() -> None:
    assert parse("bibtex", "not a bibtex file") == []
    assert parse("ris", "garbage\nlines") == []
    assert parse("endnote", "") == []


def test_export_empty() -> None:
    assert export("bibtex", []) == ""
    assert export("ris", []) == ""


def test_unknown_format_raises() -> None:
    with pytest.raises(ValueError):
        parse("xml", "x")
    with pytest.raises(ValueError):
        export("xml", SAMPLE)
