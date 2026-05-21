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
import { useSettings } from "@/stores/settings";

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
  const setPageText = useReader((s) => s.setPageText);
  const requestPanel = useReader((s) => s.requestPanel);
  const setOutline = useReader((s) => s.setOutline);
  const setThumbnail = useReader((s) => s.setThumbnail);
  const requestOutline = useReader((s) => s.requestOutline);
  const outlineRequest = useReader((s) => s.outlineRequest);
  const thumbnailsRequest = useReader((s) => s.thumbnailsRequest);
  const setHoveredSentence = useReader((s) => s.setHoveredSentence);
  const linkedHighlight = useReader((s) => s.linkedHighlight);
  const translationEnabled = useReader((s) => s.translationEnabled);
  const currentPage = useReader((s) => s.currentPage);
  const zoom = useReader((s) => s.zoom);
  const jumpRequest = useReader((s) => s.jumpRequest);
  const highlights = useMarkup((s) => s.highlights);
  const fetchHighlights = useMarkup((s) => s.fetchHighlights);
  const translationFontFamily = useSettings((s) => s.translationFontFamily);
  const readerFontScale = useSettings((s) => s.readerFontScale);
  const handleRef = useRef<ShadowIframeHandle | null>(null);
  const iframeReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const prevZoomRef = useRef(zoom);
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
        case "PAGE_TEXT":
          setPageText(data.page, data.text);
          break;
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
        case "HIGHLIGHT_CLICK":
          requestPanel("notes");
          break;
        case "OUTLINE":
          setOutline(data.items);
          break;
        case "THUMBNAIL":
          setThumbnail(data.page, data.dataUrl);
          break;
        case "SENTENCE_HOVER":
          setHoveredSentence(
            data.page != null && data.offset != null
              ? { page: data.page, offset: data.offset }
              : null,
          );
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    setSelection,
    setCurrentPage,
    setTotalPages,
    setPageText,
    requestPanel,
    setOutline,
    setThumbnail,
    requestOutline,
    setHoveredSentence,
  ]);

  // Translation 토글이 ON되면 현재 페이지 텍스트 요청.
  useEffect(() => {
    if (!translationEnabled) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_PAGE_TEXT", page: currentPage });
  }, [translationEnabled, currentPage]);

  // 해석 패널 열림 상태를 iframe에 알려 본문 hover 리포팅을 켜고 끈다.
  useEffect(() => {
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "TOGGLE_TRANSLATION", enabled: translationEnabled });
  }, [translationEnabled, status]);

  // 해석 패널 문장 hover → PDF 대응 원문 하이라이트.
  useEffect(() => {
    if (!iframeReadyRef.current) return;
    if (linkedHighlight) {
      postToIframe({
        source: HOST_SOURCE,
        type: "HIGHLIGHT_SENTENCE",
        page: linkedHighlight.page,
        startOffset: linkedHighlight.startOffset,
        endOffset: linkedHighlight.endOffset,
      });
    } else {
      postToIframe({ source: HOST_SOURCE, type: "CLEAR_SENTENCE_HIGHLIGHT" });
    }
  }, [linkedHighlight]);

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
