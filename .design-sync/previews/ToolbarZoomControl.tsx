import { ToolbarZoomControl } from "paperlight-frontend";

/** 툴바 중앙 그룹 — 페이지 카운터 + 줌 인/아웃 컨트롤. */
export function OnToolbar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 48,
        padding: "0 12px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <ToolbarZoomControl />
    </div>
  );
}
