import * as pdfjsLib from "/pdfjs/pdf.min.mjs";
import {
  extractBody,
  mapBodyRange,
  parseCaptionLabel,
  scanReferenceActivation,
  scanRunningFurniture,
} from "/pdfjs/bodyFilter.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

const HOST_SOURCE = "paperlight-pdf-host";
const IFRAME_SOURCE = "paperlight-pdf-iframe";

const container = document.getElementById("pages");
const empty = document.getElementById("empty");

let currentDoc = null;
let currentUrl = null;
let currentScale = 1.25;
let pageWrappers = [];
let pageObjects = [];
let pageSegments = []; // 페이지별 body↔원문 offset 매핑(REQUEST_PAGE_TEXT 시 채움).
let docFiltersPromise = null; // 문서 수준 필터(References/Checklist 구간 + 러닝 furniture), 1회 계산.
let pageFigureAnchors = []; // 페이지별 [{ kind, label, captionText, region }] (Figure/Table 설명 앵커).
let translationCols = []; // 페이지별 번역 컬럼 element.
let translationSentences = []; // 페이지별 [{ i, el, globalStart, globalEnd }] (교차 하이라이트용).
let visibilityObserver = null;
let savedHighlights = [];
let searchMatches = []; // [{ page, startOffset, endOffset }] — 페이지 내 검색 일치.
let searchCurrent = -1; // 현재 강조 중인 일치 인덱스(0-based, 없으면 -1).

const HL_COLORS = {
  yellow: "rgba(255, 224, 102, 0.5)",
  blue: "rgba(125, 176, 255, 0.45)",
  green: "rgba(140, 222, 160, 0.45)",
  red: "rgba(255, 145, 145, 0.45)",
};

function hlBackground(color) {
  if (!color) return HL_COLORS.yellow;
  return HL_COLORS[color] || color;
}

// S14: highlight overlay styles (injected once).
const hlStyle = document.createElement("style");
hlStyle.textContent =
  ".highlight-overlay{position:absolute;pointer-events:auto;cursor:pointer;" +
  "mix-blend-mode:multiply;border-radius:2px;}" +
  // 원문↔해석 교차 하이라이트(연회색 transient).
  ".linked-overlay{position:absolute;pointer-events:none;" +
  "background:rgba(0,0,0,0.10);border-radius:2px;}" +
  // Figure/Table 인라인 설명 버튼(캡션 위치 앵커).
  ".figure-explain-btn{position:absolute;transform:translateY(-115%);z-index:5;" +
  "display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:6px;" +
  "border:1px solid rgba(0,0,0,0.12);background:rgba(255,255,255,0.92);" +
  "color:#374151;font:600 11px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer;" +
  "box-shadow:0 1px 3px rgba(0,0,0,0.12);opacity:0.55;transition:opacity .12s;}" +
  ".figure-explain-btn:hover{opacity:1;background:#fff;border-color:rgba(0,0,0,0.22);}" +
  // 페이지 내 검색 일치 표시(현재 일치는 주황 강조).
  ".search-hit{position:absolute;pointer-events:none;mix-blend-mode:multiply;" +
  "background:rgba(255,213,79,0.55);border-radius:1px;}" +
  ".search-hit--active{background:rgba(255,138,0,0.7);}";
document.head.appendChild(hlStyle);

// 해석 패널이 열렸을 때만 문장 hover 리포팅 활성화.
let hoverEnabled = false;

function send(type, payload = {}) {
  parent.postMessage({ source: IFRAME_SOURCE, type, ...payload }, "*");
}

// ── TOC(outline) ────────────────────────────────────────────────────────────
const SECTION_TITLES = [
  "Abstract", "Introduction", "Background", "Related Work", "Method", "Methods",
  "Methodology", "Approach", "Experiments", "Results", "Evaluation", "Discussion",
  "Conclusion", "Conclusions", "References", "Appendix",
];

async function destToPage(dest) {
  try {
    let explicit = dest;
    if (typeof dest === "string") explicit = await currentDoc.getDestination(dest);
    if (!Array.isArray(explicit) || !explicit[0]) return null;
    const pageIndex = await currentDoc.getPageIndex(explicit[0]);
    return pageIndex + 1;
  } catch (_) {
    return null;
  }
}

// 본문에서 대표 섹션 제목을 찾는 휴리스틱(내장 outline이 없을 때 폴백).
// Title Case 대소문자 구분으로 prose 내 소문자 단어와의 오탐을 줄인다.
function heuristicOutline() {
  const seen = new Set();
  const items = [];
  for (let i = 0; i < pageWrappers.length; i++) {
    const layer = pageWrappers[i] ? pageWrappers[i].querySelector(".text-layer") : null;
    const text = layer ? layer.textContent || "" : "";
    if (!text) continue;
    for (const title of SECTION_TITLES) {
      if (seen.has(title)) continue;
      const re = new RegExp("(?:^|[^A-Za-z])((?:\\d+(?:\\.\\d+)*\\s+)?" + title + ")(?![A-Za-z])");
      const m = text.match(re);
      if (m) {
        seen.add(title);
        items.push({ title: m[1].trim(), page: i + 1, level: 0 });
      }
    }
  }
  items.sort((a, b) => a.page - b.page || a.title.localeCompare(b.title));
  return items;
}

