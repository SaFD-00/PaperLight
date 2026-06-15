// 약어 사전·판정은 bodyFilter.js(viewer.js 런타임과 공유하는 순수 ESM)에 단일 정의되어 있다.
// bodyFilter.test.ts도 같은 상대경로로 import하는 선례를 따른다(사전 중복 방지).
import { isAbbreviationEnder } from "../../../public/pdfjs/bodyFilter.js";

export interface Sentence {
  text: string;
  /** 원본 문자열 내 시작 오프셋(공백 트림 후). */
  start: number;
  /** 원본 문자열 내 끝 오프셋(배타적). */
  end: number;
}

function pushTrimmed(text: string, start: number, end: number, out: Sentence[]): void {
  const slice = text.slice(start, end);
  const trimmed = slice.trim();
  if (!trimmed) return;
  const leading = slice.length - slice.trimStart().length;
  const trailing = slice.length - slice.trimEnd().length;
  out.push({ text: trimmed, start: start + leading, end: end - trailing });
}

/**
 * 문장 경계로 텍스트를 분리하되 각 문장의 원본 오프셋을 보존한다.
 * 오프셋 공간은 PDF text-layer의 textContent(= 프론트 pageText)와 동일해
 * iframe 측 Range 매핑과 일관된다. 흔한 학술 약어(Fig./e.g./et al./U.S./이니셜 등)는
 * isAbbreviationEnder로 보호하되 완전하지 않은 근사치.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const enderRe = /[.!?]+(?=\s|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = enderRe.exec(text)) !== null) {
    // 약어 마침표(Fig./e.g./U.S./이니셜 J.)에서는 분리하지 않는다. '!'/'?'와 말줄임('...')은
    // m[0]이 '.' 단일이 아니므로 가드를 통과하지 못해 정상 분리된다(오프셋 산식 불변).
    if (m[0] === "." && isAbbreviationEnder(text, m.index)) continue;
    const end = m.index + m[0].length;
    pushTrimmed(text, last, end, out);
    last = end;
  }
  if (last < text.length) pushTrimmed(text, last, text.length, out);
  return out;
}
