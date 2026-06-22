import { ToolbarSettingsGroup } from "paperlight-frontend";

/** 툴바 우측 그룹 — 테마 · 밀도 · 명령 팔레트 · AI 패널 · 설정 메뉴. */
export function OnToolbar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        height: 48,
        padding: "0 12px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <ToolbarSettingsGroup />
    </div>
  );
}