// 섹션 번호 토큰: 1 / 2.1 / C.3.1 / A / E.1 (각 구성요소 1~2자리 → 본문 숫자열 오인 방지)
const SECTION_NUM_ONLY = /^(?:\d{1,2}|[A-Z])(?:\.\d{1,2}){0,3}$/;
const SECTION_NUM_LEAD = /^((?:\d{1,2}|[A-Z])(?:\.\d{1,2}){0,3})[.\s]+(.*)$/;

// arXiv(hyperref) 내장 outline 제목엔 섹션 번호가 빠져 있고 번호는 본문에만 렌더된다.
// 목적지 페이지 text-layer의 span을 순회해, 선두 번호를 떼면 제목으로 시작하는
// 헤딩 span을 찾아 그 번호 토큰만 복원한다(평탄 textContent의 span 혼입 방지).
function sectionNumberPrefix(title, pageIndex) {
  const t = (title || "").trim();
  if (!t || /^\d/.test(t)) return ""; // 이미 번호로 시작하면 스킵(중복 방지)
  const layer = pageWrappers[pageIndex]
    ? pageWrappers[pageIndex].querySelector(".text-layer")
    : null;
  if (!layer) return "";
  const titleWords = t.toLowerCase().split(/\s+/);
  // span 텍스트가 제목 첫 단어들(최대 3개)로 시작하는지 — 겹치는 만큼 모두 일치해야 함.
  const startsTitle = (s) => {
    const w = (s || "").replace(/\s+/g, " ").trim().toLowerCase().split(/\s+/);
    if (!w[0]) return false;
    const n = Math.min(3, titleWords.length, w.length);
    for (let k = 0; k < n; k++) if (w[k] !== titleWords[k]) return false;
    return true;
  };
  const spans = layer.querySelectorAll("span");
  for (let i = 0; i < spans.length; i++) {
    const raw = (spans[i].textContent || "").replace(/\s+/g, " ").trim();
    // (a) 한 span에 "번호 + 제목"
    const m = raw.match(SECTION_NUM_LEAD);
    if (m && startsTitle(m[2])) return m[1];
    // (b) 번호만 있는 span: pdf.js는 [번호][공백][제목]을 별개 span으로 쪼개므로
    //     공백/빈 span을 건너뛰고 첫 비공백 span이 제목으로 시작하면 채택.
    if (SECTION_NUM_ONLY.test(raw)) {
      for (let j = i + 1; j < spans.length && j <= i + 4; j++) {
        const nx = (spans[j].textContent || "").replace(/\s+/g, " ").trim();
        if (!nx) continue; // 공백 전용 span 스킵
        if (startsTitle(nx)) return raw;
        break; // 첫 비공백 span이 제목이 아니면 중단(오접두 방지)
      }
    }
  }
  return "";
}

async function buildOutline() {
  if (!currentDoc) return [];
  let outline = null;
  try {
    outline = await currentDoc.getOutline();
  } catch (_) {
    outline = null;
  }
  if (outline && outline.length) {
    const items = [];
    const walk = async (nodes, level) => {
      for (const node of nodes) {
        const page = await destToPage(node.dest);
        const title = (node.title || "").trim();
        if (page && title) {
          const prefix = sectionNumberPrefix(title, page - 1);
          items.push({ title: prefix ? prefix + " " + title : title, page, level });
        }
        if (node.items && node.items.length) await walk(node.items, level + 1);
      }
    };
    await walk(outline, 0);
    if (items.length) return items;
  }
  return heuristicOutline();
}

// 페이지별 작은 썸네일을 순차로 렌더해 증분 전송.
async function sendThumbnails() {
  if (!currentDoc) return;
  const targetW = 140;
  for (let i = 0; i < pageObjects.length; i++) {
    const page = pageObjects[i];
    if (!page) continue;
    try {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: targetW / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      send("THUMBNAIL", { page: i + 1, dataUrl: canvas.toDataURL("image/jpeg", 0.7) });
    } catch (_) {
      // 동시 렌더 충돌 등은 건너뜀.
    }
    await new Promise((r) => setTimeout(r, 0)); // 양보
  }
}

function renderHighlightsForPage(pageNum) {
  const wrapper = pageWrappers[pageNum - 1];
  if (!wrapper) return;
  for (const h of savedHighlights) {
    if (h.page !== pageNum) continue;
    for (const r of h.rects || []) {
      const div = document.createElement("div");
      div.className = "highlight-overlay";
      div.dataset.hlId = h.id;
      div.style.left = r.x * 100 + "%";
      div.style.top = r.y * 100 + "%";
      div.style.width = r.w * 100 + "%";
      div.style.height = r.h * 100 + "%";
      div.style.background = hlBackground(h.color);
      div.addEventListener("click", () => send("HIGHLIGHT_CLICK", { id: h.id }));
      wrapper.appendChild(div);
    }
  }
}

function renderAllHighlights() {
  for (const el of container.querySelectorAll(".highlight-overlay")) el.remove();
  for (let i = 1; i <= pageWrappers.length; i++) renderHighlightsForPage(i);
}

// ── 페이지 내 검색 ────────────────────────────────────────────────────────────
function clearSearch() {
  for (const el of container.querySelectorAll(".search-hit")) el.remove();
  searchMatches = [];
  searchCurrent = -1;
}

