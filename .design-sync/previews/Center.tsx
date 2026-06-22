import { Center } from "paperlight-frontend";

// sample-* 이외 id 는 백엔드 presigned URL 비동기 로드 → 헤들리스에선 fetch 실패로
// pdfUrl 이 null 유지되어 '선택되지 않았습니다' 빈 상태(안정적)로 캡처된다.
/** 본문 영역(Center) — PdfViewer + SearchBar 합성, 빈 PDF 안내 상태. */
export function Default() {
  return (
    <div
      style={{
        width: 640,
        height: 520,
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <Center paperId="paper-demo-1" />
    </div>
  );
}

/** 좁은 컬럼 폭에서의 본문 영역. */
export function Narrow() {
  return (
    <div
      style={{
        width: 460,
        height: 560,
        background: "var(--bg-muted)",
        overflow: "hidden",
      }}
    >
      <Center paperId="paper-demo-2" />
    </div>
  );
}
