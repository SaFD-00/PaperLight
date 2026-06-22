import { ResizeHandle } from "paperlight-frontend";

const noop = () => {};

/** 좌측 사이드바 우측 모서리 핸들 — 오른쪽으로 끌면 넓어진다. */
export function SidebarRight() {
  return (
    <div style={{ display: "flex", height: 220, background: "var(--bg-base)" }}>
      <div
        style={{
          position: "relative",
          width: 200,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          padding: 12,
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        목차
        <ResizeHandle side="right" width={200} onChange={noop} />
      </div>
      <div style={{ flex: 1, padding: 16, fontSize: 13, color: "var(--text-muted)" }}>
        본문 영역
      </div>
    </div>
  );
}

/** 우측 AI 패널 좌측 모서리 핸들 — 왼쪽으로 끌면 넓어진다. */
export function PanelLeft() {
  return (
    <div style={{ display: "flex", height: 220, background: "var(--bg-base)" }}>
      <div style={{ flex: 1, padding: 16, fontSize: 13, color: "var(--text-muted)" }}>
        본문 영역
      </div>
      <div
        style={{
          position: "relative",
          width: 240,
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-subtle)",
          padding: 12,
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        <ResizeHandle side="left" width={240} onChange={noop} />
        AI 패널
      </div>
    </div>
  );
}