// text-layer.textContent 에서 대소문자 무시 부분일치를 페이지 순서대로 수집.
function runSearch(query) {
  clearSearch();
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    send("FIND_RESULT", { matchCount: 0, current: 0 });
    return;
  }
  for (let i = 0; i < pageWrappers.length; i++) {
    const wrapper = pageWrappers[i];
    const layer = wrapper ? wrapper.querySelector(".text-layer") : null;
    const text = (layer ? layer.textContent || "" : "").toLowerCase();
    if (!text) continue;
    let from = 0;
    let idx;
    while ((idx = text.indexOf(q, from)) >= 0) {
      searchMatches.push({ page: i + 1, startOffset: idx, endOffset: idx + q.length });
      from = idx + q.length;
    }
  }
  renderSearchHits();
  if (searchMatches.length > 0) {
    searchCurrent = 0;
    focusMatch(0);
  }
  send("FIND_RESULT", {
    matchCount: searchMatches.length,
    current: searchMatches.length > 0 ? 1 : 0,
  });
}

// 일치 구간을 Range → getClientRects 로 변환해 wrapper 에 % 오버레이로 배치(줌 무관).
function renderSearchHits() {
  for (const el of container.querySelectorAll(".search-hit")) el.remove();
  for (let m = 0; m < searchMatches.length; m++) {
    const match = searchMatches[m];
    const wrapper = pageWrappers[match.page - 1];
    const layer = wrapper ? wrapper.querySelector(".text-layer") : null;
    if (!layer) continue;
    const startPos = locateOffset(layer, match.startOffset);
    const endPos = locateOffset(layer, match.endOffset);
    if (!startPos || !endPos) continue;
    const range = document.createRange();
    try {
      range.setStart(startPos.node, startPos.local);
      range.setEnd(endPos.node, endPos.local);
    } catch (_) {
      continue;
    }
    const wr = wrapper.getBoundingClientRect();
    for (const r of range.getClientRects()) {
      if (r.width <= 0 || r.height <= 0) continue;
      const div = document.createElement("div");
      div.className = "search-hit" + (m === searchCurrent ? " search-hit--active" : "");
      div.dataset.matchIdx = String(m);
      div.style.left = ((r.left - wr.left) / wr.width) * 100 + "%";
      div.style.top = ((r.top - wr.top) / wr.height) * 100 + "%";
      div.style.width = (r.width / wr.width) * 100 + "%";
      div.style.height = (r.height / wr.height) * 100 + "%";
      wrapper.appendChild(div);
    }
  }
}

function focusMatch(idx) {
  for (const el of container.querySelectorAll(".search-hit")) {
    el.classList.toggle("search-hit--active", Number(el.dataset.matchIdx) === idx);
  }
  const el = container.querySelector('.search-hit[data-match-idx="' + idx + '"]');
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function stepSearch(dir) {
  if (searchMatches.length === 0) return;
  searchCurrent = (searchCurrent + dir + searchMatches.length) % searchMatches.length;
  focusMatch(searchCurrent);
  send("FIND_RESULT", { matchCount: searchMatches.length, current: searchCurrent + 1 });
}

// ── 원문↔해석 문장 교차 하이라이트 ────────────────────────────────────────────
function clearLinkedOverlays() {
  for (const el of container.querySelectorAll(".linked-overlay")) el.remove();
}

// text-layer 텍스트 노드를 DOM 순서로 누적해 전역 offset → {node, local} 위치 매핑.
function locateOffset(layer, offset) {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    if (offset <= acc + len) return { node, local: offset - acc };
    acc += len;
  }
  return null;
}

// 역방향: text-layer 내 {node, local} → 전역 offset.
function globalOffset(layer, node, local) {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let n;
  while ((n = walker.nextNode())) {
    if (n === node) return acc + local;
    acc += n.nodeValue.length;
  }
  return -1;
}

function highlightSentence(pageNum, startOffset, endOffset) {
  clearLinkedOverlays();
  const wrapper = pageWrappers[(pageNum || 1) - 1];
  const layer = wrapper ? wrapper.querySelector(".text-layer") : null;
  if (!layer) return;
  const startPos = locateOffset(layer, startOffset);
  const endPos = locateOffset(layer, endOffset);
  if (!startPos || !endPos) return;
  const range = document.createRange();
  try {
    range.setStart(startPos.node, startPos.local);
    range.setEnd(endPos.node, endPos.local);
  } catch (_) {
    return;
  }
  const wr = wrapper.getBoundingClientRect();
  for (const r of range.getClientRects()) {
    if (r.width <= 0 || r.height <= 0) continue;
    const div = document.createElement("div");
    div.className = "linked-overlay";
    div.style.left = ((r.left - wr.left) / wr.width) * 100 + "%";
    div.style.top = ((r.top - wr.top) / wr.height) * 100 + "%";
    div.style.width = (r.width / wr.width) * 100 + "%";
    div.style.height = (r.height / wr.height) * 100 + "%";
    wrapper.appendChild(div);
  }
}

// ── 페이지별 번역 컬럼 ───────────────────────────────────────────────────────
// 번역 컬럼 높이를 PDF 페이지 높이로 제한 → 넘치는 번역은 컬럼 내부 스크롤(다음 페이지 안 밂).
function syncTranslationHeight(pageNum, height) {
  const col = translationCols[pageNum - 1];
  if (col) col.style.maxHeight = height + "px";
}

// 번역 컬럼에 인덱스 순서를 유지하며 문장 span 삽입.
function insertSentenceSpan(col, el, idx) {
  let next = null;
  for (const c of col.querySelectorAll(".t-sentence")) {
    if (Number(c.dataset.i) > idx) {
      next = c;
      break;
    }
  }
  col.insertBefore(el, next);
}

