// 본문 텍스트 추출 — 학술 PDF 페이지의 text item에서 Figure 캡션/표/수식/페이지번호 등
// 비본문을 보수적으로 제거하고, 남은 본문 문자열과 원문(text-layer) offset 매핑을 만든다.
//
// viewer.js(런타임)와 vitest(테스트)가 공유하는 순수 ESM. 타입은 bodyFilter.d.ts 참고.
// 핵심 불변식: 입력 items[].str 의 연결 순서 = text-layer.textContent offset 공간.
// drop된 item은 bodyText 에서 빠지되, keep된 item의 globalStart 는 보존된다.

// 캡션 머리말(라벨 번호 포함). 영문 + 한국어(그림/표) 모두 매칭. .test(불리언)와
// parseCaptionLabel(.exec)에서 공유한다.
export const CAPTION_RE = /^(figure|fig\.?|table|algorithm|listing|그림|표)\s*(\d+)/i;
// References/Bibliography/Acknowledgments 섹션 헤딩(단독 라인). 선택적 섹션 번호·로마숫자
// 접두('7 References', 'VII. References')를 허용하되 $ 앵커로 단독 헤딩만 잡아 본문 중
// 'references' 언급 오탐을 막는다. 이 라인 이후(같은 페이지)는 비본문으로 간주(refReached).
const REF_HEADING_RE =
  /^(?:(?:\d{1,2}|[ivxlc]{1,5})[.)\s]+)?(references|bibliography|acknowledg(?:e?ments)?)\s*$/i;
// 학회 부록 보일러플레이트(문서 말미, Appendix 뒤). 양식 문구라 번역 가치가 없어 끝까지 제외.
const CHECKLIST_HEADING_RE =
  /^(?:neur\s*ips|neural information processing systems)?\s*paper\s+checklist\s*$/i;
