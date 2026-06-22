import { SummaryPanel } from "paperlight-frontend";

// 우측 AI 패널은 런타임에 localhost:8000 백엔드로 fetch한다. 프리뷰는 window.fetch를
// 스텁해 실제 API 응답 형태(`{text}`)의 mock을 주입한다. paperId 로 ready/empty 분기.
const SUMMARY =
  "## 핵심 요약\n\n이 논문은 표준 Transformer의 추론 비용 문제를 다룬다. 저자들은 **선형 어텐션** 근사를 도입해 시퀀스 길이에 대해 O(n) 복잡도를 달성하고, 공개 벤치마크에서 정확도 손실 없이 2.1× 처리량 향상을 보고한다.\n\n- 상대 위치 인코딩으로 길이 일반화 강화\n- 추론 메모리 40% 절감\n- 코드·체크포인트 공개";

function stub() {
  if (typeof window === "undefined") return;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" ? input : (input as Request).url ?? input);
    if (url.includes("/summary")) {
      const text = url.includes("/empty/") ? null : SUMMARY;
      return Promise.resolve(
        new Response(JSON.stringify({ text }), { headers: { "content-type": "application/json" } }),
      );
    }
    return orig(input as Request, init);
  }) as typeof fetch;
}
stub();

const frame = { width: 340, height: 520, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" } as const;

/** 요약 생성 완료 — 다층 마크다운 요약. */
export function WithSummary() {
  return <div style={frame}><SummaryPanel paperId="demo" /></div>;
}

/** 아직 요약 미생성 — 빈 상태 안내. */
export function Empty() {
  return <div style={frame}><SummaryPanel paperId="empty" /></div>;
}
