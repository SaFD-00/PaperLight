// 본문 텍스트 추출 — 학술 PDF 페이지의 text item에서 Figure 캡션/표/수식/페이지번호 등
// 비본문을 보수적으로 제거하고, 남은 본문 문자열과 원문(text-layer) offset 매핑을 만든다.
//
// viewer.js(런타임)와 vitest(테스트)가 공유하는 순수 ESM. 타입은 bodyFilter.d.ts 참고.
// 핵심 불변식: 입력 items[].str 의 연결 순서 = text-layer.textContent offset 공간.
// drop된 item은 bodyText 에서 빠지되, keep된 item의 globalStart 는 보존된다.

// 캡션 머리말(라벨 번호 포함). 영문 + 한국어(그림/표) 모두 매칭. .test(불리언)와
// parseCaptionLabel(.exec)에서 공유한다.
export const CAPTION_RE = /^(figure|fig\.?|table|algorithm|listing|그림|표)\s*(\d+)/i;
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
  // 작은 폰트 캡션 직후 같은 소형 폰트로 이어지는 멀티라인 캡션을 본문 재개 전까지 제거.
  let captionMode = false;

  let bodyText = "";
  /** @type {import("./bodyFilter").BodySegment[]} */
  const segments = [];

  for (const line of lines) {
    const trimmed = line.text.trim();
    const len = nonSpaceLen(trimmed);

    // 캡션 연속 줄: 본문 폰트(>= modal*0.9)로 복귀하면 모드 해제 후 일반 규칙 적용, 아니면 drop.
    if (captionMode && !refReached) {
      const backToBody =
        trimmed !== "" && modal > 0 && line.medianHeight >= modal * 0.9;
      if (backToBody) captionMode = false;
      else continue;
    }

    let drop = false;
    if (refReached) {
      drop = true;
    } else if (trimmed === "") {
      drop = true;
    } else if (CAPTION_RE.test(trimmed)) {
      drop = true;
      // 캡션이 본문보다 작은 폰트면 연속 줄도 제거(멀티라인 캡션).
      if (modal > 0 && line.medianHeight > 0 && line.medianHeight < modal * 0.9) {
        captionMode = true;
      }
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

/**
 * 캡션 텍스트에서 종류와 정규화된 라벨을 추출한다(Figure/Table 인라인 설명 앵커용).
 * @param {string} text
 * @returns {{ kind: "figure" | "table", label: string } | null}
 */
export function parseCaptionLabel(text) {
  const m = CAPTION_RE.exec(text.trim());
  if (!m) return null;
  const word = m[1].toLowerCase();
  const kind = word.startsWith("tab") || m[1] === "표" ? "table" : "figure";
  let head;
  if (m[1] === "그림") head = "그림";
  else if (m[1] === "표") head = "표";
  else head = kind === "table" ? "Table" : "Figure";
  return { kind, label: `${head} ${m[2]}` };
}
