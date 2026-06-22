import { PdfViewer } from "paperlight-frontend";

/** PDF 미선택 빈 상태 — "PDF가 선택되지 않았습니다" 안내가 정상 동작. */
export function EmptyState() {
  return (
    <div
      style={{
        width: 640,
        height: 480,
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <PdfViewer pdfUrl={null} paperId="sample-1" />
    </div>
  );
}

/** 리더 본문 컬럼 폭에 맞춘 빈 뷰어 프레임. */
export function InReaderFrame() {
  return (
    <div
      style={{
        width: 520,
        height: 560,
        background: "var(--bg-muted)",
        overflow: "hidden",
      }}
    >
      <PdfViewer pdfUrl={null} paperId="sample-3" />
    </div>
  );
}