// host가 스트리밍으로 보내는 번역 pair를 해당 페이지 컬럼에 증분 반영.
function renderTranslation(pageNum, pairs, replace) {
  const col = translationCols[pageNum - 1];
  if (!col) return;
  const segments = pageSegments[pageNum - 1] || [];
  let store = translationSentences[pageNum - 1];
  if (replace || !store) {
    col.innerHTML = "";
    store = [];
    translationSentences[pageNum - 1] = store;
  } else {
    const ph = col.querySelector(".t-empty");
    if (ph) ph.remove();
  }
  for (const p of pairs || []) {
    let entry = store[p.i];
    if (!entry) {
      const el = document.createElement("span");
      el.className = "t-sentence";
      el.dataset.i = String(p.i);
      const mapped = mapBodyRange(segments, p.bodyStart, p.bodyEnd);
      entry = {
        i: p.i,
        el,
        globalStart: mapped ? mapped.startOffset : -1,
        globalEnd: mapped ? mapped.endOffset : -1,
      };
      store[p.i] = entry;
      el.addEventListener("mouseenter", () => {
        if (entry.globalStart >= 0) highlightSentence(pageNum, entry.globalStart, entry.globalEnd);
      });
      el.addEventListener("mouseleave", () => clearLinkedOverlays());
      insertSentenceSpan(col, el, p.i);
    }
    entry.el.textContent = (p.tgt || "") + " ";
  }
}

function clearTranslation(pageNum) {
  if (pageNum == null) {
    for (const col of translationCols) if (col) col.innerHTML = "";
    translationSentences = [];
    return;
  }
  const col = translationCols[pageNum - 1];
  if (col) col.innerHTML = "";
  translationSentences[pageNum - 1] = null;
}

// PDF 본문 hover → 같은 페이지 번역 컬럼의 대응 문장 강조(전역 offset 범위로 탐색).
function highlightTranslationAt(pageNum, offset) {
  const store = translationSentences[pageNum - 1];
  if (!store) return;
  for (const entry of store) {
    if (!entry) continue;
    const on = offset >= entry.globalStart && offset < entry.globalEnd && entry.globalStart >= 0;
    entry.el.classList.toggle("t-active", on);
  }
}

function clearTranslationActive() {
  for (const store of translationSentences) {
    if (!store) continue;
    for (const entry of store) if (entry && entry.el) entry.el.classList.remove("t-active");
  }
}

// 문서 수준 필터(References/Checklist 구간 + 러닝 헤더/푸터 furniture)를 한 번 계산한다. 모든
// 페이지 텍스트(figRegion 불필요)를 순서대로 모아 scanReferenceActivation/scanRunningFurniture에
// 넘긴다. 페이지가 lazy·임의 순서로 요청돼도 동일 결과를 보장하도록 memoize하고 loadPdf에서 초기화.
async function getDocFilters() {
  if (!docFiltersPromise) docFiltersPromise = computeDocFilters();
  return docFiltersPromise;
}

async function computeDocFilters() {
  if (!currentDoc) return { activation: [], furniture: new Set() };
  const pagesItems = [];
  for (let i = 0; i < pageObjects.length; i++) {
    const page = pageObjects[i];
    if (!page) {
      pagesItems.push([]);
      continue;
    }
    try {
      const tc = await page.getTextContent();
      const vp = page.getViewport({ scale: 1 });
      const pageH = vp.height;
      const styles = tc.styles || {};
      pagesItems.push(
        tc.items.map((it) => {
          const h = it.height || Math.hypot(it.transform[2], it.transform[3]);
          const y = it.transform[5];
          return {
            str: it.str,
            hasEOL: !!it.hasEOL,
            fontHeight: h,
            normTop: pageH > 0 ? (pageH - y) / pageH : 0,
            fontFamily: (styles[it.fontName] && styles[it.fontName].fontFamily) || "",
            inFigure: false,
          };
        }),
      );
    } catch (_) {
      pagesItems.push([]);
    }
  }
  try {
    return {
      activation: scanReferenceActivation(pagesItems),
      furniture: scanRunningFurniture(pagesItems),
    };
  } catch (_) {
    return { activation: [], furniture: new Set() };
  }
}

