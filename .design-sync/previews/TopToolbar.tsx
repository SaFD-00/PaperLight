import { TopToolbar } from "paperlight-frontend";

/** 뷰어 상단 툴바 전체 — nav · zoom · AI 토글 · 설정 그룹을 한 줄에 배치. */
export function Full() {
  return (
    <div style={{ width: 900, background: "var(--bg-base)" }}>
      <TopToolbar />
    </div>
  );
}
