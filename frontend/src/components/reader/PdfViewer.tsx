"use client";

import { useEffect, useRef, useState } from "react";
import {
  HOST_SOURCE,
  IFRAME_SOURCE,
  type HostToIframeMessage,
  type IframeToHostMessage,
} from "@/lib/pdf/messages";
import { createShadowIframe, type ShadowIframeHandle } from "@/lib/pdf/shadow-iframe";
import { useReader } from "@/stores/reader";

export interface PdfViewerProps {
  pdfUrl: string | null;
}

export function PdfViewer({ pdfUrl }: PdfViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const setSelection = useReader((s) => s.setSelection);
  const setCurrentPage = useReader((s) => s.setCurrentPage);
  const setPageText = useReader((s) => s.setPageText);
  const translationEnabled = useReader((s) => s.translationEnabled);
  const currentPage = useReader((s) => s.currentPage);
  const jumpRequest = useReader((s) => s.jumpRequest);
  const handleRef = useRef<ShadowIframeHandle | null>(null);
  const iframeReadyRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pages, setPages] = useState<{ visible: number; total: number } | null>(null);
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
            setPages({ visible: 1, total: data.numPages });
            setErrorMsg(null);
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
          setPages((prev) => (prev ? { ...prev, visible: data.page } : prev));
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
          });
          break;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setSelection, setCurrentPage, setPageText]);

  // Translation 토글이 ON되면 현재 페이지 텍스트 요청.
  useEffect(() => {
    if (!translationEnabled) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_PAGE_TEXT", page: currentPage });
  }, [translationEnabled, currentPage]);

  // Citation 클릭 → 해당 페이지로 점프 (F-03).
  useEffect(() => {
    if (!jumpRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "JUMP_TO", page: jumpRequest.page });
  }, [jumpRequest]);

  // Send LOAD_PDF when pdfUrl changes (after iframe shell is ready).
  useEffect(() => {
    if (!pdfUrl) {
      setStatus("idle");
      setPages(null);
      return;
    }
    setStatus("loading");
    if (!iframeReadyRef.current) {
      pendingUrlRef.current = pdfUrl;
      return;
    }
    postToIframe({ source: HOST_SOURCE, type: "LOAD_PDF", url: pdfUrl });
  }, [pdfUrl]);

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
      {status === "ready" && pages && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-bg-surface px-2 py-1 text-xs text-text-secondary shadow">
          {pages.visible} / {pages.total}
        </div>
      )}
    </div>
  );
}