// References 뒤 본문(Appendix/Supplementary) 재개 헤딩 — 같은 페이지 안에서 refReached 해제용.
// arXiv 관행(References 뒤 Appendix는 번역 유지)을 보존한다.
const RESUME_HEADING_RE = /^(?:appendix|appendices|supplement(?:ary)?(?:\s+materials?)?)\b/i;
// 서지(참고문헌) 라인 시그니처. 번호 항목([N])과 author-year(저자 이니셜) 양식을 모두 커버:
// 번호 머리·"Luo, D." 류 저자 이니셜·arXiv·"et al"·"In Proceedings". 실측상 References 페이지는
// 이 신호 비율 0.48~0.70, 본문/Appendix는 0.00~0.04로 분리돼 임계 0.3에 큰 마진이 있다.
const BIB_LINE_RE =
  /(?:^\[\d{1,3}\]|^[A-Z][A-Za-z'`-]+,\s+[A-Z]\.|\barxiv[:\s]|\bet al\b|\bin proceedings\b)/i;
const NUMERIC_LINE_RE = /^[\d.,()[\]{}%±+\-–—\s/:;=*]+$/;
// pdf.js styles 의 fontFamily 에 흔히 나타나는 수식 폰트군.
const MATH_FONT_RE = /(cmmi|cmsy|cmex|msam|msbm|stixmath|mathjax|cmr|eufm|rsfs)/i;
// 이메일 라인(저자 연락처). 전 페이지 적용.
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
// arXiv 식별자(세로 사이드바 스탬프 포함, 회전돼도 라인 텍스트로 join되면 매칭). 전 페이지 적용.
const ARXIV_ID_RE = /arxiv:\s*\d{4}\.\d{4,5}/i;
// 1페이지 front-matter 밴드 종료 지점(초록 헤딩). firstPage 일 때만 사용.
const ABSTRACT_RE = /^abstract\b/i;

function nonSpaceLen(s) {
  return s.replace(/\s/g, "").length;
}

// 상하단 밴드(러닝 헤더/푸터 후보) 폭(정규화). 이 안의 라인만 furniture 반복 탐지 대상.
const FURNITURE_BAND = 0.1;

// 러닝 헤더/푸터 반복 탐지용 정규화 키: 숫자(페이지 번호 등 변동분)를 #로, 공백 정규화 + 소문자.
function furnitureKey(text) {
  return text.trim().toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
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
    let figChars = 0;
    for (const x of cur) {
      const n = nonSpaceLen(x.str);
      totalChars += n;
      if (MATH_FONT_RE.test(x.fontFamily)) mathChars += n;
      if (x.inFigure) figChars += n;
    }
    lines.push({
      items: cur,
      text,
      globalStart,
      globalEnd,
      medianHeight,
      normTop,
      mathRatio: totalChars ? mathChars / totalChars : 0,
      // 라인의 과반 글자가 figure/table 영역 안이면 도표 내부 텍스트로 간주.
      inFigure: totalChars > 0 && figChars / totalChars > 0.5,
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
 * @param {{ firstPage?: boolean, refActiveAtStart?: boolean, furniture?: Set<string> }} [opts]
 * @returns {{ bodyText: string, segments: import("./bodyFilter").BodySegment[], allDropped: boolean }}
 */
export function extractBody(items, opts = {}) {
  const lines = groupLines(items);
  const modal = modalHeight(items);
  // 문서 수준 스캔(scanReferenceActivation)이 이 페이지를 References/Checklist 구간으로
  // 판정하면 첫 라인부터 비본문으로 시작한다(헤딩이 이전 페이지에 있는 연속 페이지 대응).
  let refReached = !!opts.refActiveAtStart;
  // 작은 폰트 캡션 직후 같은 소형 폰트로 이어지는 멀티라인 캡션을 본문 재개 전까지 제거.
  let captionMode = false;

  // 1페이지 front-matter 밴드: 초록 헤딩 이전 구간에서 제목(최대 폰트)만 남기고
  // 저자·소속·이메일·Project/Dataset/Model 링크·*Equal contribution 등을 제거한다.
  // 초록 헤딩이 없으면 밴드 미적용(과잉 제거 방지) — 전 페이지 공통 규칙만 남는다.
  let abstractIdx = -1;
  let titleHeight = 0;
  if (opts.firstPage) {
    abstractIdx = lines.findIndex(
      (l) => ABSTRACT_RE.test(l.text.trim()) && nonSpaceLen(l.text.trim()) < 30,
    );
    if (abstractIdx > 0) {
      for (let i = 0; i < abstractIdx; i++) {
        titleHeight = Math.max(titleHeight, lines[i].medianHeight);
      }
    }
  }

  let bodyText = "";
  /** @type {import("./bodyFilter").BodySegment[]} */
  const segments = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.text.trim();
    const len = nonSpaceLen(trimmed);

    // front-matter 밴드(초록 헤딩 이전): 제목 라인만 유지, 나머지는 drop.
    if (abstractIdx > 0 && idx < abstractIdx) {
      const isTitle = titleHeight > 0 && line.medianHeight >= titleHeight * 0.95;
      if (!isTitle) continue;
    }

    // 캡션 연속 줄: 본문 폰트(>= modal*0.9)로 복귀하면 모드 해제 후 일반 규칙 적용, 아니면 drop.
    if (captionMode && !refReached) {
      const backToBody =
        trimmed !== "" && modal > 0 && line.medianHeight >= modal * 0.9;
      if (backToBody) captionMode = false;
      else continue;
    }

    let drop = false;
    if (refReached) {
      // References/Checklist 구간 — 단, Appendix 등 본문 재개 헤딩(헤딩 폰트)에서 해제해
      // arXiv 관행(References 뒤 Appendix 번역 유지)을 보존한다.
      const resume =
        RESUME_HEADING_RE.test(trimmed) &&
        len < 24 &&
        modal > 0 &&
        line.medianHeight >= modal * 0.95;
      if (resume) refReached = false; // 재개: 이 헤딩 라인부터 일반 규칙으로 평가.
      else drop = true;
    }
    if (!drop && !refReached) {
      if (trimmed === "") {
        drop = true;
      } else if (EMAIL_RE.test(trimmed)) {
        drop = true; // 저자 이메일 라인.
      } else if (ARXIV_ID_RE.test(trimmed)) {
        drop = true; // arXiv 세로 식별자/스탬프.
      } else if (line.inFigure) {
        drop = true; // Figure/Table 영역 내부 텍스트(다이어그램 라벨·표 셀).
      } else if (CAPTION_RE.test(trimmed)) {
        drop = true;
        // 캡션이 본문보다 작은 폰트면 연속 줄도 제거(멀티라인 캡션).
        if (modal > 0 && line.medianHeight > 0 && line.medianHeight < modal * 0.9) {
          captionMode = true;
        }
      } else if (REF_HEADING_RE.test(trimmed) || CHECKLIST_HEADING_RE.test(trimmed)) {
        // 단독 References/Bibliography/Checklist 헤딩 이후 본문 제거.
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
      } else if (
        opts.furniture &&
        !opts.firstPage &&
        (line.normTop < FURNITURE_BAND || line.normTop > 1 - FURNITURE_BAND) &&
        opts.furniture.has(furnitureKey(trimmed))
      ) {
        // 문서 수준 반복 러닝 헤더/푸터(학회 배너·논문 제목 헤더, 길이 무관). 단 1페이지는
        // 제목이 러닝 헤더와 같은 문자열이라 furniture 미적용(front-matter 밴드가 제목 보호).
        drop = true;
      } else if ((line.normTop < 0.06 || line.normTop > 0.94) && len < 24) {
        drop = true; // 페이지 헤더/푸터/페이지 번호.
      }
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

  // 비공백 입력이 전부 drop되면(References/Checklist 전용·전면 Figure 페이지) 의도적 empty.
  // viewer.js가 이 신호로 '추출 실패'(fullText 폴백)와 구분한다.
  const allDropped = bodyText === "" && lines.some((l) => l.text.trim() !== "");
  return { bodyText, segments, allDropped };
}

/**
 * 페이지 라인 중 References/Bibliography/Acknowledgments 단독 헤딩(헤딩 폰트)이 있는가.
 * @param {ReturnType<typeof groupLines>} lines
 * @param {number} modal
 * @param {RegExp} re
 */
function hasHeading(lines, modal, re) {
  return lines.some((l) => {
    const t = l.text.trim();
    return re.test(t) && nonSpaceLen(t) < 28 && (modal === 0 || l.medianHeight >= modal * 0.95);
  });
}

// 페이지 라인 중 서지 시그니처 비율이 임계 이상이면 참(연속 References 페이지 판정).
// 본문(Appendix)은 0.04 이하라 0.3 임계로 안전 분리(보수적: 마진 큼 → 본문 오삭제 회피).
const BIB_PAGE_RATIO = 0.3;
function isBibliographyPage(lines) {
  let total = 0;
  let bib = 0;
  for (const l of lines) {
    const t = l.text.trim();
    if (!t) continue;
    total++;
    if (BIB_LINE_RE.test(t)) bib++;
  }
  return total > 0 && bib / total >= BIB_PAGE_RATIO;
}

/**
 * 문서 전체를 페이지 순서로 훑어 각 페이지의 refActiveAtStart(boolean)를 산출한다.
 * extractBody가 페이지 단위 stateless라 References가 여러 페이지에 걸치면 헤딩 다음
 * 페이지의 참고문헌 전체가 통과하던 문제를 문서 수준에서 해결한다(임의 순서 요청과 무관하게
 * 결정적). References 헤딩 이후 '서지 시그니처가 과반인 연속 페이지'만 비본문으로 묶고,
 * Appendix 등 본문이 재개되면(서지 시그니처 소멸) 자동 해제한다(보수적: 본문 오삭제 회피).
 * Checklist 헤딩 이후는 문서 말미 보일러플레이트라 끝까지 비본문으로 본다.
 * @param {import("./bodyFilter").BodyItem[][]} pagesItems 페이지별 BodyItem 배열(inFigure 불필요).
 * @returns {boolean[]} 페이지별 refActiveAtStart.
 */
export function scanReferenceActivation(pagesItems) {
  const out = [];
  let mode = "body"; // "body" | "refs" | "tail"
  for (const items of pagesItems) {
    if (mode === "tail") {
      out.push(true); // Checklist 이후: 전 페이지 비본문.
      continue;
    }
    const lines = groupLines(items);
    const modal = modalHeight(items);
    if (mode === "body") {
      out.push(false);
      if (hasHeading(lines, modal, CHECKLIST_HEADING_RE)) mode = "tail";
      else if (hasHeading(lines, modal, REF_HEADING_RE)) mode = "refs";
    } else {
      // refs: 헤딩 다음 페이지들. 서지 과반이면 비본문 유지, 아니면 본문 재개.
      if (hasHeading(lines, modal, CHECKLIST_HEADING_RE)) {
        out.push(false);
        mode = "tail";
      } else if (isBibliographyPage(lines)) {
        out.push(true);
      } else {
        out.push(false);
        mode = "body";
      }
    }
  }
  return out;
}

/**
 * 문서 전체에서 상하단 밴드에 '여러 페이지 반복'되는 러닝 헤더/푸터(학회 배너·논문 제목
 * 헤더 등)를 식별해 정규화 키 집합으로 돌려준다. 단일 페이지로는 길이 제한(len<24)에 걸려
 * 못 거르는 24자+ 헤더를 '밴드 위치 AND 반복'의 2신호로만 잡아 본문 오삭제를 피한다.
 * @param {import("./bodyFilter").BodyItem[][]} pagesItems
 * @param {number} [minRepeat] 반복 기준(기본 3페이지).
 * @returns {Set<string>} furnitureKey 집합.
 */
export function scanRunningFurniture(pagesItems, minRepeat = 3) {
  const freq = new Map();
  for (const items of pagesItems) {
    const lines = groupLines(items);
    const seen = new Set(); // 한 페이지 내 중복은 1회만 카운트.
    for (const l of lines) {
      if (l.normTop >= FURNITURE_BAND && l.normTop <= 1 - FURNITURE_BAND) continue;
      const t = l.text.trim();
      if (nonSpaceLen(t) < 8) continue; // 짧은 헤더/페이지번호는 기존 길이 규칙이 처리.
      const k = furnitureKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      freq.set(k, (freq.get(k) || 0) + 1);
    }
  }
  const furniture = new Set();
  for (const [k, n] of freq) if (n >= minRepeat) furniture.add(k);
  return furniture;
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
