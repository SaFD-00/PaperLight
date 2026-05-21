// 본문 텍스트 추출 — 학술 PDF 페이지의 text item에서 Figure 캡션/표/수식/페이지번호 등
// 비본문을 보수적으로 제거하고, 남은 본문 문자열과 원문(text-layer) offset 매핑을 만든다.
//
// viewer.js(런타임)와 vitest(테스트)가 공유하는 순수 ESM. 타입은 bodyFilter.d.ts 참고.
// 핵심 불변식: 입력 items[].str 의 연결 순서 = text-layer.textContent offset 공간.
// drop된 item은 bodyText 에서 빠지되, keep된 item의 globalStart 는 보존된다.

const CAPTION_RE = /^(figure|fig\.?|table|algorithm|listing)\s*\d/i;
const REF_HEADING_RE = /^(references|bibliography|acknowledg(e?ments)?)\b/i;
const NUMERIC_LINE_RE = /^[\d.,()[\]{}%±+\-–—\s/:;=*]+$/;
// pdf.js styles 의 fontFamily 에 흔히 나타나는 수식 폰트군.
const MATH_FONT_RE = /(cmmi|cmsy|cmex|msam|msbm|stixmath|mathjax|cmr|eufm|rsfs)/i;

function nonSpaceLen(s) {
  return s.replace(/\s/g, "").length;
}

/**
 * item 들을 hasEOL 기준으로 라인 단위로 묶는다.
 * 각 라인: { items, text, globalStart, globalEnd, medianHeight, normTop, mathRatio }
 */
function groupLines(items) {
  const lines = [];
  let cur = [];
  let cursor = 0;
  const flush = () => {
    if (cur.length === 0) return;
    const text = cur.map((x) => x.str).join("");
    const globalStart = cur[0].globalStart;
    const globalEnd = cur[cur.length - 1].globalEnd;
    const heights = cur.map((x) => x.fontHeight).filter((h) => h > 0).sort((a, b) => a - b);
    const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
    const normTop = cur.reduce((m, x) => Math.min(m, x.normTop), 1);
    let mathChars = 0;
    let totalChars = 0;
    for (const x of cur) {
      const n = nonSpaceLen(x.str);
      totalChars += n;
      if (MATH_FONT_RE.test(x.fontFamily)) mathChars += n;
    }
    lines.push({
      items: cur,
      text,
      globalStart,
      globalEnd,
      medianHeight,
      normTop,
      mathRatio: totalChars ? mathChars / totalChars : 0,
    });
    cur = [];
  };
  for (const it of items) {
    const globalStart = cursor;
    cursor += it.str.length;
    cur.push({ ...it, globalStart, globalEnd: cursor });
    if (it.hasEOL) flush();
  }
  flush();
  return lines;
}

// str 길이로 가중한 최빈 폰트 높이(본문 기준선).
function modalHeight(items) {
  const tally = new Map();
  for (const it of items) {
    if (it.fontHeight <= 0) continue;
    const key = Math.round(it.fontHeight * 2) / 2;
    tally.set(key, (tally.get(key) || 0) + nonSpaceLen(it.str));
  }
  let best = 0;
  let bestW = -1;
  for (const [h, w] of tally) {
    if (w > bestW) {
      bestW = w;
      best = h;
    }
  }
  return best;
}

/**
 * @param {import("./bodyFilter").BodyItem[]} items
 * @returns {{ bodyText: string, segments: import("./bodyFilter").BodySegment[] }}
 */
export function extractBody(items) {
  const lines = groupLines(items);
  const modal = modalHeight(items);
  let refReached = false;

  let bodyText = "";
  /** @type {import("./bodyFilter").BodySegment[]} */
  const segments = [];

  for (const line of lines) {
    const trimmed = line.text.trim();
    const len = nonSpaceLen(trimmed);

    let drop = false;
    if (refReached) {
      drop = true;
    } else if (trimmed === "") {
      drop = true;
    } else if (CAPTION_RE.test(trimmed)) {
      drop = true;
    } else if (REF_HEADING_RE.test(trimmed) && len < 24) {
      // 단독 References/Bibliography 헤딩 이후 본문 제거.
      refReached = true;
      drop = true;
    } else if (NUMERIC_LINE_RE.test(trimmed)) {
      drop = true; // 표 셀·수치 라인.
    } else if (len < 3) {
      drop = true; // 단독 짧은 토큰.
    } else if (line.mathRatio > 0.6 && len < 40) {
      drop = true; // 수식 라인(인라인 수식 보호 위해 짧은 라인만).
    } else if (modal > 0 && line.medianHeight > 0 && line.medianHeight < modal * 0.78 && len < 40) {
      drop = true; // 작은 폰트 + 짧은 라인(Figure 라벨·각주·위첨자).
    } else if ((line.normTop < 0.06 || line.normTop > 0.94) && len < 24) {
      drop = true; // 페이지 헤더/푸터/페이지 번호.
    }

    if (drop) continue;

    // keep: 라인 텍스트를 bodyText 에 붙이고 segment 기록(연속이면 병합).
    const bodyStart = bodyText.length;
    bodyText += line.text;
    const bodyEnd = bodyText.length;
    const last = segments[segments.length - 1];
    if (last && last.globalEnd === line.globalStart && last.bodyEnd === bodyStart) {
      last.bodyEnd = bodyEnd;
      last.globalEnd = line.globalEnd;
    } else {
      segments.push({
        bodyStart,
        bodyEnd,
        globalStart: line.globalStart,
        globalEnd: line.globalEnd,
      });
    }
  }

  return { bodyText, segments };
}

/**
 * body 공간 [bodyStart, bodyEnd) → 원문(text-layer) 전역 offset 으로 매핑.
 * @param {import("./bodyFilter").BodySegment[]} segments
 * @param {number} bodyStart
 * @param {number} bodyEnd
 * @returns {{ startOffset: number, endOffset: number } | null}
 */
export function mapBodyRange(segments, bodyStart, bodyEnd) {
  let startOffset = null;
  let endOffset = null;
  for (const seg of segments) {
    if (startOffset === null && bodyStart >= seg.bodyStart && bodyStart < seg.bodyEnd) {
      startOffset = seg.globalStart + (bodyStart - seg.bodyStart);
    }
    const e = bodyEnd - 1;
    if (e >= seg.bodyStart && e < seg.bodyEnd) {
      endOffset = seg.globalStart + (e - seg.bodyStart) + 1;
    }
  }
  if (startOffset === null || endOffset === null) return null;
  return { startOffset, endOffset };
}