// 페이지 본문만 추출(Figure 캡션·표·수식·페이지번호 제거) + body↔원문 offset 매핑.
// 가정: items[].str 연결 == text-layer.textContent. 어긋나면 필터 없이 전체 텍스트로 폴백.
async function extractBodyText(pageNum) {
  const wrapper = pageWrappers[pageNum - 1];
  const layer = wrapper ? wrapper.querySelector(".text-layer") : null;
  const fullText = layer ? layer.textContent || "" : "";
  const identity = [
    { bodyStart: 0, bodyEnd: fullText.length, globalStart: 0, globalEnd: fullText.length },
  ];
  const page = pageObjects[pageNum - 1];
  if (!page) return { text: fullText, segments: identity };
  try {
    const tc = await page.getTextContent();
    const joined = tc.items.map((it) => it.str).join("");
    if (joined !== fullText) return { text: fullText, segments: identity };
    const vp = page.getViewport({ scale: 1 });
    const pageH = vp.height;
    const pageW = vp.width;
    const styles = tc.styles || {};
    // Figure/Table 영역(정규화 0..1) 확보: 백엔드 정밀 bbox 우선, 없으면 휴리스틱 폴백.
    let regions = pageFigureAnchors[pageNum - 1];
    if (!regions) regions = await detectFigureAnchors(pageNum);
    const figRegions = (regions || []).map((a) => a.region).filter(Boolean);
    const inAnyRegion = (cx, cy) =>
      figRegions.some(
        (r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h,
      );
    const items = tc.items.map((it) => {
      const h = it.height || Math.hypot(it.transform[2], it.transform[3]);
      const x = it.transform[4];
      const y = it.transform[5];
      const w = it.width || 0;
      const cx = pageW > 0 ? (x + w / 2) / pageW : 0;
      const cy = pageH > 0 ? (pageH - (y + h / 2)) / pageH : 0;
      return {
        str: it.str,
        hasEOL: !!it.hasEOL,
        fontHeight: h,
        normTop: pageH > 0 ? (pageH - y) / pageH : 0,
        fontFamily: (styles[it.fontName] && styles[it.fontName].fontFamily) || "",
        inFigure: figRegions.length > 0 && inAnyRegion(cx, cy),
      };
    });
    const { activation, furniture } = await getDocFilters();
    const refActiveAtStart = !!activation[pageNum - 1];
    const { bodyText, segments, allDropped } = extractBody(items, {
      firstPage: pageNum === 1,
      refActiveAtStart,
      furniture,
    });
    if (!bodyText) {
      // 비공백 입력이 의도적으로 전부 drop됐으면(References/Checklist·전면 Figure 페이지)
      // 빈 본문을 보낸다(host에서 splitSentences=0 → no-op). 추출 실패만 fullText 폴백.
      if (allDropped) return { text: "", segments: [] };
      return { text: fullText, segments: identity };
    }
    return { text: bodyText, segments };
  } catch (_) {
    return { text: fullText, segments: identity };
  }
}

// ── Figure/Table 인라인 설명 앵커 ───────────────────────────────────────────────
// 캡션(Figure N / Table N / 그림 N / 표 N)을 찾아 설명 대상 이미지 영역(region, 정규화
// 0..1)과 버튼 위치를 추정한다. Figure 캡션은 그림 아래, Table 캡션은 표 위라는 관례 사용.
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

async function detectFigureAnchors(pageNum) {
  const page = pageObjects[pageNum - 1];
  if (!page) return [];
  let tc;
  try {
    tc = await page.getTextContent();
  } catch (_) {
    return [];
  }
  const vp = page.getViewport({ scale: 1 });
  const pageW = vp.width;
  const pageH = vp.height;
  if (pageW <= 0 || pageH <= 0) return [];

  const anchors = [];
  let cur = [];
  const flush = () => {
    if (cur.length === 0) return;
    const items = cur;
    cur = [];
    const text = items.map((x) => x.str).join("").trim();
    const label = parseCaptionLabel(text);
    if (!label) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let baseY = Infinity;
    let topY = -Infinity;
    for (const it of items) {
      const x = it.transform[4];
      const y = it.transform[5];
      const w = it.width || 0;
      const h = it.height || Math.hypot(it.transform[2], it.transform[3]) || 0;
      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < baseY) baseY = y;
      if (y + h > topY) topY = y + h;
    }
    const capTop = clamp01((pageH - topY) / pageH);
    const capBot = clamp01((pageH - baseY) / pageH);
    const cx = (minX + maxX) / 2 / pageW;
    const wNorm = (maxX - minX) / pageW;
    // 가로: 넓은 캡션 → 전폭, 좁은 캡션 → 캡션 중심이 속한 컬럼.
    let rx;
    let rw;
    if (wNorm > 0.55) {
      rx = 0.02;
      rw = 0.96;
    } else if (cx < 0.5) {
      rx = 0.02;
      rw = 0.47;
    } else {
      rx = 0.51;
      rw = 0.47;
    }
    // 세로: figure는 캡션 위, table은 캡션 아래(최대 페이지 높이 42% 밴드).
    const BAND = 0.42;
    let ry;
    let rh;
    if (label.kind === "table") {
      ry = capBot;
      rh = Math.min(BAND, 1 - capBot);
    } else {
      ry = Math.max(0, capTop - BAND);
      rh = capTop - ry;
    }
    if (rh <= 0.03) return;
    anchors.push({
      kind: label.kind,
      label: label.label,
      captionText: text.slice(0, 400),
      region: { x: rx, y: ry, w: rw, h: rh },
      btn: { left: clamp01(minX / pageW), top: capTop },
    });
  };
  for (const it of tc.items) {
    if (typeof it.str !== "string") continue;
    cur.push(it);
    if (it.hasEOL) flush();
  }
  flush();
  return anchors;
}

