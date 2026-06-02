"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  type FigureLayout,
  HOST_SOURCE,
  type HostToIframeMessage,
  IFRAME_SOURCE,
  type IframeToHostMessage,
} from "@/lib/pdf/messages";
import { createShadowIframe, type ShadowIframeHandle } from "@/lib/pdf/shadow-iframe";
import { streamSse } from "@/lib/sse";
import { type Sentence, splitSentences } from "@/lib/text/sentences";
import { useMarkup } from "@/stores/markup";
import { useReader } from "@/stores/reader";
import { useSettings } from "@/stores/settings";

/** 페이지별 번역 진행 상태 캐시(렌더는 iframe 컬럼이 담당, host는 데이터 펌프). */
interface PageTranslation {
  sentences: Sentence[];
  pairs: Record<number, string>;
  status: "streaming" | "done" | "error";
  ctrl: AbortController;
}

export interface PdfViewerProps {
  pdfUrl: string | null;
  paperId: string;
}

/** zoom 100% 가 대응하는 iframe(viewer.js)의 기본 배율. */
const BASE_SCALE = 1.25;

export function PdfViewer({ pdfUrl, paperId }: PdfViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const setSelection = useReader((s) => s.setSelection);
  const setCurrentPage = useReader((s) => s.setCurrentPage);
  const setTotalPages = useReader((s) => s.setTotalPages);
  const requestPanel = useReader((s) => s.requestPanel);
  const setOutline = useReader((s) => s.setOutline);
  const setThumbnail = useReader((s) => s.setThumbnail);
  const requestOutline = useReader((s) => s.requestOutline);
  const triggerFigureExplain = useReader((s) => s.triggerFigureExplain);
  const outlineRequest = useReader((s) => s.outlineRequest);
  const thumbnailsRequest = useReader((s) => s.thumbnailsRequest);
  const translationEnabled = useReader((s) => s.translationEnabled);
  const currentPage = useReader((s) => s.currentPage);
  const zoom = useReader((s) => s.zoom);
  const jumpRequest = useReader((s) => s.jumpRequest);
  const findRequest = useReader((s) => s.findRequest);
  const findStepRequest = useReader((s) => s.findStepRequest);
  const setFindResult = useReader((s) => s.setFindResult);
  const closeSearch = useReader((s) => s.closeSearch);
  const highlights = useMarkup((s) => s.highlights);
  const fetchHighlights = useMarkup((s) => s.fetchHighlights);
  const translationFontFamily = useSettings((s) => s.translationFontFamily);
  const readerFontScale = useSettings((s) => s.readerFontScale);
  const handleRef = useRef<ShadowIframeHandle | null>(null);
  const iframeReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const prevZoomRef = useRef(zoom);
  // 페이지별 번역 캐시 + REQUEST_PAGE_TEXT 디듀프(논문 전환 시 리셋).
  const transCacheRef = useRef<Map<number, PageTranslation>>(new Map());
  const requestedRef = useRef<Set<number>>(new Set());
  // 백엔드 figure bbox(페이지별) + 로드 완료 플래그 + REQUEST_FIGURES 받은 페이지.
  const figuresByPageRef = useRef<Map<number, FigureLayout[]>>(new Map());
  const figuresLoadedRef = useRef(false);
  const requestedFiguresRef = useRef<Set<number>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function postToIframe(msg: HostToIframeMessage) {
    const win = handleRef.current?.iframe.contentWindow;
    if (!win) return;
    win.postMessage(msg, "*");
  }

  // Mount iframe once.
  useEffect(() => {
    if (!mountRef.current) return;
    const handle = createShadowIframe(mountRef.current, "/pdfjs/viewer.html");
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
  }, []);

  // Listen for iframe → host messages.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const handle = handleRef.current;
      if (!handle) return;
      if (event.source !== handle.iframe.contentWindow) return;
      const data = event.data as IframeToHostMessage | null;
      if (!data || data.source !== IFRAME_SOURCE) return;
      switch (data.type) {
        case "READY":
          if (data.error) {
            setStatus("error");
            setErrorMsg(data.error);
            return;
          }
          if (data.numPages != null) {
            setStatus("ready");
            setTotalPages(data.numPages);
            setCurrentPage(1);
            setErrorMsg(null);
            requestOutline();
            return;
          }
          // shell ready (no PDF yet)
          iframeReadyRef.current = true;
          if (pendingUrlRef.current) {
            postToIframe({ source: HOST_SOURCE, type: "LOAD_PDF", url: pendingUrlRef.current });
            pendingUrlRef.current = null;
          }
          break;
        case "PAGE_VISIBLE":
          setCurrentPage(data.page);
          break;
        case "PAGE_TEXT": {
          // 본문(필터된) 텍스트 → 문장 정렬 번역 스트리밍 → iframe 컬럼으로 push.
          if (!translationEnabled) break;
          const page = data.page;
          const cache = transCacheRef.current;
          if (cache.has(page)) break; // 이미 스트리밍/완료(컬럼 DOM은 iframe이 유지).
          const sentences = splitSentences(data.text);
          if (sentences.length === 0) break;
          const ctrl = new AbortController();
          const entry: PageTranslation = { sentences, pairs: {}, status: "streaming", ctrl };
          cache.set(page, entry);
          streamSse(
            "/api/translate",
            {
              sentences: sentences.map((s) => s.text),
              aligned: true,
              targetLang: "ko",
              paperId,
              page,
            },
            {
              onToken: () => {},
              onMeta: (ev) => {
                const pair = ev.pair as { i: number; tgt: string } | undefined;
                if (!pair || typeof pair.i !== "number") return;
                const s = entry.sentences[pair.i];
                if (!s) return;
                const isFirst = Object.keys(entry.pairs).length === 0;
                entry.pairs[pair.i] = pair.tgt;
                postToIframe({
                  source: HOST_SOURCE,
                  type: "RENDER_TRANSLATION",
                  page,
                  pairs: [{ i: pair.i, tgt: pair.tgt, bodyStart: s.start, bodyEnd: s.end }],
                  replace: isFirst,
                });
              },
              onDone: () => {
                entry.status = "done";
              },
              onError: () => {
                entry.status = "error";
              },
            },
            ctrl.signal,
          );
          break;
        }
        case "SELECTION_CHANGE": {
          if (!data.text || !data.rect) {
            setSelection(null);
            return;
          }
          const iframeRect = handle.iframe.getBoundingClientRect();
          const r = data.rect;
          setSelection({
            text: data.text,
            page: data.page,
            hostRect: {
              left: iframeRect.left + r.left,
              top: iframeRect.top + r.top,
              right: iframeRect.left + r.right,
              bottom: iframeRect.top + r.bottom,
              width: r.width,
              height: r.height,
            },
            rects: data.rects ?? [],
          });
          break;
        }
        case "FIGURE_EXPLAIN": {
          const iframeRect = handle.iframe.getBoundingClientRect();
          const r = data.rect;
          triggerFigureExplain({
            page: data.page,
            kind: data.kind,
            label: data.label,
            captionText: data.captionText,
            imageDataUrl: data.imageDataUrl,
            hostRect: {
              left: iframeRect.left + r.left,
              top: iframeRect.top + r.top,
              right: iframeRect.left + r.right,
              bottom: iframeRect.top + r.bottom,
              width: r.width,
              height: r.height,
            },
          });
          break;
        }
        case "REQUEST_FIGURES": {
          requestedFiguresRef.current.add(data.page);
          // fetch 미완료면 보류 — 완료 시 figures fetch effect가 해당 페이지로 push.
          if (!figuresLoadedRef.current) break;
          postToIframe({
            source: HOST_SOURCE,
            type: "RENDER_FIGURES",
            page: data.page,
            figures: figuresByPageRef.current.get(data.page) ?? [],
          });
          break;
        }
        case "HIGHLIGHT_CLICK":
          requestPanel("notes");
          break;
        case "OUTLINE":
          setOutline(data.items);
          break;
        case "THUMBNAIL":
          setThumbnail(data.page, data.dataUrl);
          break;
        case "FIND_RESULT":
          setFindResult(data.matchCount, data.current);
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    setSelection,
    setCurrentPage,
    setTotalPages,
    requestPanel,
    setOutline,
    setThumbnail,
    requestOutline,
    triggerFigureExplain,
    translationEnabled,
    paperId,
    setFindResult,
  ]);

  // 번역 ON & 보이는 페이지가 미요청이면 본문 텍스트 요청(스크롤 따라 lazy).
  useEffect(() => {
    if (!translationEnabled) return;
    if (status !== "ready") return;
    if (!iframeReadyRef.current) return;
    if (requestedRef.current.has(currentPage)) return;
    requestedRef.current.add(currentPage);
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_PAGE_TEXT", page: currentPage });
  }, [translationEnabled, currentPage, status]);

  // 토글 상태를 iframe에 알려 번역 컬럼 표시/숨김 + 본문 hover를 켜고 끈다.
  useEffect(() => {
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "TOGGLE_TRANSLATION", enabled: translationEnabled });
  }, [translationEnabled, status]);

  // 논문 전환 시 번역 캐시/요청 기록 리셋 + iframe 컬럼 초기화.
  useEffect(() => {
    for (const e of transCacheRef.current.values()) e.ctrl.abort();
    transCacheRef.current.clear();
    requestedRef.current.clear();
    if (iframeReadyRef.current) postToIframe({ source: HOST_SOURCE, type: "CLEAR_TRANSLATION" });
  }, [paperId]);

  // 백엔드 figure bbox를 논문당 1회 fetch(marker 모드에서만 채워짐). 늦게 도착하면
  // 이미 REQUEST_FIGURES를 보낸 페이지에 push해 휴리스틱 버튼을 정밀 bbox로 교체한다.
  useEffect(() => {
    figuresByPageRef.current = new Map();
    figuresLoadedRef.current = false;
    requestedFiguresRef.current.clear();
    let alive = true;
    apiFetch(`/api/papers/${paperId}/figures`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          figuresLoadedRef.current = true;
          return;
        }
        const body = (await res.json()) as { figures: FigureLayout[] };
        const map = new Map<number, FigureLayout[]>();
        for (const f of body.figures ?? []) {
          const arr = map.get(f.page) ?? [];
          arr.push(f);
          map.set(f.page, arr);
        }
        if (!alive) return;
        figuresByPageRef.current = map;
        figuresLoadedRef.current = true;
        for (const page of requestedFiguresRef.current) {
          postToIframe({
            source: HOST_SOURCE,
            type: "RENDER_FIGURES",
            page,
            figures: map.get(page) ?? [],
          });
        }
      })
      .catch(() => {
        if (alive) figuresLoadedRef.current = true;
      });
    return () => {
      alive = false;
    };
  }, [paperId]);

  // 번역 컬럼 글꼴(종류·크기)을 iframe에 전달 (iframe은 host CSS 변수를 못 봄).
  useEffect(() => {
    if (!iframeReadyRef.current) return;
    postToIframe({
      source: HOST_SOURCE,
      type: "SET_TRANSLATION_FONT",
      family: translationFontFamily,
      scale: readerFontScale,
    });
  }, [translationFontFamily, readerFontScale, status]);

  // 줌 변경 시 iframe 재렌더 요청 (초기 ready 시점에는 기본 배율이라 생략).
  useEffect(() => {
    if (status !== "ready") return;
    if (prevZoomRef.current === zoom) return;
    prevZoomRef.current = zoom;
    postToIframe({ source: HOST_SOURCE, type: "SET_ZOOM", scale: (zoom / 100) * BASE_SCALE });
  }, [zoom, status]);

  // Citation 클릭 → 해당 페이지로 점프 (F-03).
  useEffect(() => {
    if (!jumpRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "JUMP_TO", page: jumpRequest.page });
  }, [jumpRequest]);

  // 페이지 내 검색: 검색어 변경 → iframe FIND, 이전·다음 → FIND_STEP.
  useEffect(() => {
    if (!findRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "FIND", query: findRequest.query });
  }, [findRequest]);

  useEffect(() => {
    if (!findStepRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "FIND_STEP", dir: findStepRequest.dir });
  }, [findStepRequest]);

  // 논문 전환 시 검색 상태 초기화(오버레이는 loadPdf가 비움).
  useEffect(() => {
    closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  // Sidebar 요청 → iframe에 outline/thumbnail 요청 전달.
  useEffect(() => {
    if (!outlineRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_OUTLINE" });
  }, [outlineRequest]);

  useEffect(() => {
    if (!thumbnailsRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_THUMBNAILS" });
  }, [thumbnailsRequest]);

  // S14: 저장된 하이라이트 로드.
  useEffect(() => {
    fetchHighlights(paperId);
  }, [paperId, fetchHighlights]);

  // S14: PDF ready 또는 하이라이트 변경 시 overlay 재렌더 요청.
  useEffect(() => {
    if (status !== "ready") return;
    postToIframe({
      source: HOST_SOURCE,
      type: "RENDER_HIGHLIGHTS",
      highlights: highlights.map((h) => ({
        id: h.id,
        page: h.page,
        color: h.color,
        rects: h.bbox.rects,
      })),
    });
  }, [status, highlights]);

  // Send LOAD_PDF when pdfUrl changes (after iframe shell is ready).
  useEffect(() => {
    if (!pdfUrl) {
      setStatus("idle");
      setTotalPages(0);
      return;
    }
    setStatus("loading");
    if (!iframeReadyRef.current) {
      pendingUrlRef.current = pdfUrl;
      return;
    }
    postToIframe({ source: HOST_SOURCE, type: "LOAD_PDF", url: pdfUrl });
  }, [pdfUrl, setTotalPages]);

  return (
    <div className="relative h-full w-full bg-bg-muted">
      <div ref={mountRef} className="h-full w-full" />
      {!pdfUrl && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-text-muted">
          PDF가 선택되지 않았습니다
        </div>
      )}
      {status === "loading" && pdfUrl && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <div className="rounded-full bg-bg-surface px-3 py-1 text-xs text-text-secondary shadow">
            PDF 로드 중…
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <div className="rounded-full bg-danger px-3 py-1 text-xs text-white shadow">
            PDF 로드 실패: {errorMsg ?? "unknown"}
          </div>
        </div>
      )}
    </div>
  );
}
