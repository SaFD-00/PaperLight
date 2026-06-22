import { Sidebar } from "paperlight-frontend";

/** 좌측 사이드바 — 기본 store 상태(TOC 모드, 목차 비어 있음 안내). */
export function Default() {
  return (
    <div
      style={{
        width: 200,
        height: 480,
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      <Sidebar />
    </div>
  );
}

/** 넓은 폭(드래그 확장 상태)으로 동일 컴포넌트 — 탭/안내 레이아웃 확인. */
export function Wide() {
  return (
    <div
      style={{
        width: 260,
        height: 480,
        background: "var(--bg-base)",
        borderRight: "1px solid var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      <Sidebar />
    </div>
  );
}
