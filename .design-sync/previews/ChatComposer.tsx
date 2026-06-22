import { ChatComposer } from "paperlight-frontend";

const noop = () => {};

/** 빈 입력창 — placeholder 와 비활성(전송 불가) 전송 버튼. */
export function Empty() {
  return (
    <div style={{ width: 380, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <ChatComposer input="" setInput={noop} onSend={noop} disabled={true} />
    </div>
  );
}

/** 입력 중 — 텍스트가 채워져 전송 버튼이 활성화된 상태. */
export function Typing() {
  return (
    <div style={{ width: 380, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <ChatComposer
        input="이 논문의 ablation study에서 가장 영향이 큰 컴포넌트는 무엇인가요?"
        setInput={noop}
        onSend={noop}
        disabled={false}
      />
    </div>
  );
}

/** 여러 줄 입력 — 내용에 따라 높이가 자동 확장(최대 6줄). */
export function MultiLine() {
  return (
    <div style={{ width: 380, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <ChatComposer
        input={"제안한 방법론을 우리 데이터셋에 적용하려면\n어떤 전처리가 필요한가요?\n특히 긴 문서 처리 관점에서\n위치 인코딩 부분을 설명해 주세요."}
        setInput={noop}
        onSend={noop}
        disabled={false}
      />
    </div>
  );
}

/** 응답 생성 중 — 입력은 있으나 스트리밍 동안 전송이 비활성화된 상태. */
export function Sending() {
  return (
    <div style={{ width: 380, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
      <ChatComposer
        input="한 가지 더 — 이 결과가 한국어 코퍼스에도 일반화될까요?"
        setInput={noop}
        onSend={noop}
        disabled={true}
      />
    </div>
  );
}
