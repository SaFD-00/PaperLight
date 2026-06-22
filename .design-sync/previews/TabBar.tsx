import { TabBar } from "paperlight-frontend";

/** 탭 스트립 — store 기본 상태(라이브러리 탭 + "새 탭" 버튼)를 전체 폭으로 렌더. */
export function Default() {
  return (
    <div style={{ width: 900, background: "var(--bg-base)" }}>
      <TabBar />
    </div>
  );
}
