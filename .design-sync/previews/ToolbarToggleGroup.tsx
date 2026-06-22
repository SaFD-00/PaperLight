import { ToolbarToggleGroup } from "paperlight-frontend";

/** AI 기능 토글 묶음 — 오토 하이라이트 · 이미지 설명 · 단락 설명 · Quick Skim · 자동 번역. */
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
      <ToolbarToggleGroup />
    </div>
  );
}
