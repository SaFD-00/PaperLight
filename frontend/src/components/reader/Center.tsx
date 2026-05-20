"use client";

import { PdfViewer } from "./PdfViewer";

const PDF_URL_MAP: Record<string, string> = {
  "sample-1": "/api/sample-pdfs/sample-1",
  "sample-2": "/api/sample-pdfs/sample-2",
};

export function Center({ paperId }: { paperId: string }) {
  const pdfUrl = PDF_URL_MAP[paperId] ?? null;
  return (
    <section aria-label="PDF 본문 영역" className="h-full overflow-hidden bg-bg-muted">
      <PdfViewer pdfUrl={pdfUrl} paperId={paperId} />
    </section>
  );
}
