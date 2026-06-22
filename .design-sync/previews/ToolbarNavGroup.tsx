import { ToolbarNavGroup } from "paperlight-frontend";

/** 툴바 좌측 그룹 — 목차 토글 · 썸네일 · 페이지 내 검색 아이콘. */
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
      <ToolbarNavGroup />
    </div>
  );
}
