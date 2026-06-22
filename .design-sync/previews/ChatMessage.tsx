import { ChatMessage } from "paperlight-frontend";

const noop = () => {};

/** 사용자 질문 버블 + 인용 칩이 달린 AI 답변 버블(마크다운). */
export function Conversation() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 380, padding: 12, background: "var(--bg-surface)" }}>
      <ChatMessage message={{ role: "user", content: "이 논문의 핵심 기여가 뭐야?" }} onJump={noop} />
      <ChatMessage
        message={{
          role: "assistant",
          content:
            "이 논문은 **세 가지** 기여를 합니다:\n\n1. 표준 Transformer 대비 추론 비용을 절반으로 줄인 구조\n2. 길이 일반화를 위한 상대 위치 인코딩\n3. 공개 벤치마크에서의 SOTA 달성",
          citations: [
            { chunkId: "c1", page: 2 },
            { chunkId: "c2", page: 5 },
            { chunkId: "c3", page: 11 },
          ],
        }}
        onJump={noop}
      />
    </div>
  );
}

/** 짧은 단일 답변(인용 없음). */
export function AssistantOnly() {
  return (
    <div style={{ width: 380, padding: 12, background: "var(--bg-surface)" }}>
      <ChatMessage
        message={{ role: "assistant", content: "네, 4.2절에서 ablation 결과로 그 가설을 직접 검증합니다." }}
        onJump={noop}
      />
    </div>
  );
}
