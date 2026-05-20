import * as pdfjsLib from "/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

const HOST_SOURCE = "paperlight-pdf-host";
const IFRAME_SOURCE = "paperlight-pdf-iframe";

const container = document.getElementById("pages");
const empty = document.getElementById("empty");

let currentDoc = null;
let currentUrl = null;
let currentScale = 1.25;
let pageWrappers = [];
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
  "mix-blend-mode:multiply;border-radius:2px;}";
document.head.appendChild(hlStyle);

function send(type, payload = {}) {
  parent.postMessage({ source: IFRAME_SOURCE, type, ...payload }, "*");
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

function setEmpty(text) {
  if (text) {
    empty.textContent = text;
    empty.hidden = false;
  } else {
    empty.hidden = true;
  }
}

async function renderPage(pageNum, scale) {
  const page = await currentDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const wrapper = document.createElement("div");
  wrapper.className = "page-wrapper";
  wrapper.style.width = viewport.width + "px";
  wrapper.style.height = viewport.height + "px";
  wrapper.dataset.pageNum = String(pageNum);

  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = viewport.width + "px";
  canvas.style.height = viewport.height + "px";
  wrapper.appendChild(canvas);

  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "text-layer";
  textLayerDiv.style.width = viewport.width + "px";
  textLayerDiv.style.height = viewport.height + "px";
  textLayerDiv.style.setProperty("--scale-factor", String(scale));
  wrapper.appendChild(textLayerDiv);

  container.appendChild(wrapper);
  pageWrappers[pageNum - 1] = wrapper;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  await page.render({ canvasContext: ctx, viewport }).promise;

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
  if (currentDoc) {
    try { await currentDoc.destroy(); } catch (_) { /* noop */ }
    currentDoc = null;
  }
  try {
    currentUrl = url;
    currentDoc = await pdfjsLib.getDocument({ url, disableAutoFetch: false }).promise;
    for (let i = 1; i <= currentDoc.numPages; i++) {
      await renderPage(i, currentScale);
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
      currentScale = Math.max(0.25, Math.min(4, msg.scale));
      if (currentUrl) await loadPdf(currentUrl);
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
      // Translation overlay is rendered host-side; iframe stub.
      break;
    case "REQUEST_PAGE_TEXT": {
      const wrapper = pageWrappers[(msg.page || 1) - 1];
      const layer = wrapper?.querySelector(".text-layer");
      const text = layer ? layer.textContent || "" : "";
      send("PAGE_TEXT", { page: msg.page, text });
      break;
    }
  }
});

// Notify host the iframe shell itself is alive (PDF not loaded yet).
send("READY", { ready: true });
