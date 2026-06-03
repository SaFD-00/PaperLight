import { describe, expect, it } from "vitest";
import type { FigureLayout } from "@/lib/pdf/messages";
import { type CrossRefPart, findFigureIndex, parseLabel, splitCrossRefs } from "@/lib/crossref";

describe("splitCrossRefs", () => {
  it("splits English Figure/Table refs out of prose", () => {
    const parts = splitCrossRefs("As shown in Figure 3 and Table 2, results improve.");
    expect(parts).toEqual([
      { text: "As shown in " },
      { ref: { kind: "figure", num: 3, raw: "Figure 3" } },
      { text: " and " },
      { ref: { kind: "table", num: 2, raw: "Table 2" } },
      { text: ", results improve." },
    ]);
  });

  it("detects Korean 그림/표 refs", () => {
    const parts = splitCrossRefs("그림 1 참조. 표 4 도 보라.");
    const refs = parts.filter((p): p is Extract<CrossRefPart, { ref: unknown }> => "ref" in p);
    expect(refs.map((r) => [r.ref.kind, r.ref.num])).toEqual([
      ["figure", 1],
      ["table", 4],
    ]);
  });

  it("returns a single text part when no refs present", () => {
    expect(splitCrossRefs("no references here")).toEqual([{ text: "no references here" }]);
  });
});

describe("parseLabel + findFigureIndex", () => {
  const figs: FigureLayout[] = [
    { page: 1, kind: "figure", label: "Figure 1", bbox: { x: 0, y: 0, w: 1, h: 1 }, captionText: "a" },
    { page: 2, kind: "table", label: "Table 2", bbox: { x: 0, y: 0, w: 1, h: 1 }, captionText: "b" },
  ];

  it("parses a layout label into kind+num", () => {
    expect(parseLabel("Figure 1")).toEqual({ kind: "figure", num: 1 });
    expect(parseLabel("표 7")).toEqual({ kind: "table", num: 7 });
    expect(parseLabel("Appendix")).toBeNull();
  });

  it("matches a cross-ref token to the right layout index", () => {
    expect(findFigureIndex(figs, { kind: "table", num: 2, raw: "Table 2" })).toBe(1);
    expect(findFigureIndex(figs, { kind: "figure", num: 9, raw: "Figure 9" })).toBeNull();
  });
});
