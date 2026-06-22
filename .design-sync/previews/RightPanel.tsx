import { RightPanel } from "paperlight-frontend";

// RightPanel 기본 탭은 Summary → SummaryPanel 이 mount 시 localhost:8000 백엔드로 fetch.
// 패널 프리뷰들과 동일하게 window.fetch 를 스텁해 `/summary` 응답(`{text}`)을 mock 주입한다.
const SUMMARY =
  "## 핵심 요약\n\n이 논문은 표준 Transformer의 추론 비용 문제를 다룬다. 저자들은 **선형 어텐션** 근사를 도입해 시퀀스 길이에 대해 O(n) 복잡도를 달성하고, 공개 벤치마크에서 정확도 손실 없이 2.1× 처리량 향상을 보고한다.\n\n- 상대 위치 인코딩으로 길이 일반화 강화\n- 추론 메모리 40% 절감\n- 코드·체크포인트 공개";

function stub() {
  if (typeof window === "undefined") return;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" ? input : (input as Request).url ?? input);
    if (url.includes("/summary")) {
      return Promise.resolve(
        new Response(JSON.stringify({ text: SUMMARY }), {
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return orig(input as Request, init);
  }) as typeof fetch;
}
stub();

/** 우측 AI 패널 — 탭 바(Summary·Insights·Chat·References·Notes) + Summary 요약 본문. */
export function Default() {
  return (
    <div
      style={{
        height: 560,
        display: "flex",
        justifyContent: "flex-end",
        background: "var(--bg-muted)",
      }}
    >
      <RightPanel paperId="demo" />
    </div>
  );
}

/** 좁은 리더 폭 안에서의 패널 — 탭 아이콘 정렬/요약 영역 레이아웃 확인. */
export function InReaderColumn() {
  return (
    <div
      style={{
        width: 380,
        height: 520,
        display: "flex",
        background: "var(--bg-muted)",
      }}
    >
      <RightPanel paperId="demo" />
    </div>
  );
}
