// 본문 텍스트 추출 — 학술 PDF 페이지의 text item에서 Figure 캡션/표/수식/페이지번호 등
// 비본문을 보수적으로 제거하고, 남은 본문 문자열과 원문(text-layer) offset 매핑을 만든다.
//
// viewer.js(런타임)와 vitest(테스트)가 공유하는 순수 ESM. 타입은 bodyFilter.d.ts 참고.
// 핵심 불변식: 입력 items[].str 의 연결 순서 = text-layer.textContent offset 공간.
// drop된 item은 bodyText 에서 빠지되, keep된 item의 globalStart 는 보존된다.

// 캡션 머리말(라벨 번호 포함). 영문 + 한국어(그림/표) 모두 매칭. "Supplementary/Extended
// Data/Appendix" 접두(부록 캡션 양식)는 non-capturing으로 허용해 그룹 인덱스를 유지한다.
// .test(불리언)와 parseCaptionLabel(.exec)에서 공유한다.
// 머리말은 영문(figure/table/algorithm/listing + scheme/chart/plate/box/exhibit), 한국어(그림/표),
// 중국어·일본어(图/表/図)를 매칭한다. 표(KR)·表(CJK)는 별개 글자.
export const CAPTION_RE =
  /^(?:(?:supplementary|supp\.?|extended\s+data|appendix)\s+)?(figure|fig\.?|table|algorithm|listing|scheme|chart|plate|box|exhibit|그림|표|图|表|図)\s*(\d+)/i;
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
// 서지(참고문헌) 라인 시그니처. 다양한 학회 양식을 커버한다:
// 번호 항목([N])·"Luo, D."(성,이니셜)·"Z. Du"/"A. B. Smith"(이니셜,성)·arXiv·"et al"·
// "In Proceedings". 실측상 References 페이지는 이 신호 비율이 본문/Appendix보다 크게 높다.
const BIB_LINE_RE =
  /(?:^\[\d{1,3}\]|^\d{1,3}\.\s+[A-Z][a-z]|^[A-Z][A-Za-z'`-]+,\s+[A-Z]\.|^[A-Z]\.(?:[\s-][A-Z]\.)*\s+[A-Z][a-z]|\barxiv[:\s]|\bet al\b|\bin proceedings\b)/i;
const NUMERIC_LINE_RE = /^[\d.,()[\]{}%±+\-–—\s/:;=*]+$/;
// pdf.js styles 의 fontFamily 에 흔히 나타나는 수식 폰트군.
const MATH_FONT_RE = /(cmmi|cmsy|cmex|msam|msbm|stixmath|mathjax|cmr|eufm|rsfs)/i;
// 이메일 라인(저자 연락처). 전 페이지 적용.
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
// arXiv 식별자(세로 사이드바 스탬프 포함, 회전돼도 라인 텍스트로 join되면 매칭). 전 페이지 적용.
const ARXIV_ID_RE = /arxiv:\s*\d{4}\.\d{4,5}/i;
// 1페이지 front-matter 밴드 종료 지점(초록 헤딩). firstPage 일 때만 사용.
const ABSTRACT_RE = /^abstract\b/i;
// 저자 소속/연락처 블록(ICML 등은 초록 뒤 각주형으로 와 front-matter 밴드를 벗어난다).
const AFFILIATION_RE = /\b(?:equal contribution|corresponding author|correspondence to)\b/i;
// 프리프린트/투고 스탬프(짧은 라인).
const STAMP_RE = /^(?:preprint|under review|to appear|accepted at|published as|in submission)\b/i;
// 의사코드 스텝 라인. Algorithm/Listing 캡션 이후 algorithmMode에서만 적용(본문 오삭제 방지).
// 의사코드는 모든 줄이 'N:' 번호 또는 Require/Ensure/Input/Output로 시작한다.
const PSEUDOCODE_RE = /^(?:\d{1,2}:\s|require\s*:|ensure\s*:|input\s*:|output\s*:)/i;
// 수식번호로 끝나는 display 수식 라인(본문 문장은 '(4)'로 끝나지 않는다).
const EQUATION_NUM_RE = /\(\d{1,3}\)\s*$/;
// 수식 라인 보강 판정용 수학 기호/그리스 문자(수식번호 종결과 AND로만 사용).
const MATH_SYMBOL_RE = /[=≤≥<>∥∑∏∫√≈≠←→∈∉⊂⊆∇∂α-ωΑ-Ω]|−/;
// 위와 동일 문자집합의 global 버전(의사코드 wrap 줄 판정 시 기호 개수 카운트용, 중괄호 포함).
const MATH_SYMBOL_GLOBAL_RE = /[=≤≥<>∥∑∏∫√≈≠←→∈∉⊂⊆∇∂α-ωΑ-Ω{}−]/g;
// display 수식 밀도 판정용 구조 글리프(관계연산자 + 그리스 + 괄호·대괄호·중괄호 + 슬래시·별표·
// 캐럿·언더스코어). 괄호류를 분자에 넣어도 안전한 건 isDisplayMathLine이 funcWordCount===0
// (산문 배제) 게이트 뒤에서만 이 밀도를 보기 때문이다(괄호 든 본문 문장엔 닿지 않음).
const MATH_STRUCT_GLOBAL_RE = /[=≤≥<>∥∑∏∫√≈≠←→∈∉⊂⊆∇∂α-ωΑ-Ω{}()[\]−*/^_]/g;
// 관계연산자 — display 수식은 거의 항상 등호/부등호/포함 등 관계연산자를 포함한다.
const RELATION_OP_RE = /[=≤≥<>≈≠∈∉⊂⊆←→∝]/;
// 구조 글리프 밀도 임계. 실측: 수식 라인 0.42~0.64, 산문(인라인 수식 포함) ≤0.04 → 10배 마진.
const DISPLAY_MATH_DENSITY = 0.3;
// 섹션/부록 헤딩(번호·로마숫자·부록 글자 접두). figureExclusionBand에서 도표 인접 본문 경계로
// 쓴다(짧아도 본문이므로 도표 밴드가 삼키면 안 됨): '4 Experiments', '4.1 Setup', 'A.2 ...',
// 'III. Method'. 번호 뒤를 [A-Za-z]로 한정해 숫자 표 행('52.16 81.69 ...')을 헤딩으로 오인하지
// 않는다. CAPTION_RE(Figure/Table 등)와는 별개로 '본문 라인 경계'만 식별한다.
const FIG_HEADING_RE = /^(?:\d{1,2}(?:\.\d{1,2}){0,3}|[A-Z](?:\.\d{1,2}){0,2}|[ivxlc]{1,5})[.)]?\s+[A-Za-z]/;

// 문장 종결(.) 오인 방지용 약어 사전. 학술 영문 논문 빈출 약어만 보수적으로 담는다
// (정상 문장 경계 유지 > 약어 병합). 키는 소문자, 내부 점 포함 형태(e.g/u.s)와 점 제거
// 형태(eg/us)를 isAbbreviationEnder에서 둘 다 대조한다. splitSentences(문장 분리)와
// trailingIncomplete(cross-page carry 판정)가 공유한다 — '.' 종결만, '!'/'?'·말줄임('...')은 제외.
export const ABBREVIATIONS = new Set([
  // 라틴 약어
  "e.g", "i.e", "cf", "vs", "etc", "et", "al", "viz", "ibid", "n.b",
  "w.r.t", "a.k.a", "approx", "resp", "incl", "esp",
  // 참조/구조 (Fig. 1 / Eq. (3) / Sec. 4 / Tab. 2 / Ref.)
  "fig", "figs", "eq", "eqs", "tab", "tabs", "sec", "secs", "ref", "refs",
  "no", "nos", "vol", "vols", "pp", "ch", "chap", "ed", "eds", "app", "alg",
  // 경칭/이름
  "dr", "prof", "mr", "mrs", "ms", "st", "jr", "sr",
  // 지명/기관 (U.S. government 등)
  "u.s", "u.k", "e.u",
]);

// text[i](종결 '.')가 문장 끝이 아니라 약어/이니셜의 마침표인지 판정. true면 분리/종결하지 않는다.
// 보수적: 사전·이니셜에 확실히 걸릴 때만 true, 애매하면 false(정상 분리 유지).
export function isAbbreviationEnder(text, i) {
  if (text[i] !== ".") return false; // '!'/'?'는 약어 아님(호출부 가드와 이중 안전).
  if (i > 0 && text[i - 1] === ".") return false; // 말줄임('...')·연속 마침표는 약어 아님.
  // 직전 토큰을 역방향 추출(영문자 + 내부 점). 예: "e.g" / "U.S" / "Fig" / "al".
  let j = i - 1;
  while (j >= 0 && /[A-Za-z.]/.test(text[j])) j--;
  const rawTok = text.slice(j + 1, i); // 종결 '.' 제외.
  if (!rawTok) return false; // 숫자·기호 뒤 마침표("$5.")는 정상 종결.
  const tok = rawTok.replace(/^\.+/, "").toLowerCase();
  if (!tok) return false;
  if (ABBREVIATIONS.has(tok) || ABBREVIATIONS.has(tok.replace(/\./g, ""))) return true;
  // 단일 대문자 이니셜("J. Smith"/"A. B."): 종결 뒤 첫 비공백이 대문자/'('면 이니셜로 본다.
  if (/^[A-Za-z]$/.test(rawTok) && rawTok === rawTok.toUpperCase()) {
    const after = text.slice(i + 1).match(/\S/);
    if (after && /[A-Z(]/.test(after[0])) return true;
  }
  return false;
}

function nonSpaceLen(s) {
  return s.replace(/\s/g, "").length;
}

// 본문 산문 판별용 영어 기능어(+한글)는 저자/소속 명사 나열과 본문 문장을 구분한다.
const PROSE_FUNC_RE =
  /\b(?:the|of|and|to|in|is|are|with|for|as|that|by|on|we|this|our|from|be|an|or|which|can|it|its|their|these|a)\b/i;

// 산문(본문 문장)처럼 보이는가: 공백 포함·글자 위주(숫자<20%)이며 기능어 또는 한글 포함.
// 저자명("Bo An, Kun Huang")·소속("Xiamen University")·표 행은 기능어가 없어 false.
function looksProse(text) {
  const t = text.trim();
  const ns = t.replace(/\s/g, "");
  if (ns.length < 16 || !/\s/.test(t)) return false;
  const digits = (ns.match(/\d/g) || []).length;
  const letters = (ns.match(/[A-Za-zÀ-ɏͰ-Ͽ가-힣]/g) || []).length;
  if (digits / ns.length >= 0.2 || letters / ns.length <= 0.6) return false;
  return PROSE_FUNC_RE.test(t) || /[가-힣]/.test(t);
}

// 문장(본문)의 기능어 개수. 기관명("Institute of Technology")은 보통 'of' 하나뿐이고
// 본문 문장은 여러 개(we/the/on/in/is…)라 소속 라인과 본문 문장을 가른다.
const FUNC_WORD_RE =
  /\b(?:the|of|and|to|in|is|are|was|were|with|for|as|that|by|on|we|our|from|be|this|these|at|has|have|which|can|will|it|its)\b/gi;
function funcWordCount(text) {
  const m = text.match(FUNC_WORD_RE);
  return m ? m.length : 0;
}

// display(블록) 수식 라인인가: 비-산문(기능어 0개)·비한글이면서 관계연산자를 포함하고 수식
// 구조 글리프 밀도가 임계 이상. '(N)'으로 끝나지 않는 멀티라인 수식의 분자/분모 줄(예:
// 'Δ(k)=[P_T(k)−P_S(k)]/P_T(k)', '= [∑_{p∈Pk}(I[T(p)=y*p]−I[S(p)=y*p])]')까지 잡는다.
// funcWordCount===0 게이트가 산문(괄호·인라인 수식 든 본문 문장)을 먼저 배제하므로 본문 보존.
function isDisplayMathLine(trimmed, len) {
  if (funcWordCount(trimmed) !== 0) return false; // 산문 보호(최우선).
  if (/[가-힣]/.test(trimmed)) return false; // 한국어 본문 보호.
  if (len < 3) return false; // 너무 짧은 토큰은 기존 규칙이 처리.
  if (!RELATION_OP_RE.test(trimmed)) return false; // 관계연산자 필수.
  const glyphs = (trimmed.match(MATH_STRUCT_GLOBAL_RE) || []).length;
  return len > 0 && glyphs / len >= DISPLAY_MATH_DENSITY;
}

// 위첨자 마커(1,*,†,‡,§,¶)로 시작하는 저자 소속 라인.
const SUPERSCRIPT_AFFIL_RE = /^[\d*†‡§¶]+\s*[A-Z][a-z]/;
// 기관 신호 어휘(저자 소속 블록). 본문 오제거를 막기 위해 짧고 비-산문인 라인에만 적용한다.
const INSTITUTION_RE =
  /\b(?:University|Universit[àáéè]|Institute|Laborator(?:y|ies)|Department|College|School\s+of|Inc\.|Ltd\.|GmbH|Corporation|Research\s+(?:Lab|Center|Institute))\b/;

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
// hasEOL이 누락돼 헤더/캡션이 본문과 한 라인으로 join될 때, 세로 위치(normTop) 점프가
// 이 값보다 크면 강제로 라인을 분리한다(줄 간격 ~0.013, 헤더→본문 점프 ~0.029 기준).
const LINE_BREAK_GAP = 0.022;

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
    // hasEOL 누락으로 헤더/캡션이 본문과 한 라인에 묶이는 경우, 세로 위치 점프로 분리한다.
    // offset 불변식은 유지된다(cursor는 분리와 무관하게 입력 순서대로 전진).
    if (cur.length > 0 && Math.abs(it.normTop - cur[cur.length - 1].normTop) > LINE_BREAK_GAP) {
      flush();
    }
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
  // Algorithm/Listing 캡션 직후 의사코드 블록(번호 스텝·Require/Ensure)을 본문 재개 전까지 제거.
  let algorithmMode = false;

  // 1페이지 front-matter 밴드: 제목(최대 폰트)만 남기고 저자·소속·이메일·링크·*Equal
  // contribution 등을 제거한다. 초록 헤딩이 있으면 그 직전까지가 밴드. 초록 헤딩이 없으면
  // Zotero식 폰트 구조 폴백 — 제목(선두 최대 폰트) 다음의 비-본문 라인을 본문(모달 폰트 산문)이
  // 시작되기 전까지 제외한다. 제목 뒤에 저자/소속 블록이 실재할 때만 밴드를 적용(과잉 제거 방지).
  let frontMatterEnd = -1; // [0, frontMatterEnd) = front-matter 밴드(제목만 보존)
  let titleHeight = 0;
  if (opts.firstPage) {
    const abstractIdx = lines.findIndex(
      (l) => ABSTRACT_RE.test(l.text.trim()) && nonSpaceLen(l.text.trim()) < 30,
    );
    const scanEnd = abstractIdx > 0 ? abstractIdx : Math.min(lines.length, 12);
    for (let i = 0; i < scanEnd; i++) titleHeight = Math.max(titleHeight, lines[i].medianHeight);
    if (abstractIdx > 0) {
      frontMatterEnd = abstractIdx;
    } else if (titleHeight > 0) {
      let i = 0;
      while (i < scanEnd && lines[i].medianHeight >= titleHeight * 0.95) i++; // 제목 블록 건너뜀
      let end = i;
      while (end < scanEnd) {
        const t = lines[end].text.trim();
        if (t === "") {
          end++;
          continue;
        }
        const modalFont = modal === 0 || lines[end].medianHeight >= modal * 0.85;
        // 본문 시작(모달 폰트 산문)·섹션 헤딩·초록 헤딩을 만나면 밴드 종료.
        if ((modalFont && looksProse(t)) || FIG_HEADING_RE.test(t) || ABSTRACT_RE.test(t)) break;
        end++;
      }
      if (end > i) frontMatterEnd = end; // 제목 뒤 저자/소속 블록이 있을 때만 밴드 적용.
    }
  }

  let bodyText = "";
  /** @type {import("./bodyFilter").BodySegment[]} */
  const segments = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.text.trim();
    const len = nonSpaceLen(trimmed);

    // front-matter 밴드: 제목 라인만 유지, 저자·소속·링크 등은 drop.
    if (frontMatterEnd > 0 && idx < frontMatterEnd) {
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

    // 의사코드 블록(Algorithm/Listing 캡션 이후): 번호 스텝·Require/Ensure·빈줄·수치 라인,
    // 그리고 스텝이 wrap된 줄(수학 기호 2개+)을 본문 산문 복귀 전까지 제거. 본문 폰트라
    // 작은폰트 규칙엔 안 걸리고, 산문(수학 기호 거의 없음) 라인을 만나면 해제한다.
    if (algorithmMode && !refReached) {
      const symbolCount = (trimmed.match(MATH_SYMBOL_GLOBAL_RE) || []).length;
      // 다음 라인이 다시 의사코드 스텝이면 현재 라인은 스텝의 wrap(둘째 줄)로 보고 유지한다
      // (예: 'Require:' 라인이 'SigLIP(·), Threshold τ ...'로 wrap된 경우).
      const next = lines[idx + 1];
      const nextPseudo = next != null && PSEUDOCODE_RE.test(next.text.trim());
      if (
        trimmed === "" ||
        PSEUDOCODE_RE.test(trimmed) ||
        NUMERIC_LINE_RE.test(trimmed) ||
        symbolCount >= 2 ||
        nextPseudo
      ) {
        continue;
      }
      algorithmMode = false; // 수학 기호 없는 산문 라인(+다음도 산문) → 본문 재개.
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
        if (/^(?:algorithm|listing)\b/i.test(trimmed)) {
          algorithmMode = true; // 의사코드 블록 시작.
        } else if (modal > 0 && line.medianHeight > 0 && line.medianHeight < modal * 0.9) {
          // 캡션이 본문보다 작은 폰트면 연속 줄도 제거(멀티라인 캡션).
          captionMode = true;
        }
      } else if (REF_HEADING_RE.test(trimmed) || CHECKLIST_HEADING_RE.test(trimmed)) {
        // 단독 References/Bibliography/Checklist 헤딩 이후 본문 제거.
        refReached = true;
        drop = true;
      } else if (AFFILIATION_RE.test(trimmed)) {
        drop = true; // 저자 소속·연락처 블록(front-matter 밴드 밖에 오는 경우).
      } else if (
        opts.firstPage &&
        len < 80 &&
        funcWordCount(trimmed) <= 1 &&
        !/[.!?]["')\]]?\s*$/.test(trimmed) &&
        (SUPERSCRIPT_AFFIL_RE.test(trimmed) || INSTITUTION_RE.test(trimmed))
      ) {
        // 1페이지의 대학/연구소/위첨자 마커 소속 라인(초록 뒤 각주형 등). 명사구(기능어 ≤1·
        // 마침표 없음)만 제거 → 본문 문장("We evaluate at the University of ….")은 보존.
        drop = true;
      } else if (STAMP_RE.test(trimmed) && len < 40) {
        drop = true; // Preprint/Under review 등 투고 스탬프.
      } else if (EQUATION_NUM_RE.test(trimmed) && MATH_SYMBOL_RE.test(trimmed)) {
        drop = true; // 수식번호로 끝나는 display 수식 라인(본문 문장은 '(N)'으로 끝나지 않음).
      } else if (isDisplayMathLine(trimmed, len)) {
        drop = true; // '(N)'으로 안 끝나는 멀티라인 display 수식의 분자/분모 줄 등(밀도 판정).
      } else if (NUMERIC_LINE_RE.test(trimmed)) {
        drop = true; // 표 셀·수치 라인.
      } else if (len < 3) {
        drop = true; // 단독 짧은 토큰.
      } else if (line.mathRatio > 0.6 && (len < 40 || funcWordCount(trimmed) === 0)) {
        drop = true; // 수식 폰트(cmmi/cmsy) 우세 라인. 길어도 기능어 0이면 산문 아님 → drop.
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
// References 헤딩 이후(refs 모드)에서만 호출하므로 본문 인용 페이지와 섞이지 않는다. 학회
// 양식별 편차가 커(번호식 0.5~0.7, 이니셜식·wrap 많은 양식은 0.1~0.3까지 출렁) 임계를 0.10으로
// 둔다 — 실측상 연속 서지 페이지가 0.12~0.14로 내려가는 경우가 있어 0.15는 중간에 본문으로
// 오이탈(참고문헌 누출)했다. 진짜 부록은 서지 신호가 0에 수렴해 자연히 본문으로 복귀한다.
// 헤딩 직후 첫 페이지는 강제 refs로 보장한다(아래 scan 참조).
const BIB_PAGE_RATIO = 0.1;
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
  let justEntered = false; // References 헤딩 직후 첫 페이지인가(양식 무관 강제 refs).
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
      else if (hasHeading(lines, modal, REF_HEADING_RE)) {
        mode = "refs";
        justEntered = true;
      }
    } else {
      // refs: 헤딩 다음 페이지들. 헤딩 직후 첫 페이지는 강제로, 이후는 서지 시그니처가
      // 임계 이상인 동안 비본문 유지. 산문(Appendix)으로 떨어지면 본문 재개.
      if (hasHeading(lines, modal, CHECKLIST_HEADING_RE)) {
        out.push(false);
        mode = "tail";
      } else if (justEntered || isBibliographyPage(lines)) {
        out.push(true);
        justEntered = false;
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

// 문장 종결(. ! ?) 위치 이후를 '미완 꼬리'로 분리. 페이지 끝에서 다음 페이지로 이어지는 문장 처리.
// headLen: 마지막 종결까지 길이(미완 제외). tail: 종결 이후 미완 조각(trim). 종결이 없으면 전체가 미완.
export function trailingIncomplete(text) {
  const re = /[.!?]["')\]]?(?=\s|$)/g;
  let last = -1;
  let m;
  while ((m = re.exec(text))) last = m.index + m[0].length;
  if (last < 0) return { headLen: 0, tail: text.trim() };
  return { headLen: last, tail: text.slice(last).trim() };
}

/**
 * cross-page: 페이지 끝에서 끊긴 문장을 그 페이지 번역에서 제외하고, 다음 페이지 본문 앞에
 * 이전 페이지의 미완 꼬리(prevText 기준)를 붙여 완성된 문장으로 해석한다.
 * prevTail은 이전 페이지 원문이라 현재 페이지 segments에 매핑이 없어, 그 첫(이어진) 문장만
 * 교차 하이라이트가 비활성된다(나머지 문장은 정상). offset 불변식은 head 구간 segment의
 * bodyStart/bodyEnd를 prevTail 길이만큼 평행이동해 보존한다.
 * @param {string} prevText 이전 페이지 raw 본문(없으면 "").
 * @param {{ text: string, segments: import("./bodyFilter").BodySegment[] }} raw 현재 페이지 raw.
 * @param {boolean} isLast 마지막 페이지면 자기 끝 문장도 유지(이어질 다음 페이지 없음).
 * @returns {{ text: string, segments: import("./bodyFilter").BodySegment[] }}
 */
export function carryAcrossPages(prevText, raw, isLast) {
  let prevTail = "";
  if (prevText) {
    const t = trailingIncomplete(prevText);
    if (t.tail) prevTail = `${t.tail} `;
  }
  const headLen = isLast ? raw.text.length : trailingIncomplete(raw.text).headLen;
  const offset = prevTail.length;
  const segments = [];
  for (const s of raw.segments) {
    if (s.bodyStart >= headLen) continue; // 미완 꼬리(다음 페이지로 carry)는 제외.
    const bEnd = Math.min(s.bodyEnd, headLen);
    segments.push({
      bodyStart: s.bodyStart + offset,
      bodyEnd: bEnd + offset,
      globalStart: s.globalStart,
      globalEnd: s.globalEnd - (s.bodyEnd - bEnd),
    });
  }
  return { text: prevTail + raw.text.slice(0, headLen), segments };
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
  const raw = m[1];
  const word = raw.toLowerCase();
  // 표(KR)·表(CJK)는 table, 그 외 그림/图/図/figure/scheme/chart/… 는 figure.
  const isTable = word.startsWith("tab") || raw === "표" || raw === "表";
  const kind = isTable ? "table" : "figure";
  let head;
  if (raw === "그림" || raw === "표" || raw === "图" || raw === "表" || raw === "図") {
    head = raw; // CJK 머리말은 원형 유지.
  } else if (word.startsWith("fig")) {
    head = "Figure";
  } else if (isTable) {
    head = "Table";
  } else {
    head = raw.charAt(0).toUpperCase() + word.slice(1); // Scheme/Chart/Plate/Box/Exhibit.
  }
  return { kind, label: `${head} ${m[2]}` };
}

// 캡션 기준 "본문 보존형" Figure/Table 제외 밴드(정규화 0..1 세로 구간) 계산.
//
// 고정 밴드(예: 0.42)는 도표보다 넓어 인접 본문·섹션 헤딩·제목까지 inFigure로 삼켜 번역에서
// 누락시킨다(본문 과잉제거). 대신 캡션 양옆을 스캔해 **도표 콘텐츠**(표 행·도표 라벨 등 비-본문
// 라인)가 인접한 쪽만, 그 콘텐츠가 끝나고 **본문이 재개되는 경계**까지만 제외한다. kind(figure/
// table) 관례에 의존하지 않고 실제 콘텐츠 위치로 판정한다(표 캡션이 표 위/아래 어디든 대응).
//
// 본문 경계 = 헤딩(단독이라도) 또는 인접 본문이 이어지는 산문. 도표 사이에 낀 고립 산문 한 줄
// (캡션 연속줄·표 부제)로는 멈추지 않아 도표 전체를 계속 제외한다. 양쪽 다 콘텐츠면 union,
// 양쪽 다 본문이면(인라인 'Figure N shows ...' 오탐 캡션) 아무것도 제외하지 않는다(h=0).
//
// 이 region은 inFigure(번역 제외) 판정 전용 — crop(비전 설명 입력)용 generous region과 분리한다.
// 보수성: 본문 오삭제 > 도표 라벨 통과. 경계가 애매하면 더 작게(본문 보존) 기운다.
//
// @param {{top:number,bot:number,x0:number,x1:number,text:string}[]} lines 페이지 전체 라인(정규화)
// @param {{top:number,bot:number}} cap 캡션 라인 박스(정규화, top<bot)
// @param {{x0:number,x1:number}} col 밴드 가로 컬럼(정규화)
// @param {"figure"|"table"} kind 현재 미사용(콘텐츠 위치로 판정). 시그니처 호환 위해 유지.
// @param {{maxBand?:number, minBodyLen?:number}} [opts]
// @returns {{ y:number, h:number }} 정규화 제외 구간(h<=0이면 제외 없음)
export function figureExclusionBand(lines, cap, col, kind, opts = {}) {
  const maxBand = opts.maxBand != null ? opts.maxBand : 0.42;
  const minBodyLen = opts.minBodyLen != null ? opts.minBodyLen : 50;
  // 인접 본문(연속 단락)으로 볼 최대 세로 간격(정규화). 본문 줄 간격(~0.013)보다 넉넉히 크고
  // 도표↔본문 사이 큰 공백보다 작다.
  const ADJ_GAP = 0.028;
  const cx0 = col.x0;
  const cx1 = col.x1;
  // 캡션과 같은 컬럼(가로 겹침)의 라인만 본문 경계 후보로 본다(반대 컬럼 본문 보호와 무관).
  // 캡션 라인 자체는 제외한다 — 캡션 텍스트가 산문이라, 바로 인접한 본문/표 라인이 캡션을
  // '연속 본문' 이웃으로 오인해 밴드를 조기 정지(도표 누출)시키는 것을 막는다.
  const seq = (lines || [])
    .filter((l) => {
      if (!(l.x1 > cx0 + 1e-6 && l.x0 < cx1 - 1e-6)) return false;
      const mid = (l.top + l.bot) / 2;
      return !(mid >= cap.top - 1e-3 && mid <= cap.bot + 1e-3);
    })
    .sort((a, b) => a.top - b.top);
  // 산문 = 긴 데 글자 위주·숫자 적음. 표 행(숫자 위주)·도표 라벨(짧음)은 산문이 아니다.
  // "길다고 본문이 아니다(넓은 표 행도 길다)" → digit/alpha 비율로 산문만 인정.
  const isProse = (t) => {
    const ns = t.replace(/\s/g, "");
    if (ns.length < minBodyLen) return false;
    const digits = (ns.match(/\d/g) || []).length;
    const letters = (ns.match(/[A-Za-zÀ-ɏͰ-Ͽ가-힣]/g) || []).length;
    return digits / ns.length < 0.2 && letters / ns.length > 0.6;
  };
  // 짧아도 본문인 줄(2단/좁은 컬럼의 wrap된 산문)을 잡는 보조 신호. 영어 기능어가 한 개라도
  // 있거나 한글이 섞이면 산문으로 본다 — 표 헤더·도표 라벨(기능어 없는 명사 나열)과 구분.
  const FUNC_RE =
    /\b(?:the|of|and|to|in|is|are|with|for|as|that|by|on|we|this|our|from|be|an|or|which|can|it|its|their|these|a)\b/i;
  const isProseLine = (t) => {
    if (isProse(t)) return true;
    const ns = t.replace(/\s/g, "");
    if (ns.length < 16 || !/\s/.test(t.trim())) return false;
    const digits = (ns.match(/\d/g) || []).length;
    const letters = (ns.match(/[A-Za-zÀ-ɏͰ-Ͽ가-힣]/g) || []).length;
    if (digits / ns.length >= 0.2 || letters / ns.length <= 0.6) return false;
    return FUNC_RE.test(t) || /[가-힣]/.test(t);
  };
  const prose = seq.map((l) => isProseLine((l.text || "").trim()));
  const head = seq.map((l) => FIG_HEADING_RE.test((l.text || "").trim()));
  // 밴드 정지(본문 경계) 라인:
  //  - 헤딩: 단독이라도 정지(섹션 헤딩·제목은 짧고 고립돼도 본문이므로 보존).
  //  - 산문: 인접(<ADJ_GAP)한 산문/헤딩 이웃이 있는 "연속 본문"일 때만 정지. 도표·표 사이에
  //    낀 고립 산문 한 줄로는 정지하지 않아(이웃이 표 행) 도표 전체를 계속 제외한다.
  const stops = seq.map((l, i) => {
    if (head[i]) return true;
    if (!prose[i]) return false;
    const up =
      i > 0 && seq[i].top - seq[i - 1].bot < ADJ_GAP && (prose[i - 1] || head[i - 1]);
    const dn =
      i < seq.length - 1 &&
      seq[i + 1].top - seq[i].bot < ADJ_GAP &&
      (prose[i + 1] || head[i + 1]);
    return up || dn;
  });

  // 도표 콘텐츠 라인 = 비어있지 않은 비-산문(표 행·도표 라벨·축 숫자). 고립 산문(각주 사이
  // 본문 한 줄·캡션 연속줄)은 콘텐츠로 치지 않는다 — 그래야 그림 아래로 본문이 이어지는
  // 경우(초록이 그림을 감싸는 1페이지 등)에 그 본문을 도표로 오인해 제외하지 않는다.
  const isContent = (i) => !stops[i] && (seq[i].text || "").trim() !== "" && !prose[i];

  // 캡션 연속줄(다줄 캡션)로 건너뛸 산문 최대 줄수. 캡션 설명문은 길어야 3~4줄이고 본문 단락은
  // 더 길어, 콘텐츠 없이 이만큼 넘게 산문이 이어지면 캡션이 아니라 본문으로 본다(본문 보호).
  const MAX_CONT = 4;

  // 한 방향 스캔: dir=-1(캡션 위) / +1(캡션 아래). 캡션 가장자리에서 maxBand 한도까지 가며
  // 도표 콘텐츠가 끝나고 본문이 재개되는 지점까지를 밴드로 잡는다. content=도표 콘텐츠를 만났는지.
  //  - 헤딩: 항상 정지(섹션 경계 = 본문).
  //  - 콘텐츠를 본 뒤의 연속 본문(산문): 정지(본문 재개).
  //  - 콘텐츠 전 산문: 캡션 연속줄로 보고 건너뛰되, MAX_CONT줄을 넘기면 본문으로 보고 정지
  //    (그쪽에 표가 없다는 뜻 → content=false로 그 방향은 제외하지 않는다).
  const scan = (dir) => {
    const limit = dir < 0 ? Math.max(0, cap.top - maxBand) : Math.min(1, cap.bot + maxBand);
    const idx = [];
    for (let i = 0; i < seq.length; i++) {
      if (dir < 0) {
        if (seq[i].bot < cap.top + 1e-6 && seq[i].bot > limit - 1e-6) idx.push(i);
      } else if (seq[i].top > cap.bot - 1e-6 && seq[i].top < limit + 1e-6) idx.push(i);
    }
    // 캡션에 가까운 라인부터.
    idx.sort((a, b) => (dir < 0 ? seq[b].bot - seq[a].bot : seq[a].top - seq[b].top));
    const edgeOf = (i) => (dir < 0 ? seq[i].bot : seq[i].top);
    let edge = limit;
    let content = false;
    let proseRun = 0; // 콘텐츠 전 연속 산문 줄수(캡션 연속줄 추정).
    for (const i of idx) {
      if (head[i]) {
        edge = edgeOf(i);
        break;
      }
      if (isContent(i)) {
        content = true;
        proseRun = 0;
        continue;
      }
      if (prose[i] || stops[i]) {
        if (content) {
          if (stops[i]) {
            edge = edgeOf(i); // 콘텐츠 뒤 연속 본문 → 도표 끝.
            break;
          }
          continue; // 콘텐츠 뒤 고립 산문(말단 라벨 등) → 건너뜀.
        }
        proseRun += 1;
        if (proseRun > MAX_CONT) {
          edge = edgeOf(i); // 콘텐츠 전 산문이 너무 길다 → 본문(캡션 연속줄 아님).
          break;
        }
        continue; // 캡션 연속줄로 보고 건너뜀.
      }
      // 빈 줄 등 → 건너뜀.
    }
    return dir < 0 ? { lo: edge, hi: cap.top, content } : { lo: cap.bot, hi: edge, content };
  };

  const up = scan(-1);
  // 그림은 캡션이 도표 아래라는 관례가 강해 위쪽만 본다(아래로 이어지는 본문 보호). 표는
  // 캡션이 표 위/아래 어디든 올 수 있어 양방향 — 콘텐츠(표 행) 있는 쪽만 제외한다.
  const dn = kind === "table" ? scan(1) : { lo: cap.bot, hi: cap.bot, content: false };
  let lo;
  let hi;
  if (up.content && dn.content) {
    lo = up.lo;
    hi = dn.hi; // 캡션이 표 사이에 낀 경우(표 위·아래 모두 데이터): 양쪽 모두 제외.
  } else if (up.content) {
    lo = up.lo;
    hi = cap.top;
  } else if (dn.content) {
    lo = cap.bot;
    hi = dn.hi;
  } else {
    return { y: cap.top, h: 0 }; // 양쪽 다 본문(인라인 캡션 오탐·텍스트 없는 그림) → 제외 없음.
  }
  return { y: lo, h: Math.max(0, hi - lo) };
}
