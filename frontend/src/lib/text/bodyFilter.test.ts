import { describe, expect, it } from "vitest";
// viewer.js 와 동일한 순수 모듈(런타임/테스트 단일 소스).
import { type BodyItem, extractBody, mapBodyRange } from "../../../public/pdfjs/bodyFilter.js";

function item(str: string, opts: Partial<BodyItem> = {}): BodyItem {
  return {
    str,
    hasEOL: opts.hasEOL ?? true,
    fontHeight: opts.fontHeight ?? 10,
    normTop: opts.normTop ?? 0.5,
    fontFamily: opts.fontFamily ?? "Times",
  };
}

// items[].str 연결 = 원문(text-layer) offset 공간.
function fullText(items: BodyItem[]): string {
  return items.map((i) => i.str).join("");
}

describe("extractBody", () => {
  it("drops captions, numeric/short/figure labels; keeps prose with global offsets", () => {
    const items = [
      item("Figure 1: Overview of results. "), // 캡션 → drop
      item("We organize our study around three research questions. "), // 본문 keep
      item("0.4 "), // 수치 → drop
      item("cct33 ", { fontHeight: 6 }), // 작은 폰트 + 짧음 → drop
      item("The model predicts the next UI state."), // 본문 keep
    ];
    const { bodyText, segments } = extractBody(items);

    expect(bodyText).toContain("We organize our study");
    expect(bodyText).toContain("The model predicts the next UI state.");
    expect(bodyText).not.toContain("Figure 1");
    expect(bodyText).not.toContain("0.4");
    expect(bodyText).not.toContain("cct33");

    // keep된 segment 의 globalStart 는 원문 offset 과 일치해야 한다.
    const full = fullText(items);
    for (const seg of segments) {
      const body = bodyText.slice(seg.bodyStart, seg.bodyEnd);
      const global = full.slice(seg.globalStart, seg.globalEnd);
      expect(body).toBe(global);
    }
  });

  it("drops standalone reference heading and everything after", () => {
    const items = [
      item("This is the conclusion of the paper here. "),
      item("References "), // 헤딩 → 이후 drop
      item("[1] Some Author. A great paper. 2024. "),
      item("[2] Another Author. Another paper. 2025."),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("conclusion of the paper");
    expect(bodyText).not.toContain("References");
    expect(bodyText).not.toContain("Some Author");
  });

  it("drops header/footer band page numbers", () => {
    const items = [
      item("2", { normTop: 0.97 }), // 푸터 페이지 번호 → drop
      item("A sentence of real body content goes here.", { normTop: 0.5 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText.trim()).toBe("A sentence of real body content goes here.");
  });
});

describe("mapBodyRange", () => {
  it("maps body range back to global offsets across dropped gaps", () => {
    const items = [
      item("Figure 1: caption. "), // drop (len 0..19)
      item("Alpha beta gamma delta. "), // keep
      item("0.4 "), // drop
      item("Second body sentence."), // keep
    ];
    const { bodyText, segments } = extractBody(items);
    const full = fullText(items);

    // 두 번째 본문 문장을 body 공간에서 찾아 global 로 매핑.
    const needle = "Second body sentence.";
    const bStart = bodyText.indexOf(needle);
    const mapped = mapBodyRange(segments, bStart, bStart + needle.length);
    expect(mapped).not.toBeNull();
    expect(full.slice(mapped!.startOffset, mapped!.endOffset)).toBe(needle);
  });

  it("returns null for out-of-range", () => {
    const { segments } = extractBody([item("Hello world body text.")]);
    expect(mapBodyRange(segments, 9999, 10000)).toBeNull();
  });
});
