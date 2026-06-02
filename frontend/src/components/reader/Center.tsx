"use client";

import { PdfViewer } from "./PdfViewer";
import { SearchBar } from "./SearchBar";

const PDF_URL_MAP: Record<string, string> = {
  "sample-1": "/api/sample-pdfs/sample-1",
  "sample-2": "/api/sample-pdfs/sample-2",
};

export function Center({ paperId }: { paperId: string }) {
  const pdfUrl = PDF_URL_MAP[paperId] ?? null;
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
