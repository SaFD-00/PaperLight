import { ChatPanel } from "paperlight-frontend";

/**
 * 전체 채팅 패널(헤더 + 대화 영역 + 하단 입력). 정적 프리뷰에선
 * 히스토리 API 가 비어 빈 상태(안내 + 빠른 질문 칩)로 렌더된다.
 */
export function Panel() {
  return (
    <div style={{ width: 340, height: 520, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
      <ChatPanel paperId="demo-paper" />
    </div>
  );
}
