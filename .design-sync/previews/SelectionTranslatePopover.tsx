import { SelectionTranslatePopover, useReader } from "paperlight-frontend";

// 팝오버는 mount 시 streamSse("/api/translate")로 SSE 토큰을 받는다. 캡처 환경엔
// 백엔드가 없으므로 window.fetch 를 SSE ReadableStream 으로 스텁해 완료 상태를 보여준다.
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
stubSse("/api/translate", ["선형 ", "복잡도로 ", "시퀀스 ", "길이에 ", "비례하는 ", "희소 ", "어텐션 ", "메커니즘을 ", "제안한다."]);

const hostRect = {
  left: 120,
  top: 90,
  right: 320,
  bottom: 110,
  width: 200,
  height: 20,
};

/** 선택 텍스트의 한국어 번역 결과를 띄우는 작은 팝오버(우측 상단 닫기). */
export function Open() {
  useReader.setState({
    translateSelection: {
      text: "We propose a sparse attention mechanism that scales linearly with sequence length.",
      hostRect,
    },
  });
  return (
    <div
      style={{
        position: "relative",
        width: 420,
        height: 220,
        background: "var(--bg-base)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <SelectionTranslatePopover />
    </div>
  );
}
