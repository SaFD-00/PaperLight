/** F-07 Preview — 본문 cross-ref(Figure 3 / Table 2 / 그림 1 / 표 4) 감지 + figure layout 매칭. */
import type { FigureLayout } from "@/lib/pdf/messages";

export type CrossRefKind = "figure" | "table";

export interface CrossRefToken {
  kind: CrossRefKind;
  num: number;
  raw: string;
}

export type CrossRefPart = { text: string } | { ref: CrossRefToken };

const PATTERN = /((?:Figures?|Figs?\.?|Tables?)\s*\d+|(?:그림|표)\s*\d+)/g;

function classify(raw: string): CrossRefToken | null {
  const numMatch = raw.match(/\d+/);
  if (!numMatch) return null;
  const num = Number(numMatch[0]);
  const head = raw.slice(0, numMatch.index).toLowerCase();
  const kind: CrossRefKind =
    head.startsWith("table") || head.startsWith("표") ? "table" : "figure";
  return { kind, num, raw };
}

/** 텍스트를 일반 텍스트 / cross-ref 토큰 조각으로 분리(순수). */
export function splitCrossRefs(text: string): CrossRefPart[] {
  const parts: CrossRefPart[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    const ref = classify(m[0]);
    if (ref === null) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ ref });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** figure layout label("Figure 3" / "Table 2" / "그림 1")을 kind+num으로 파싱(순수). */
export function parseLabel(label: string): { kind: CrossRefKind; num: number } | null {
  const token = classify(label);
  return token ? { kind: token.kind, num: token.num } : null;
}

/** cross-ref 토큰에 대응하는 layout 항목의 인덱스(없으면 null). */
export function findFigureIndex(figures: FigureLayout[], token: CrossRefToken): number | null {
  for (let i = 0; i < figures.length; i++) {
    const parsed = parseLabel(figures[i].label);
    if (parsed && parsed.kind === token.kind && parsed.num === token.num) return i;
  }
  return null;
}
