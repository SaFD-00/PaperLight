import { AppShell } from "paperlight-frontend";

/** 앱 최상위 셸 — 탭바·툴바·본문 레이아웃을 실제 store 기본 상태로 렌더. */
export function FullShell() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 900,
        height: 560,
        overflow: "hidden",
        background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
      }}
    >
      <AppShell>
        <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13 }}>
          뷰어 본문 영역 — 라우트별 페이지가 이 자리에 렌더됩니다.
        </div>
      </AppShell>
    </div>
  );
}
