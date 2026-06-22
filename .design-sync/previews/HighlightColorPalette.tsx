import { HighlightColorPalette } from "paperlight-frontend";

const noop = () => {};

/** 선택 텍스트에 칠할 형광펜 색을 고르는 5색 스와치 팔레트. */
export function Palette() {
  return (
    <div style={{ padding: 16, background: "var(--bg-surface)" }}>
      <HighlightColorPalette onPick={noop} />
    </div>
  );
}

/** 플로팅 메뉴 안에 인라인으로 붙는 모습(좌측 구분선 포함). */
export function InToolbar() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 10px",
        borderRadius: 8,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>하이라이트</span>
      <HighlightColorPalette onPick={noop} />
    </div>
  );
}
