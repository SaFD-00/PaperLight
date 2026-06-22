import { InsightsPanel } from "paperlight-frontend";

// 런타임 백엔드 fetch(`/insights` → {paragraphs, figures, highlights})를 window.fetch
// 스텁으로 mock. paperId 로 ready/empty 분기.
const INSIGHTS = {
  highlights:
    "이 논문의 핵심은 **선형 어텐션**으로 추론 비용을 줄이면서도 정확도를 유지했다는 점이다.",
  figures: [
    { chunkId: "f1", page: 4, kind: "figure", description: "**Figure 2.** 시퀀스 길이별 지연시간 — 선형 vs 표준 어텐션." },
    { chunkId: "t1", page: 7, kind: "table", description: "**Table 1.** GLUE 벤치마크 점수 비교 (정확도 손실 < 0.3%)." },
  ],
  paragraphs: [
    { chunkId: "p1", page: 3, importance: "Critical", description: "선형 어텐션 근사의 핵심 수식과 오차 한계를 유도한다." },
    { chunkId: "p2", page: 5, importance: "Important", description: "상대 위치 인코딩이 길이 일반화에 기여함을 ablation으로 보인다." },
    { chunkId: "p3", page: 9, importance: null, description: "한계: 매우 짧은 시퀀스에선 이득이 작다." },
  ],
};

function stub() {
  if (typeof window === "undefined") return;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" ? input : (input as Request).url ?? input);
    if (url.includes("/insights")) {
      const body = url.includes("/empty/")
        ? { paragraphs: [], figures: [], highlights: null }
        : INSIGHTS;
      return Promise.resolve(
        new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
      );
    }
    return orig(input as Request, init);
  }) as typeof fetch;
}
stub();

const frame = { width: 340, height: 560, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" } as const;

/** Auto Highlights · Figures & Tables · Paragraph Insights 전 섹션. */
export function WithInsights() {
  return <div style={frame}><InsightsPanel paperId="demo" /></div>;
}

/** 통찰 미생성 — 빈 상태. */
export function Empty() {
  return <div style={frame}><InsightsPanel paperId="empty" /></div>;
}