// 페이지 캔버스에서 정규화 region을 잘라 PNG dataURL로 반환.
function cropRegion(pageNum, region) {
  const wrapper = pageWrappers[pageNum - 1];
  const src = wrapper ? wrapper.querySelector(".page-canvas") : null;
  if (!src || !src.width || !src.height) return null;
  const sx = Math.round(region.x * src.width);
  const sy = Math.round(region.y * src.height);
  const sw = Math.max(1, Math.round(region.w * src.width));
  const sh = Math.max(1, Math.round(region.h * src.height));
  const scale = Math.min(1, 1200 / sw); // 페이로드 상한.
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

// 백엔드 figure(정규화 top-left bbox) → 내부 anchor 형식(휴리스틱과 동일 region/btn).
function backendToAnchor(f) {
  const b = f.bbox || {};
  return {
    kind: f.kind,
    label: f.label || "",
    captionText: f.captionText || "",
    region: { x: b.x || 0, y: b.y || 0, w: b.w || 0, h: b.h || 0 },
    btn: { left: clamp01(b.x || 0), top: clamp01(b.y || 0) },
  };
}

// host RENDER_FIGURES 수신: 기존 버튼을 걷어내고 백엔드 bbox로 교체(없으면 휴리스틱 폴백).
async function applyBackendFigures(pageNum, figures) {
  const wrapper = pageWrappers[pageNum - 1];
  if (!wrapper) return;
  for (const el of wrapper.querySelectorAll(".figure-explain-btn")) el.remove();
  if (Array.isArray(figures) && figures.length > 0) {
    pageFigureAnchors[pageNum - 1] = figures.map(backendToAnchor);
  } else {
    pageFigureAnchors[pageNum - 1] = await detectFigureAnchors(pageNum);
  }
  await renderFigureAnchors(pageNum);
}

// 캡션마다 설명 버튼을 wrapper에 배치(정규화 % 위치라 줌 재렌더에도 유지).
async function renderFigureAnchors(pageNum) {
  const wrapper = pageWrappers[pageNum - 1];
  if (!wrapper) return;
  let anchors = pageFigureAnchors[pageNum - 1];
  if (!anchors) {
    anchors = await detectFigureAnchors(pageNum);
    pageFigureAnchors[pageNum - 1] = anchors;
  }
  if (!wrapper.isConnected || wrapper.querySelector(".figure-explain-btn")) return;
  for (const a of anchors) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "figure-explain-btn";
    btn.textContent = a.kind === "table" ? "표 설명" : "그림 설명";
    btn.style.left = (a.btn.left * 100).toFixed(2) + "%";
    btn.style.top = (a.btn.top * 100).toFixed(2) + "%";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const imageDataUrl = cropRegion(pageNum, a.region);
      if (!imageDataUrl) return;
      const r = btn.getBoundingClientRect();
      send("FIGURE_EXPLAIN", {
        page: pageNum,
        kind: a.kind,
        label: a.label,
        captionText: a.captionText,
        imageDataUrl,
        rect: {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        },
      });
    });
    wrapper.appendChild(btn);
  }
}

function setEmpty(text) {
  if (text) {
    empty.textContent = text;
    empty.hidden = false;
  } else {
    empty.hidden = true;
  }
}

// 이미 만들어진 page-wrapper의 canvas/text-layer를 주어진 배율로 다시 그린다.
async function paintPage(pageNum, scale) {
  const wrapper = pageWrappers[pageNum - 1];
  const page = pageObjects[pageNum - 1];
  if (!wrapper || !page) return;
  const viewport = page.getViewport({ scale });

  wrapper.style.width = viewport.width + "px";
  wrapper.style.height = viewport.height + "px";
  syncTranslationHeight(pageNum, viewport.height);

  const canvas = wrapper.querySelector(".page-canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = viewport.width + "px";
  canvas.style.height = viewport.height + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const textLayerDiv = wrapper.querySelector(".text-layer");
  textLayerDiv.style.width = viewport.width + "px";
  textLayerDiv.style.height = viewport.height + "px";
  textLayerDiv.style.setProperty("--scale-factor", String(scale));
  textLayerDiv.replaceChildren();
  try {
    if (typeof pdfjsLib.TextLayer === "function") {
      const textContent = await page.getTextContent();
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });
      await textLayer.render();
    }
  } catch (err) {
    // Text layer optional; selection will not work for this page.
    console.warn("[viewer] text layer failed for page", pageNum, err);
  }
}

// 줌 즉시 미리보기: 기존 캔버스 래스터를 새 크기로 CSS 스트레치(재래스터 전까지 흐릿하게 보임).
function resizeLayout(pageNum, scale) {
  const wrapper = pageWrappers[pageNum - 1];
  const page = pageObjects[pageNum - 1];
  if (!wrapper || !page) return;
  const viewport = page.getViewport({ scale });
  wrapper.style.width = viewport.width + "px";
  wrapper.style.height = viewport.height + "px";
  syncTranslationHeight(pageNum, viewport.height);
  const canvas = wrapper.querySelector(".page-canvas");
  canvas.style.width = viewport.width + "px";
  canvas.style.height = viewport.height + "px";
  const textLayerDiv = wrapper.querySelector(".text-layer");
  textLayerDiv.style.width = viewport.width + "px";
  textLayerDiv.style.height = viewport.height + "px";
  textLayerDiv.style.setProperty("--scale-factor", String(scale));
}

