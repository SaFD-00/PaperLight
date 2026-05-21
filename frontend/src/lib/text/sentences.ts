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
 * iframe 측 Range 매핑과 일관된다. 약어 등은 과분할될 수 있는 근사치.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const enderRe = /[.!?]+(?=\s|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = enderRe.exec(text)) !== null) {
    const end = m.index + m[0].length;
    pushTrimmed(text, last, end, out);
    last = end;
  }
  if (last < text.length) pushTrimmed(text, last, text.length, out);
  return out;
}
