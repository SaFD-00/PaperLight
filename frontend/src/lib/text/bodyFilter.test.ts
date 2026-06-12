import { describe, expect, it } from "vitest";
// viewer.js 와 동일한 순수 모듈(런타임/테스트 단일 소스).
import {
  type BodyItem,
  extractBody,
  mapBodyRange,
  parseCaptionLabel,
  scanReferenceActivation,
  scanRunningFurniture,
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