// 페이지 DOM을 한 번 생성하고 페이지 객체를 캐시한 뒤 현재 배율로 그린다.
async function buildPage(pageNum) {
  const page = await currentDoc.getPage(pageNum);
  pageObjects[pageNum - 1] = page;

  // 한 페이지 = [PDF | 번역 컬럼] 가로 배치(row). 같은 스크롤 컨테이너라 스크롤·줌 자동 동기화.
  const row = document.createElement("div");
  row.className = "page-row";

  const wrapper = document.createElement("div");
  wrapper.className = "page-wrapper";
  wrapper.dataset.pageNum = String(pageNum);

  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";
  wrapper.appendChild(canvas);

  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "text-layer";
  wrapper.appendChild(textLayerDiv);
  row.appendChild(wrapper);

  const col = document.createElement("div");
  col.className = "page-translation";
  col.dataset.pageNum = String(pageNum);
  col.innerHTML = '<span class="t-empty">번역 대기 중…</span>';
  row.appendChild(col);
  translationCols[pageNum - 1] = col;

  container.appendChild(row);
  pageWrappers[pageNum - 1] = wrapper;

  await paintPage(pageNum, currentScale);
  // 백엔드(marker) figure bbox를 요청 → host가 RENDER_FIGURES로 응답. 빈 응답이면 휴리스틱 폴백.
  send("REQUEST_FIGURES", { page: pageNum });
}

function captureScrollAnchor() {
  const cTop = container.getBoundingClientRect().top;
  for (let i = 0; i < pageWrappers.length; i++) {
    const w = pageWrappers[i];
    if (!w) continue;
    const r = w.getBoundingClientRect();
    if (r.bottom > cTop) {
      return { index: i, ratio: r.height ? (cTop - r.top) / r.height : 0 };
    }
  }
  return { index: 0, ratio: 0 };
}

function restoreScrollAnchor(anchor) {
  if (!anchor) return;
  const w = pageWrappers[anchor.index];
  if (!w) return;
  const cTop = container.getBoundingClientRect().top;
  const r = w.getBoundingClientRect();
  const pageContentTop = r.top - cTop + container.scrollTop;
  container.scrollTop = pageContentTop + anchor.ratio * r.height;
}

let isRerendering = false;
let queuedScale = null;

// 줌 요청을 직렬화(같은 캔버스 동시 렌더 방지) + 최신 배율로 합치기.
function requestRerender(scale) {
  queuedScale = scale;
  if (!isRerendering) void pumpRerender();
}

async function pumpRerender() {
  isRerendering = true;
  while (queuedScale != null) {
    const scale = queuedScale;
    queuedScale = null;
    await rerenderAtScale(scale);
  }
  isRerendering = false;
}

// 보이는 페이지(startIdx)부터 아래로, 그다음 위로 재렌더하도록 순서를 만든다(1-based).
function paintOrder(startIdx, n) {
  const order = [];
  for (let i = startIdx; i < n; i++) order.push(i + 1);
  for (let i = startIdx - 1; i >= 0; i--) order.push(i + 1);
  return order;
}

// 제자리 재렌더: DOM/문서 재생성 없이 캐시된 페이지를 새 배율로 다시 그리고 스크롤 위치 보존.
async function rerenderAtScale(scale) {
  if (!currentDoc) return;
  currentScale = scale;
  const anchor = captureScrollAnchor();
  for (let i = 1; i <= pageWrappers.length; i++) resizeLayout(i, scale);
  restoreScrollAnchor(anchor);
  // 보이는 페이지부터 선명하게 다시 그린다.
  for (const i of paintOrder(anchor.index, pageWrappers.length)) {
    if (queuedScale != null) return; // 더 최신 배율 요청이 있으면 중단하고 양보
    await paintPage(i, scale);
  }
}

function disposeVisibility() {
  if (visibilityObserver) {
    visibilityObserver.disconnect();
    visibilityObserver = null;
  }
}

function setupVisibility() {
  disposeVisibility();
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      let best = null;
      let bestRatio = 0;
      for (const entry of entries) {
        if (entry.intersectionRatio > bestRatio) {
          bestRatio = entry.intersectionRatio;
          best = Number(entry.target.dataset.pageNum);
        }
      }
      if (best != null && best > 0) send("PAGE_VISIBLE", { page: best });
    },
    { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  for (const w of pageWrappers) if (w) visibilityObserver.observe(w);
}

async function loadPdf(url) {
  setEmpty("PDF 로드 중…");
  disposeVisibility();
  container.innerHTML = "";
  pageWrappers = [];
  pageObjects = [];
  pageSegments = [];
  docFiltersPromise = null;
  pageFigureAnchors = [];
  translationCols = [];
  translationSentences = [];
  searchMatches = [];
  searchCurrent = -1;
  if (currentDoc) {
    try { await currentDoc.destroy(); } catch (_) { /* noop */ }
    currentDoc = null;
  }
  try {
    currentUrl = url;
    currentDoc = await pdfjsLib.getDocument({ url, disableAutoFetch: false }).promise;
    for (let i = 1; i <= currentDoc.numPages; i++) {
      await buildPage(i);
    }
    setEmpty(null);
    send("READY", { numPages: currentDoc.numPages });
    setupVisibility();
    renderAllHighlights();
  } catch (err) {
    const msg = (err && err.message) || String(err);
    setEmpty("PDF 로드 실패: " + msg);
    send("READY", { error: msg });
  }
}

document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) {
    send("SELECTION_CHANGE", { text: "", rect: null, rects: [], page: null });
    return;
  }
  const text = sel.toString().trim();
  if (!text) {
    send("SELECTION_CHANGE", { text: "", rect: null, rects: [], page: null });
    return;
  }
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  let pageNum = null;
  let node = range.startContainer;
  while (node && node !== document.body) {
    if (node.nodeType === 1 && node.classList && node.classList.contains("page-wrapper")) {
      pageNum = Number(node.dataset.pageNum);
      break;
    }
    node = node.parentNode;
  }
  // S14: normalized (0..1) page-relative rects for scale-independent highlight anchoring.
  let rects = [];
  const wrapper = pageNum ? pageWrappers[pageNum - 1] : null;
  if (wrapper) {
    const wr = wrapper.getBoundingClientRect();
    rects = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - wr.left) / wr.width,
        y: (r.top - wr.top) / wr.height,
        w: r.width / wr.width,
        h: r.height / wr.height,
      }));
  }
  send("SELECTION_CHANGE", {
    text,
    rect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
    rects,
    page: pageNum,
  });
});

