"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PdfViewer } from "./PdfViewer";
import { SearchBar } from "./SearchBar";

// sample-N 은 프론트 내장 라우트로 서빙. 백엔드 seed.py SAMPLES / route.ts SLUG_TO_FILE 와 동일 키.
const PDF_URL_MAP: Record<string, string> = {
  "sample-1": "/api/sample-pdfs/sample-1",
  "sample-2": "/api/sample-pdfs/sample-2",
  "sample-3": "/api/sample-pdfs/sample-3",
  "sample-4": "/api/sample-pdfs/sample-4",
  "sample-5": "/api/sample-pdfs/sample-5",
  "sample-6": "/api/sample-pdfs/sample-6",
  "sample-7": "/api/sample-pdfs/sample-7",
  "sample-8": "/api/sample-pdfs/sample-8",
  "sample-9": "/api/sample-pdfs/sample-9",
  "sample-10": "/api/sample-pdfs/sample-10",
};

export function Center({ paperId }: { paperId: string }) {
  // sample 논문은 프론트 내장 라우트, 실 논문은 백엔드 presigned URL을 비동기로 받는다.
  const sampleUrl = PDF_URL_MAP[paperId] ?? null;
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(sampleUrl);

  useEffect(() => {
    if (sampleUrl) {
      setResolvedUrl(sampleUrl);
      return;
    }
    let active = true;
    setResolvedUrl(null);
    void (async () => {
      try {
        const res = await apiFetch(`/api/papers/${paperId}/pdf-url`);
        if (!res.ok) return;
        const body = (await res.json()) as { url?: string };
        if (active && body.url) setResolvedUrl(body.url);
      } catch {
        // 네트워크 실패 시 빈 화면 유지 — PdfViewer가 안내 문구 노출.
      }
    })();
    return () => {
      active = false;
    };
  }, [paperId, sampleUrl]);

  const pdfUrl = resolvedUrl;
  return (
    <section
      aria-label="PDF 본문 영역"
      className="relative h-full min-w-0 flex-1 overflow-hidden bg-bg-muted"
    >
      <PdfViewer pdfUrl={pdfUrl} paperId={paperId} />
      <SearchBar />
    </section>
  );
}
