import { describe, expect, it } from "vitest";
import { type Sentence, splitSentences } from "./sentences";

// 각 문장의 오프셋이 원본과 정합하고 단조 증가(비중첩)함을 보장하는 공통 불변식.
function assertOffsets(text: string, sentences: Sentence[]): void {
  let prevEnd = 0;
  for (const s of sentences) {
    expect(text.slice(s.start, s.end)).toBe(s.text);
    expect(s.start).toBeGreaterThanOrEqual(prevEnd);
    expect(s.end).toBeGreaterThan(s.start);
    prevEnd = s.end;
  }
}

describe("splitSentences — 약어 보호", () => {
  const cases: [string, string][] = [
    ["Fig. 라벨 참조", "As shown in Fig. 1 the loss decreases."],
    ["et al. 인용", "The method was proposed by Smith et al. and refined later."],
    ["i.e. 동격", "We freeze the backbone, i.e. only the head trains, in this setup."],
    ["e.g. 예시", "Many domains, e.g. vision and NLP, benefit from this approach."],
    ["vs. 대비", "We compare precision vs. recall across the benchmarks."],
    ["U.S. 지명", "The U.S. National Science Foundation funded this study."],
    ["Dr. 경칭", "This idea was first raised by Dr. Smith in an earlier work."],
    ["Eq. 괄호참조", "Substituting into Eq. (3) yields the final objective."],
    ["Sec. 섹션참조", "We report full results in Sec. 4 of the paper."],
    ["단일 이니셜", "The dataset was curated by J. Smith over two years."],
  ];
  it.each(cases)("%s → 한 문장으로 유지", (_label, text) => {
    const out = splitSentences(text);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe(text);
    assertOffsets(text, out);
  });

  it("이니셜 체인(A. B.)도 한 문장으로 묶는다", () => {
    const text = "Curated by A. B. Carter and released openly.";
    const out = splitSentences(text);
    expect(out).toHaveLength(1);
    assertOffsets(text, out);
  });
});

describe("splitSentences — 정상 경계는 그대로 분리", () => {
  it("마침표 경계 다문장", () => {
    const text = "First sentence here. Second sentence follows. Third one ends it.";
    const out = splitSentences(text);
    expect(out.map((s) => s.text)).toEqual([
      "First sentence here.",
      "Second sentence follows.",
      "Third one ends it.",
    ]);
    assertOffsets(text, out);
  });

  it("물음표/느낌표는 약어로 병합되지 않는다", () => {
    const text = "Does it work? It works!";
    const out = splitSentences(text);
    expect(out.map((s) => s.text)).toEqual(["Does it work?", "It works!"]);
    assertOffsets(text, out);
  });

  it("말줄임표는 문장 경계로 본다", () => {
    const text = "He paused... Then he continued.";
    const out = splitSentences(text);
    expect(out).toHaveLength(2);
    assertOffsets(text, out);
  });

  it("숫자 뒤 마침표는 약어가 아니라 정상 종결", () => {
    const text = "The price was $5. We accepted it anyway.";
    const out = splitSentences(text);
    expect(out).toHaveLength(2);
    assertOffsets(text, out);
  });

  it("약어가 섞인 문장도 진짜 경계에서만 분리", () => {
    const text = "We use a CNN, i.e. a convolutional net. It works well on Fig. 2 data.";
    const out = splitSentences(text);
    expect(out.map((s) => s.text)).toEqual([
      "We use a CNN, i.e. a convolutional net.",
      "It works well on Fig. 2 data.",
    ]);
    assertOffsets(text, out);
  });

  it("빈 문자열·공백은 문장 없음", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   \n  ")).toEqual([]);
  });
});