// PDF 본문 hover → 같은 페이지 번역 컬럼의 대응 문장 강조(iframe 내부에서 직접 처리).
let lastHoverOffset = -1;
let lastHoverPage = -1;
container.addEventListener("mousemove", (e) => {
  if (!hoverEnabled) return;
  const wrapperEl = e.target.closest ? e.target.closest(".page-wrapper") : null;
  if (!wrapperEl) return;
  const layer = wrapperEl.querySelector(".text-layer");
  if (!layer) return;
  let caret = null;
  if (document.caretRangeFromPoint) {
    caret = document.caretRangeFromPoint(e.clientX, e.clientY);
  } else if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (p) {
      caret = document.createRange();
      caret.setStart(p.offsetNode, p.offset);
    }
  }
  if (!caret || !layer.contains(caret.startContainer)) return;
  const offset = globalOffset(layer, caret.startContainer, caret.startOffset);
  if (offset < 0) return;
  const pageNum = Number(wrapperEl.dataset.pageNum);
  if (offset === lastHoverOffset && pageNum === lastHoverPage) return;
  lastHoverOffset = offset;
  lastHoverPage = pageNum;
  clearTranslationActive();
  highlightTranslationAt(pageNum, offset);
  // 영어 원문 hover 시 원문 자체도 강조(한국어 hover와 대칭). offset이 속한 문장 범위를 표시.
  const store = translationSentences[pageNum - 1];
  let matched = null;
  if (store) {
    for (const en of store) {
      if (en && en.globalStart >= 0 && offset >= en.globalStart && offset < en.globalEnd) {
        matched = en;
        break;
      }
    }
  }
  if (matched) highlightSentence(pageNum, matched.globalStart, matched.globalEnd);
  else clearLinkedOverlays();
});
container.addEventListener("mouseleave", () => {
  if (!hoverEnabled) return;
  lastHoverOffset = -1;
  lastHoverPage = -1;
  clearTranslationActive();
  clearLinkedOverlays();
});

window.addEventListener("message", async (event) => {
  const msg = event.data;
  if (!msg || msg.source !== HOST_SOURCE) return;
  switch (msg.type) {
    case "LOAD_PDF":
      await loadPdf(msg.url);
      break;
    case "JUMP_TO": {
      const w = pageWrappers[(msg.page || 1) - 1];
      if (w) w.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "SET_ZOOM": {
      const scale = Math.max(0.25, Math.min(4, msg.scale));
      if (currentDoc) requestRerender(scale);
      else currentScale = scale;
      break;
    }
    case "HIGHLIGHT_REGION":
      // Deprecated stub — superseded by RENDER_HIGHLIGHTS (S14).
      break;
    case "RENDER_HIGHLIGHTS":
      savedHighlights = msg.highlights || [];
      renderAllHighlights();
      break;
    case "REMOVE_HIGHLIGHT": {
      savedHighlights = savedHighlights.filter((h) => h.id !== msg.id);
      for (const el of container.querySelectorAll('.highlight-overlay[data-hl-id="' + msg.id + '"]'))
        el.remove();
      break;
    }
    case "TOGGLE_TRANSLATION":
      hoverEnabled = !!msg.enabled;
      container.classList.toggle("pages--translate", hoverEnabled);
      if (!hoverEnabled) {
        clearLinkedOverlays();
        clearTranslationActive();
      }
      break;
    case "SET_TRANSLATION_FONT": {
      const sans =
        '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
      const serif = '"Noto Serif KR", Georgia, "Times New Roman", serif';
      document.documentElement.style.setProperty(
        "--translation-font-family",
        msg.family === "serif" ? serif : sans,
      );
      document.documentElement.style.setProperty(
        "--translation-font-scale",
        String(msg.scale || 1),
      );
      break;
    }
    case "RENDER_TRANSLATION":
      renderTranslation(msg.page, msg.pairs, msg.replace);
      break;
    case "CLEAR_TRANSLATION":
      clearTranslation(msg.page);
      break;
    case "REQUEST_PAGE_TEXT": {
      const { text, segments } = await extractBodyText(msg.page);
      pageSegments[(msg.page || 1) - 1] = segments;
      send("PAGE_TEXT", { page: msg.page, text });
      break;
    }
    case "RENDER_FIGURES":
      await applyBackendFigures(msg.page, msg.figures);
      break;
    case "REQUEST_OUTLINE": {
      const items = await buildOutline();
      send("OUTLINE", { items });
      break;
    }
    case "REQUEST_THUMBNAILS":
      await sendThumbnails();
      break;
    case "FIND":
      runSearch(msg.query);
      break;
    case "FIND_STEP":
      stepSearch(msg.dir);
      break;
    case "FIND_CLEAR":
      clearSearch();
      break;
  }
});

// Notify host the iframe shell itself is alive (PDF not loaded yet).
send("READY", { ready: true });
