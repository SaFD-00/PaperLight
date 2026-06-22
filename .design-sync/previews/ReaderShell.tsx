import { ReaderShell } from "paperlight-frontend";

// 셸의 우측 RightPanel(Summary 탭)이 mount 시 백엔드 fetch → 패널 프리뷰와 동일하게
// window.fetch 를 스텁해 `/summary` mock 을 주입(컬럼에 실제 요약 본문 표시).
const SUMMARY =
  "## 핵심 요약\n\n이 논문은 표준 Transformer의 추론 비용 문제를 다룬다. 저자들은 **선형 어텐션** 근사를 도입해 정확도 손실 없이 2.1× 처리량 향상을 보고한다.";

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

/** 3-컬럼 리더 셸 — Sidebar(목차) + Center(본문) + RightPanel(Summary) 전체 레이아웃. */
export function Default() {
  return (
    <div
      style={{
        width: 960,
        height: 600,
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <ReaderShell paperId="demo" />
    </div>
  );
}

/** 좁은 뷰포트의 리더 셸 — 컬럼 압축 레이아웃 확인. */
export function Compact() {
  return (
    <div
      style={{
        width: 760,
        height: 540,
        background: "var(--bg-muted)",
        overflow: "hidden",
      }}
    >
      <ReaderShell paperId="demo" />
    </div>
  );
}
