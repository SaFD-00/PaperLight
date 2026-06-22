import { FigureExplainPopover, useReader } from "paperlight-frontend";

// mount 시 streamSse("/api/explain/figure")로 SSE 토큰 수신 → window.fetch SSE 스텁으로 완료 상태 표시.
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
stubSse("/api/explain/figure", [
  "이 그림은 ",
  "사전학습 규모가 커질수록 ",
  "검증 정확도가 ",
  "로그-선형으로 ",
  "향상됨을 보여줍니다. ",
  "특히 10B 토큰 이후 ",
  "기울기가 완만해집니다.",
]);

// 인라인 SVG 막대그래프 crop을 dataURL로 — 실제 PDF figure crop 자리.
const imageDataUrl =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='140'>
       <rect width='320' height='140' fill='#ffffff'/>
       <rect x='30' y='70' width='28' height='50' fill='#4f7cff'/>
       <rect x='80' y='40' width='28' height='80' fill='#4f7cff'/>
       <rect x='130' y='55' width='28' height='65' fill='#4f7cff'/>
       <rect x='180' y='25' width='28' height='95' fill='#4f7cff'/>
       <rect x='230' y='50' width='28' height='70' fill='#4f7cff'/>
       <line x1='20' y1='120' x2='300' y2='120' stroke='#333' stroke-width='1'/>
     </svg>`,
  );

const hostRect = {
  left: 180,
  top: 70,
  right: 420,
  bottom: 90,
  width: 240,
  height: 20,
};

/** Figure crop 미리보기 + AI 분석 대화를 띄우는 팝오버(그림 분석 헤더, 입력창). */
export function Figure() {
  useReader.setState({
    figureExplain: {
      page: 4,
      kind: "figure",
      label: "Figure 3",
      captionText: "Validation accuracy across pretraining scales.",
      imageDataUrl,
      hostRect,
    },
  });
  return (
    <div
      style={{
        position: "relative",
        width: 480,
        height: 540,
        background: "var(--bg-base)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <FigureExplainPopover paperId="2310.06825" />
    </div>
  );
}

/** 표(table) 분석 변형 — 헤더가 "표 분석"으로 바뀐다. */
export function Table() {
  useReader.setState({
    figureExplain: {
      page: 6,
      kind: "table",
      label: "Table 2",
      captionText: "Latency and accuracy comparison against baselines.",
      imageDataUrl,
      hostRect,
    },
  });
  return (
    <div
      style={{
        position: "relative",
        width: 480,
        height: 540,
        background: "var(--bg-base)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <FigureExplainPopover paperId="2310.06825" />
    </div>
  );
}
