import * as pdfjsLib from "/pdfjs/pdf.min.mjs";
import { extractBody } from "/pdfjs/bodyFilter.js";

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
let visibilityObserver = null;
let savedHighlights = [];

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
  "background:rgba(0,0,0,0.10);border-radius:2px;}";
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
        if (page && title) items.push({ title, page, level });
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
    const pageH = page.getViewport({ scale: 1 }).height;
    const styles = tc.styles || {};
    const items = tc.items.map((it) => ({
      str: it.str,
      hasEOL: !!it.hasEOL,
      fontHeight: it.height || Math.hypot(it.transform[2], it.transform[3]),
      normTop: pageH > 0 ? (pageH - it.transform[5]) / pageH : 0,
      fontFamily: (styles[it.fontName] && styles[it.fontName].fontFamily) || "",
    }));
    const { bodyText, segments } = extractBody(items);
    if (!bodyText) return { text: fullText, segments: identity }; // 전부 drop되면 폴백.
    return { text: bodyText, segments };
  } catch (_) {
    return { text: fullText, segments: identity };
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

  const wrapper = document.createElement("div");
  wrapper.className = "page-wrapper";
  wrapper.dataset.pageNum = String(pageNum);

  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";
  wrapper.appendChild(canvas);

  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "text-layer";
  wrapper.appendChild(textLayerDiv);

  container.appendChild(wrapper);
  pageWrappers[pageNum - 1] = wrapper;

  await paintPage(pageNum, currentScale);
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

// PDF 본문 hover → 해석 패널에 대응 문장 알림(해석 패널 열림일 때만).
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
  send("SENTENCE_HOVER", { page: pageNum, offset });
});
container.addEventListener("mouseleave", () => {
  if (!hoverEnabled) return;
  lastHoverOffset = -1;
  lastHoverPage = -1;
  send("SENTENCE_HOVER", { page: null, offset: null });
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
      if (!hoverEnabled) {
        clearLinkedOverlays();
        send("SENTENCE_HOVER", { page: null, offset: null });
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
    case "HIGHLIGHT_SENTENCE":
      highlightSentence(msg.page, msg.startOffset, msg.endOffset);
      break;
    case "CLEAR_SENTENCE_HIGHLIGHT":
      clearLinkedOverlays();
      break;
    case "REQUEST_PAGE_TEXT": {
      const { text, segments } = await extractBodyText(msg.page);
      pageSegments[(msg.page || 1) - 1] = segments;
      send("PAGE_TEXT", { page: msg.page, text });
      break;
    }
    case "REQUEST_OUTLINE": {
      const items = await buildOutline();
      send("OUTLINE", { items });
      break;
    }
    case "REQUEST_THUMBNAILS":
      await sendThumbnails();
      break;
  }
});

// Notify host the iframe shell itself is alive (PDF not loaded yet).
send("READY", { ready: true });
