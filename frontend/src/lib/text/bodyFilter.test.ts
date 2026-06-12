import { describe, expect, it } from "vitest";
// viewer.js 와 동일한 순수 모듈(런타임/테스트 단일 소스).
import {
  type BodyItem,
  carryAcrossPages,
  extractBody,
  figureExclusionBand,
  mapBodyRange,
  parseCaptionLabel,
  scanReferenceActivation,
  scanRunningFurniture,
  trailingIncomplete,
} from "../../../public/pdfjs/bodyFilter.js";

function item(str: string, opts: Partial<BodyItem> = {}): BodyItem {
  return {
    str,
    hasEOL: opts.hasEOL ?? true,
    fontHeight: opts.fontHeight ?? 10,
    normTop: opts.normTop ?? 0.5,
    fontFamily: opts.fontFamily ?? "Times",
    inFigure: opts.inFigure ?? false,
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

  it("drops multi-line caption continuation in small font until body resumes", () => {
    // 본문이 폰트 비중에서 우세해야 modal=10(본문 크기)로 잡힌다(실제 논문 분포).
    const items = [
      item("Real body paragraph one with enough length to set the modal font here.", {
        fontHeight: 10,
      }),
      item("Another full body sentence continues the same paragraph with more text.", {
        fontHeight: 10,
      }),
      item("A third body sentence keeps the body font clearly dominant on the page.", {
        fontHeight: 10,
      }),
      item("Figure 1: Overview of empirical results across prediction formats", {
        fontHeight: 8,
      }), // 캡션(작은 폰트) → drop + captionMode
      item("and imagination-based training across many judge models and runs.", {
        fontHeight: 8,
      }), // 캡션 연속 줄(긴 텍스트지만 작은 폰트) → drop
      item("A central design choice in mobile world models is the format here.", {
        fontHeight: 10,
      }), // 본문 폰트 복귀 → keep
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("Real body paragraph one");
    expect(bodyText).toContain("A central design choice");
    expect(bodyText).not.toContain("Figure 1");
    expect(bodyText).not.toContain("imagination-based training");
  });

  it("keeps same-size body line right after caption (conservative)", () => {
    const items = [
      item("Body paragraph that establishes the modal body font size here.", {
        fontHeight: 10,
      }),
      item("Figure 2: a caption rendered in the same font size as body text.", {
        fontHeight: 10,
      }), // 캡션이지만 본문과 같은 폰트 → 캡션 줄만 drop
      item("This following sentence is body and must be kept intact here.", {
        fontHeight: 10,
      }), // keep (captionMode 미발동)
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).not.toContain("Figure 2");
    expect(bodyText).toContain("This following sentence is body");
  });

  it("drops first-page front-matter band, keeps title and abstract/body", () => {
    const items = [
      item("How Mobile World Model Guides GUI Agents?", { fontHeight: 16 }), // 제목(최대 폰트) → keep
      item("Weihal Xu, Kun Huang, Yuwen Feng, Bo An", { fontHeight: 11 }), // 저자 → drop
      item("Nanjing Technological University, Xiamen University", { fontHeight: 9 }), // 소속 → drop
      item("Project  Dataset  Model", { fontHeight: 9 }), // 링크 행 → drop
      item("Abstract", { fontHeight: 11 }), // 초록 헤딩 → keep (밴드 종료)
      item("Recent advances in mobile world models enable better GUI agents here.", {
        fontHeight: 10,
      }), // 초록 본문 → keep
    ];
    const { bodyText } = extractBody(items, { firstPage: true });
    expect(bodyText).toContain("How Mobile World Model Guides GUI Agents?");
    expect(bodyText).toContain("Abstract");
    expect(bodyText).toContain("Recent advances in mobile world models");
    expect(bodyText).not.toContain("Weihal Xu");
    expect(bodyText).not.toContain("Nanjing Technological University");
    expect(bodyText).not.toContain("Project  Dataset  Model");
  });

  it("does not apply front-matter band when not first page", () => {
    const items = [
      item("How Mobile World Model Guides GUI Agents?", { fontHeight: 16 }),
      item("A section heading line in the body of a later page here.", { fontHeight: 11 }),
      item("Abstract", { fontHeight: 11 }),
      item("Some later-page body sentence that must remain intact.", { fontHeight: 10 }),
    ];
    const { bodyText } = extractBody(items, { firstPage: false });
    // 밴드 미적용 → 저자처럼 보이는 라인도 본문으로 유지.
    expect(bodyText).toContain("A section heading line in the body");
    expect(bodyText).toContain("Some later-page body sentence");
  });

  it("drops email lines on any page", () => {
    const items = [
      item("This sentence is real body content of the paper here. ", { normTop: 0.5 }),
      item("Email: weihal.xu@example.edu, bo.an@example.com", { normTop: 0.95 }), // 이메일 → drop
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("This sentence is real body content");
    expect(bodyText).not.toContain("@example");
  });

  it("drops arXiv identifier (vertical sidebar stamp) on any page", () => {
    const items = [
      item("arXiv:2605.10347v1 [cs.AI] 11 May 2026", { normTop: 0.5 }), // 세로 식별자 → drop
      item("This is the genuine body text of the article here.", { normTop: 0.5 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).not.toContain("arXiv:2605.10347");
    expect(bodyText).toContain("This is the genuine body text");
  });

  it("drops figure/table region text and preserves neighbor offsets", () => {
    const items = [
      item("This is real body prose before the figure region here. "), // keep
      item("Constraint ", { inFigure: true, fontHeight: 7 }), // 그림 내부 라벨 → drop
      item("Initial Synthesis ", { inFigure: true, fontHeight: 7 }), // 그림 내부 라벨 → drop
      item("Cold Start", { inFigure: true, fontHeight: 7 }), // 그림 내부 라벨 → drop
      item("Body prose continues after the figure region with full size."), // keep
    ];
    const { bodyText, segments } = extractBody(items);

    expect(bodyText).toContain("This is real body prose before");
    expect(bodyText).toContain("Body prose continues after the figure");
    expect(bodyText).not.toContain("Constraint");
    expect(bodyText).not.toContain("Initial Synthesis");
    expect(bodyText).not.toContain("Cold Start");

    // drop된 figure 텍스트를 건너뛰어도 keep segment 의 globalStart 가 원문과 일치.
    const full = fullText(items);
    for (const seg of segments) {
      expect(bodyText.slice(seg.bodyStart, seg.bodyEnd)).toBe(
        full.slice(seg.globalStart, seg.globalEnd),
      );
    }
  });

  it("keeps a line when figure items are a minority (below half)", () => {
    const items = [
      // 한 라인에 figure 토큰 1개 + 본문 토큰 다수(hasEOL=false 로 한 라인 구성).
      item("x ", { inFigure: true, hasEOL: false }),
      item("This is a long genuine body sentence that should be kept intact."),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("This is a long genuine body sentence");
  });

  it("drops Korean figure/table captions", () => {
    const items = [
      item("이 문장은 충분히 긴 한국어 본문 문장으로 모달 폰트를 정합니다.", { fontHeight: 10 }),
      item("그림 1: 예측 형식별 실험 결과 개요.", { fontHeight: 8 }), // 그림 캡션 → drop
      item("표 2: 모델별 정확도 비교.", { fontHeight: 8 }), // 표 캡션 → drop
      item("다음 본문 문장은 그대로 유지되어야 합니다.", { fontHeight: 10 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("이 문장은 충분히 긴");
    expect(bodyText).toContain("다음 본문 문장은 그대로 유지");
    expect(bodyText).not.toContain("그림 1");
    expect(bodyText).not.toContain("표 2");
  });
});

describe("parseCaptionLabel", () => {
  it("parses English figure/table labels with normalized kind", () => {
    expect(parseCaptionLabel("Figure 1: Overview of results")).toEqual({
      kind: "figure",
      label: "Figure 1",
    });
    expect(parseCaptionLabel("Table 3 shows the comparison")).toEqual({
      kind: "table",
      label: "Table 3",
    });
    expect(parseCaptionLabel("Fig. 2 caption")).toEqual({ kind: "figure", label: "Figure 2" });
  });

  it("parses Korean labels", () => {
    expect(parseCaptionLabel("그림 1: 결과 개요")).toEqual({ kind: "figure", label: "그림 1" });
    expect(parseCaptionLabel("표 2: 정확도")).toEqual({ kind: "table", label: "표 2" });
  });

  it("parses Supplementary/Extended Data 접두 캡션(부록 양식)", () => {
    expect(parseCaptionLabel("Supplementary Figure 2: Structural Novelty")).toEqual({
      kind: "figure",
      label: "Figure 2",
    });
    expect(parseCaptionLabel("Extended Data Table 3 shows the breakdown")).toEqual({
      kind: "table",
      label: "Table 3",
    });
  });

  it("returns null for non-captions", () => {
    expect(parseCaptionLabel("A normal body sentence.")).toBeNull();
    expect(parseCaptionLabel("Figure caption without a number")).toBeNull();
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

describe("extractBody — 문서 수준 References/Checklist", () => {
  it("refActiveAtStart면 헤딩 없는 연속 참고문헌 페이지를 전부 drop + allDropped 신호", () => {
    const items = [
      item("[16] Some Author, Another Author. A paper title. In Proceedings of ICML, 2024.", {
        fontHeight: 10,
      }),
      item("[17] Third Author. Another work here. arXiv preprint arXiv:2401.00001, 2024.", {
        fontHeight: 10,
      }),
    ];
    const { bodyText, allDropped } = extractBody(items, { refActiveAtStart: true });
    expect(bodyText).toBe("");
    expect(allDropped).toBe(true);
  });

  it("refActiveAtStart 페이지에서 Appendix 헤딩을 만나면 본문이 재개됨(arXiv 관행)", () => {
    const items = [
      item("[9] Last Author. Final reference entry. In Proceedings, 2024.", { fontHeight: 10 }),
      item("Appendix", { fontHeight: 12 }), // 재개 헤딩(헤딩 폰트)
      item("This appendix body sentence must be translated and kept intact here.", {
        fontHeight: 10,
      }),
    ];
    const { bodyText } = extractBody(items, { refActiveAtStart: true });
    expect(bodyText).not.toContain("Last Author");
    expect(bodyText).toContain("This appendix body sentence");
  });

  it("Checklist 헤딩 이후를 비본문으로 제거", () => {
    const items = [
      item("This is the final body paragraph before the boilerplate checklist here.", {
        fontHeight: 10,
      }),
      item("NeurIPS Paper Checklist", { fontHeight: 12 }), // 헤딩 → 이후 drop
      item("1. Claims Question: Do the main claims reflect the contributions and scope?", {
        fontHeight: 10,
      }),
      item("Answer: [Yes] Justification: We claim the contributions in the introduction.", {
        fontHeight: 10,
      }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("final body paragraph");
    expect(bodyText).not.toContain("Checklist");
    expect(bodyText).not.toContain("Justification");
  });

  it("번호 붙은 References 헤딩('7 References')도 인식해 이후 제거", () => {
    const items = [
      item("Body sentence that establishes the modal font on this page right here.", {
        fontHeight: 10,
      }),
      item("7 References", { fontHeight: 12 }),
      item("[1] A. Author. A cited work. arXiv preprint arXiv:2401.1, 2024.", { fontHeight: 10 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("Body sentence");
    expect(bodyText).not.toContain("Author");
  });

  it("전면 Figure 페이지(전부 inFigure)도 allDropped로 표시", () => {
    const items = [
      item("Origin State", { inFigure: true, fontHeight: 7 }),
      item("Code2World Next State", { inFigure: true, fontHeight: 7 }),
    ];
    const { bodyText, allDropped } = extractBody(items);
    expect(bodyText).toBe("");
    expect(allDropped).toBe(true);
  });
});

describe("scanReferenceActivation", () => {
  function page(strs: Array<[string, Partial<BodyItem>?]>): BodyItem[] {
    return strs.map(([s, o]) => item(s, o));
  }

  it("References 헤딩 다음 연속 서지 페이지만 활성, Appendix에서 해제", () => {
    const pages = [
      page([["Ordinary content body text that fills a normal reading page here.", { fontHeight: 10 }]]),
      page([["References", { fontHeight: 12, normTop: 0.1 }]]), // 헤딩 페이지
      page([
        ["[1] Some Author, Other Author. A title. In Proceedings of ICML, 2024.", { fontHeight: 10 }],
        ["[2] Third Author. Another work. arXiv preprint arXiv:2401.00001, 2024.", { fontHeight: 10 }],
      ]),
      page([
        ["[3] Fourth Author. Yet another paper title. In Proceedings of NeurIPS, 2023.", { fontHeight: 10 }],
      ]),
      page([["This appendix paragraph is ordinary prose that should be translated.", { fontHeight: 10 }]]),
    ];
    expect(scanReferenceActivation(pages)).toEqual([false, false, true, true, false]);
  });

  it("Checklist 헤딩 이후 모든 페이지를 활성(끝까지)", () => {
    const pages = [
      page([["Regular body content that occupies a normal page of the paper here.", { fontHeight: 10 }]]),
      page([["NeurIPS Paper Checklist", { fontHeight: 12, normTop: 0.1 }]]),
      page([["1. Claims Question: Do the claims reflect the scope of the paper here?", { fontHeight: 10 }]]),
      page([["Answer: [Yes] Justification: The contributions are stated in the intro.", { fontHeight: 10 }]]),
    ];
    expect(scanReferenceActivation(pages)).toEqual([false, false, true, true]);
  });

  it("References 헤딩이 없으면 어떤 페이지도 비본문으로 묶지 않음(보수적)", () => {
    const pages = [
      page([["First body page of the document with plenty of ordinary prose here.", { fontHeight: 10 }]]),
      page([["[1] This looks like a citation but no References heading preceded it yet.", { fontHeight: 10 }]]),
    ];
    expect(scanReferenceActivation(pages)).toEqual([false, false]);
  });

  it("이니셜-성(Z. Du) author-year 양식의 연속 refs 페이지 활성", () => {
    const pages = [
      page([["Ordinary body content of the paper that fills a normal page here.", { fontHeight: 10 }]]),
      page([["References", { fontHeight: 12, normTop: 0.1 }]]),
      page([
        ["Z. Du, Y. Qian, X. Liu, M. Ding. A cited paper. In Proceedings, 2024.", { fontHeight: 10 }],
        ["A. Lewkowycz, A. Andreassen, D. Dohan. Another cited work, 2022.", { fontHeight: 10 }],
      ]),
      page([["This appendix prose should be translated and kept as body text.", { fontHeight: 10 }]]),
    ];
    expect(scanReferenceActivation(pages)).toEqual([false, false, true, false]);
  });

  it("번호식(74. Yang) 양식의 연속 refs 페이지 활성", () => {
    const pages = [
      page([["Ordinary body content on a normal page of this paper goes here now.", { fontHeight: 10 }]]),
      page([["References", { fontHeight: 12, normTop: 0.1 }]]),
      page([
        ["74. Yang, C., Wang, X. Large Language Models as Optimizers. ICLR 2024.", { fontHeight: 10 }],
        ["75. Song, X., Tian, Y. Another referenced paper here, 2023.", { fontHeight: 10 }],
      ]),
    ];
    expect(scanReferenceActivation(pages)).toEqual([false, false, true]);
  });

  it("References 헤딩 직후 첫 페이지는 서지 신호가 약해도 강제 refs(justEntered)", () => {
    const pages = [
      page([["Body content that occupies a full normal page of the document here.", { fontHeight: 10 }]]),
      page([["References", { fontHeight: 12, normTop: 0.1 }]]),
      page([["Sparse first reference page with weak signals following the heading.", { fontHeight: 10 }]]),
    ];
    expect(scanReferenceActivation(pages)[2]).toBe(true);
  });
});

describe("러닝 헤더/푸터(furniture)", () => {
  const HEADER = "A GUI World Model via Renderable Code Generation"; // 24자+ → 단일 페이지 규칙 통과

  function headerPages(n: number): BodyItem[][] {
    return Array.from({ length: n }, () => [item(HEADER, { normTop: 0.05 })]);
  }

  it("3페이지 이상 반복되는 상단 밴드 헤더를 furniture로 수집", () => {
    const furniture = scanRunningFurniture(headerPages(5));
    expect(furniture.size).toBe(1);
    expect(furniture.has("a gui world model via renderable code generation")).toBe(true);
  });

  it("반복이 부족하면(2페이지) furniture로 잡지 않음", () => {
    expect(scanRunningFurniture(headerPages(2)).size).toBe(0);
  });

  it("페이지 번호가 달라도 같은 헤더로 정규화(숫자→#)해 반복 카운트", () => {
    const pages = Array.from({ length: 4 }, (_, i) => [
      item(`${HEADER} ${i + 1}`, { normTop: 0.05 }),
    ]);
    const furniture = scanRunningFurniture(pages);
    expect(furniture.size).toBe(1);
  });

  it("furniture 주입 시 24자+ 러닝 헤더를 drop(밴드 위치 AND 반복)", () => {
    const items = [
      item(HEADER, { normTop: 0.05 }), // 반복 헤더 → drop
      item("This is the genuine body sentence that must survive the filter here.", {
        normTop: 0.5,
      }),
    ];
    const furniture = scanRunningFurniture(headerPages(5));
    const { bodyText } = extractBody(items, { furniture });
    expect(bodyText).not.toContain("Renderable Code Generation");
    expect(bodyText).toContain("genuine body sentence");
  });

  it("밴드 밖(본문 영역)에서는 같은 텍스트라도 furniture로 drop하지 않음", () => {
    const items = [item(HEADER, { normTop: 0.5 })]; // 본문 영역
    const furniture = scanRunningFurniture(headerPages(5));
    const { bodyText } = extractBody(items, { furniture });
    expect(bodyText).toContain("Renderable Code Generation");
  });
});

describe("groupLines normTop 라인 분리 (hasEOL 누락 join 교정)", () => {
  const HEADER = "A GUI World Model via Renderable Code Generation";

  it("hasEOL 누락으로 헤더가 본문과 join돼도 줄높이 점프로 분리 → 헤더만 furniture drop", () => {
    const furniture = scanRunningFurniture(
      Array.from({ length: 5 }, () => [item(HEADER, { normTop: 0.06 })]),
    );
    const items = [
      // pdf.js가 헤더 끝 EOL을 누락해 본문과 한 item-run으로 묶인 상황(normTop 점프).
      item(HEADER, { normTop: 0.06, hasEOL: false }),
      item("This is the genuine body sentence that should be translated here.", {
        normTop: 0.13,
      }),
    ];
    const { bodyText } = extractBody(items, { furniture });
    expect(bodyText).not.toContain("Renderable Code Generation");
    expect(bodyText).toContain("genuine body sentence");
  });

  it("figure 캡션이 본문과 join돼도 줄높이 점프로 분리 → 캡션만 drop", () => {
    const items = [
      item("Some body text right before the figure caption on the same run.", {
        normTop: 0.5,
        hasEOL: false,
      }),
      item("Figure 3: A caption describing the figure in detail.", { normTop: 0.56 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("Some body text right before");
    expect(bodyText).not.toContain("Figure 3");
  });

  it("줄높이가 비슷하면 같은 라인 유지(과분리 방지)", () => {
    const items = [
      item("first part ", { normTop: 0.5, hasEOL: false }),
      item("second part of the same line.", { normTop: 0.505 }), // 0.005 < 임계
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("first part second part of the same line.");
  });
});

describe("비본문 라인(의사코드·소속·스탬프·수식번호)", () => {
  it("Algorithm 캡션 이후 의사코드 블록(번호 스텝·Require/Ensure)을 제거하고 본문 재개", () => {
    const items = [
      item("Algorithm 1 Automated Data Synthesis with Visual Feedback Revision", { fontHeight: 10 }),
      item("Require: Raw GUI dataset and a multimodal coder model here.", { fontHeight: 10 }),
      item("Ensure: High-fidelity corpus of paired samples.", { fontHeight: 10 }),
      item("1: Dsyn ← ∅", { fontHeight: 10 }),
      item("2: for all items in the dataset do the synthesis loop", { fontHeight: 10 }),
      item("21: return Dsyn", { fontHeight: 10 }),
      item("We now describe the training procedure for the coder in detail.", { fontHeight: 10 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).not.toContain("Algorithm 1");
    expect(bodyText).not.toContain("Require:");
    expect(bodyText).not.toContain("return Dsyn");
    expect(bodyText).toContain("We now describe the training procedure");
  });

  it("의사코드처럼 보이는 본문('While we ...')은 algorithmMode 밖에서 보존", () => {
    const items = [
      item("While we found this approach effective, several limitations remain here.", {
        fontHeight: 10,
      }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("While we found this approach effective");
  });

  it("저자 소속/연락처 블록을 drop", () => {
    const items = [
      item("This sentence is genuine body content that must be translated here.", {
        fontHeight: 10,
      }),
      item("*Equal contribution 1University of Example. Correspondence to: a@b.c", {
        fontHeight: 9,
      }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("genuine body content");
    expect(bodyText).not.toContain("Equal contribution");
  });

  it("Preprint 스탬프를 drop", () => {
    const items = [
      item("Preprint. Under review.", { fontHeight: 10, normTop: 0.72 }),
      item("Real body sentence on the page that should be kept intact here.", {
        fontHeight: 10,
      }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).not.toContain("Preprint");
    expect(bodyText).toContain("Real body sentence");
  });

  it("수식번호로 끝나는 display 수식 라인을 drop(수학 기호 동반)", () => {
    const items = [
      item("Body sentence introducing the objective function below right here.", {
        fontHeight: 10,
      }),
      item("LGRPO(θ) = Ex min(ρiAi, clip(ρi)) − βDKL(πθ ∥ πsft) (5)", { fontHeight: 10 }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("Body sentence introducing");
    expect(bodyText).not.toContain("(5)");
  });

  it("수식번호 패턴이지만 수학 기호가 없는 본문 인용은 보존", () => {
    const items = [
      item("This behaviour is consistent with the trend reported by prior work (5)", {
        fontHeight: 10,
      }),
    ];
    const { bodyText } = extractBody(items);
    expect(bodyText).toContain("consistent with the trend");
  });
});

describe("cross-page 문장 carry-over", () => {
  it("trailingIncomplete: 마지막 종결 이후를 미완 꼬리로 분리", () => {
    expect(trailingIncomplete("First sentence. Second one is cut")).toEqual({
      headLen: 15,
      tail: "Second one is cut",
    });
    expect(trailingIncomplete("All complete here.")).toEqual({ headLen: 18, tail: "" });
    expect(trailingIncomplete("No ender at all here")).toEqual({
      headLen: 0,
      tail: "No ender at all here",
    });
  });

  it("페이지 끝 미완 문장을 제외하고 다음 페이지 앞에 붙여 완성", () => {
    const prevText = "Complete sentence here. The model predicts the next";
    const raw = {
      text: "state accurately. New body sentence follows here.",
      segments: [{ bodyStart: 0, bodyEnd: 49, globalStart: 100, globalEnd: 149 }],
    };
    const { text, segments } = carryAcrossPages(prevText, raw, false);
    expect(text.startsWith("The model predicts the next state accurately.")).toBe(true);
    expect(text).toContain("New body sentence follows here.");
    expect(segments[0].bodyStart).toBe("The model predicts the next ".length);
  });

  it("이전 페이지 미완 꼬리(prevTail)는 segment가 없어 교차 하이라이트 비활성", () => {
    const prevText = "Body. trailing cut";
    const raw = {
      text: "end. Next.",
      segments: [{ bodyStart: 0, bodyEnd: 10, globalStart: 0, globalEnd: 10 }],
    };
    const { segments } = carryAcrossPages(prevText, raw, false);
    expect(mapBodyRange(segments, 0, 5)).toBeNull(); // prevTail 영역
  });

  it("마지막 페이지는 자기 끝 문장(미완)도 유지", () => {
    const raw = {
      text: "Last page sentence without ending punctuation",
      segments: [{ bodyStart: 0, bodyEnd: 45, globalStart: 0, globalEnd: 45 }],
    };
    const { text } = carryAcrossPages("", raw, true);
    expect(text).toBe("Last page sentence without ending punctuation");
  });

  it("offset 불변식: head segment의 body↔global 대응 유지(미완 꼬리 제외)", () => {
    const prevText = "Done. carry over";
    const raw = {
      text: "head one. head two cut",
      segments: [
        { bodyStart: 0, bodyEnd: 9, globalStart: 50, globalEnd: 59 },
        { bodyStart: 9, bodyEnd: 22, globalStart: 59, globalEnd: 72 },
      ],
    };
    const { text, segments } = carryAcrossPages(prevText, raw, false);
    expect(text).toBe("carry over head one.");
    expect(segments).toHaveLength(1); // 미완 'head two cut' segment 제외
    const s = segments[0];
    expect(text.slice(s.bodyStart, s.bodyEnd)).toBe("head one.");
  });
});

describe("figureExclusionBand — 본문 보존형 도표 제외 밴드", () => {
  // 정규화 라인 박스. 기본 컬럼 전폭.
  function ln(top: number, bot: number, text: string, x0 = 0.05, x1 = 0.95) {
    return { top, bot, x0, x1, text };
  }
  // 길고 글자 위주·구두점 있는 본문 산문(isProse=true). 인덱스로 약간 변형.
  function prose(n: number) {
    return `This is a sufficiently long body sentence number ${n}, used to exercise prose detection here.`;
  }
  const FULL = { x0: 0.02, x1: 0.98 };
  const inBand = (b: { y: number; h: number }, y: number) => y >= b.y && y <= b.y + b.h;

  it("그림: 캡션 위 도표 라벨은 제외, 위쪽 본문 단락은 보존", () => {
    const lines = [
      ln(0.3, 0.32, prose(1)),
      ln(0.33, 0.35, prose(2)),
      ln(0.36, 0.38, prose(3)), // 본문 단락(연속 산문)
      ln(0.55, 0.56, "0.2 0.4 0.6"), // 축 라벨(비산문)
      ln(0.6, 0.61, "Accuracy"), // 라벨(짧음)
      ln(0.7, 0.72, "Figure 1: caption text here"),
    ];
    const band = figureExclusionBand(lines, { top: 0.7, bot: 0.72 }, FULL, "figure");
    expect(inBand(band, 0.555)).toBe(true); // 라벨 제외
    expect(inBand(band, 0.605)).toBe(true);
    expect(inBand(band, 0.34)).toBe(false); // 본문 보존
    expect(band.y).toBeGreaterThan(0.37); // 본문 단락 아래에서 시작
  });

  it("그림: 텍스트 없는 이미지 + 캡션 아래로 이어지는 본문 → 제외 없음(아래 본문 보존)", () => {
    // DeepSeekMath 1페이지: 초록이 Figure를 감싸며 캡션 아래로 이어진다.
    const lines = [
      ln(0.3, 0.32, prose(1)),
      ln(0.33, 0.35, prose(2)),
      ln(0.36, 0.38, prose(3)), // 위 본문(연속)
      // 0.38~0.55 그림 이미지(텍스트 없음)
      ln(0.55, 0.57, "Figure 1: Top1 accuracy of open-source models"),
      ln(0.6, 0.62, prose(4)), // 캡션 아래로 이어지는 본문(고립처럼 보이나 본문)
      ln(0.66, 0.68, "* Core contributors."),
    ];
    const band = figureExclusionBand(lines, { top: 0.55, bot: 0.57 }, FULL, "figure");
    expect(band.h).toBeLessThan(0.02); // 위쪽에 도표 텍스트 없음 → 제외 없음
    expect(inBand(band, 0.61)).toBe(false); // 아래 본문 보존
  });

  it("표: 캡션 아래 표 행 제외, 위/아래 본문 보존", () => {
    const lines = [
      ln(0.2, 0.22, prose(1)),
      ln(0.24, 0.26, prose(2)), // 위 본문(연속)
      ln(0.3, 0.32, "Table 1: results"),
      ln(0.34, 0.35, "Method Acc Time"), // 헤더(짧음)
      ln(0.37, 0.38, "A 1.2 3.4 5.6"), // 숫자 행
      ln(0.4, 0.41, "B 7.8 9.0 1.2"),
      ln(0.5, 0.52, prose(3)),
      ln(0.53, 0.55, prose(4)), // 아래 본문(연속)
    ];
    const band = figureExclusionBand(lines, { top: 0.3, bot: 0.32 }, FULL, "table");
    expect(inBand(band, 0.375)).toBe(true); // 표 행 제외
    expect(inBand(band, 0.25)).toBe(false); // 위 본문 보존
    expect(inBand(band, 0.54)).toBe(false); // 아래 본문 보존
  });

  it("표: 캡션이 표 아래에 오는 양식(데이터가 캡션 위) 대응", () => {
    const lines = [
      ln(0.2, 0.21, "Method Acc Time"), // 표 헤더(위)
      ln(0.23, 0.24, "A 1.2 3.4 5.6"),
      ln(0.26, 0.27, "B 7.8 9.0 1.2"), // 표 데이터(비산문)
      ln(0.3, 0.32, "Table 2: results below caption"),
      ln(0.36, 0.38, prose(1)),
      ln(0.39, 0.41, prose(2)), // 아래 본문(연속)
    ];
    const band = figureExclusionBand(lines, { top: 0.3, bot: 0.32 }, FULL, "table");
    expect(inBand(band, 0.235)).toBe(true); // 위쪽 표 데이터 제외
    expect(inBand(band, 0.4)).toBe(false); // 아래 본문 보존
  });

  it("인라인 'Figure N shows ...' 오탐 캡션: 양쪽이 본문 → 제외 없음", () => {
    const lines = [
      ln(0.3, 0.32, prose(1)),
      ln(0.33, 0.35, prose(2)),
      ln(0.36, 0.38, "Figure 8 shows that a larger sampling number consistently improves accuracy."),
      ln(0.39, 0.41, prose(3)),
      ln(0.42, 0.44, prose(4)), // 위·아래 모두 연속 본문
    ];
    const band = figureExclusionBand(lines, { top: 0.36, bot: 0.38 }, FULL, "figure");
    expect(band.h).toBeLessThan(0.02); // 도표 콘텐츠 없음 → 제외 없음
  });

  it("표 사이에 낀 고립 산문 한 줄로는 밴드가 멈추지 않는다", () => {
    const lines = [
      ln(0.2, 0.22, "Table 3: caption"),
      ln(0.24, 0.25, "X 1 2 3"), // 표 행
      ln(0.27, 0.28, prose(1)), // 고립 산문(이웃이 표 행) → 정지 아님
      ln(0.3, 0.31, "Y 4 5 6"),
      ln(0.33, 0.34, "Z 7 8 9"), // 표 행 계속
      ln(0.4, 0.42, prose(2)),
      ln(0.43, 0.45, prose(3)), // 연속 본문 → 여기서 정지
    ];
    const band = figureExclusionBand(lines, { top: 0.2, bot: 0.22 }, FULL, "table");
    expect(inBand(band, 0.275)).toBe(true); // 고립 산문도 표 영역으로 제외
    expect(inBand(band, 0.41)).toBe(false); // 연속 본문에서 정지(보존)
  });

  it("섹션 헤딩은 단독이라도 정지선 → 도표 위 헤딩 보존", () => {
    const lines = [
      ln(0.2, 0.3, prose(1)), // 본문 단락
      ln(0.33, 0.35, "4.1 Setup"), // 섹션 헤딩(짧음·고립)
      ln(0.4, 0.41, "0.2 0.4 0.6"), // 그림 라벨
      ln(0.45, 0.46, "legend a"),
      ln(0.55, 0.57, "Figure 2: caption"),
    ];
    const band = figureExclusionBand(lines, { top: 0.55, bot: 0.57 }, FULL, "figure");
    expect(inBand(band, 0.34)).toBe(false); // 헤딩 보존
    expect(inBand(band, 0.405)).toBe(true); // 그림 라벨 제외
  });

  it("컬럼 분리: 반대 컬럼 본문은 경계로 쓰지 않는다", () => {
    const col = { x0: 0.02, x1: 0.47 }; // 좌측 컬럼
    const lines = [
      ln(0.2, 0.21, "0.2 0.4 0.6", 0.05, 0.45), // 좌 컬럼 그림 라벨
      ln(0.25, 0.26, "legend", 0.05, 0.45),
      ln(0.2, 0.4, prose(1), 0.55, 0.95), // 우 컬럼 본문(무관)
      ln(0.3, 0.32, "Figure 3: left col caption", 0.05, 0.45),
    ];
    const band = figureExclusionBand(lines, { top: 0.3, bot: 0.32 }, col, "figure");
    expect(inBand(band, 0.205)).toBe(true); // 좌 컬럼 라벨 제외
    expect(band.h).toBeGreaterThan(0.05);
  });
});
