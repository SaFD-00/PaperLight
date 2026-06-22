import { ChatEmptyState } from "paperlight-frontend";

const noop = () => {};

/** 대화 시작 전 안내 + 빠른 질문 칩(논문 영역에 맞춘 기본 프롬프트). */
export function Default() {
  return (
    <div style={{ width: 360, height: 280, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <ChatEmptyState onPick={noop} />
    </div>
  );
}

/** 좁은 사이드 패널 폭(~300px)에서 칩이 줄바꿈되는 모습. */
export function NarrowPanel() {
  return (
    <div style={{ width: 300, height: 240, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <ChatEmptyState onPick={noop} />
    </div>
  );
}
