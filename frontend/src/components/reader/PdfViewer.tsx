"use client";

import { useEffect, useRef, useState } from "react";
import {
  HOST_SOURCE,
  type HostToIframeMessage,
  IFRAME_SOURCE,
  type IframeToHostMessage,
} from "@/lib/pdf/messages";
import { createShadowIframe, type ShadowIframeHandle } from "@/lib/pdf/shadow-iframe";
import { useMarkup } from "@/stores/markup";
import { useReader } from "@/stores/reader";
import { type PageTranslation, streamPageTranslation } from "./pdfTranslation";
import { useFigureLayout } from "./useFigureLayout";
import { useReaderIframeSync } from "./useReaderIframeSync";

export interface PdfViewerProps {
  pdfUrl: string | null;
  paperId: string;
}

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
  const translationEnabled = useReader((s) => s.translationEnabled);
  const setFindResult = useReader((s) => s.setFindResult);
  const closeSearch = useReader((s) => s.closeSearch);
  const fetchHighlights = useMarkup((s) => s.fetchHighlights);

  const handleRef = useRef<ShadowIframeHandle | null>(null);
  const iframeReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  // 페이지별 번역 캐시 + REQUEST_PAGE_TEXT 디듀프(논문 전환 시 리셋).
  const transCacheRef = useRef<Map<number, PageTranslation>>(new Map());
  const requestedRef = useRef<Set<number>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function postToIframe(msg: HostToIframeMessage) {
    const win = handleRef.current?.iframe.contentWindow;
    if (!win) return;
    win.postMessage(msg, "*");
  }

  // 백엔드 figure bbox(페이지별) — REQUEST_FIGURES 디스패치에서 사용.
  const { figuresByPageRef, figuresLoadedRef, requestedFiguresRef } = useFigureLayout(
    paperId,
    postToIframe,
  );

  // 스토어 → iframe outbound 동기화(줌/점프/검색/아웃라인/하이라이트/번역 등).
  useReaderIframeSync({ postToIframe, iframeReadyRef, requestedRef, status });

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
          if (!translationEnabled) break;
          streamPageTranslation({
            page: data.page,
            text: data.text,
            paperId,
            cache: transCacheRef.current,
            postToIframe,
          });
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

  // 논문 전환 시 번역 캐시/요청 기록 리셋 + iframe 컬럼 초기화.
  useEffect(() => {
    for (const e of transCacheRef.current.values()) e.ctrl.abort();
    transCacheRef.current.clear();
    requestedRef.current.clear();
    if (iframeReadyRef.current) postToIframe({ source: HOST_SOURCE, type: "CLEAR_TRANSLATION" });
  }, [paperId]);

  // 논문 전환 시 검색 상태 초기화(오버레이는 loadPdf가 비움).
  useEffect(() => {
    closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  // S14: 저장된 하이라이트 로드.
  useEffect(() => {
    fetchHighlights(paperId);
  }, [paperId, fetchHighlights]);

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
