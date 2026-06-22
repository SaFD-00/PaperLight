import { SelectionExplainPopover, useReader } from "paperlight-frontend";

// mount 시 streamSse("/api/explain")로 SSE 토큰 수신 → window.fetch SSE 스텁으로 완료 상태 표시.
function stubSse(match: string, tokens: string[]) {
  if (typeof window === "undefined") return;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" ? input : (input as Request)?.url ?? input);
    if (url.includes(match)) {
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        start(c) {
          for (const t of tokens) c.enqueue(enc.encode(`data: ${JSON.stringify({ token: t })}\n\n`));
          c.enqueue(enc.encode("data: [DONE]\n\n"));
          c.close();
        },
      });
      return Promise.resolve(new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } }));
    }
    return orig(input as Request, init);
  }) as typeof fetch;
}
stubSse("/api/explain", [
  "**Ablation study**(제거 실험)는 ",
  "모델의 각 구성요소를 ",
  "하나씩 제거하며 ",
  "성능 변화를 측정해 ",
  "그 요소의 기여도를 ",
  "정량화하는 방법입니다.",
]);

const hostRect = {
  left: 150,
  top: 80,
  right: 360,
  bottom: 100,
  width: 210,
  height: 20,
};

/** 선택 텍스트에 대한 AI 설명을 스트리밍하는 팝오버(헤더 "설명" + 닫기). */
export function Open() {
  useReader.setState({
    explainSelection: {
      text: "ablation study",
      hostRect,
    },
  });
  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 320,
        background: "var(--bg-base)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <SelectionExplainPopover />
    </div>
  );
}
