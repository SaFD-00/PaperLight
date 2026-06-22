import { ReferencesPanel } from "paperlight-frontend";

// 런타임 백엔드 fetch(`/references` → ReferenceCard[])를 window.fetch 스텁으로 mock.
// paperId 로 ready/empty 분기.
const REFS = [
  {
    marker: 1,
    raw: "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
    title: "Attention Is All You Need",
    authors: ["A. Vaswani", "N. Shazeer", "N. Parmar"],
    year: 2017,
    abstract: null,
    url: "https://arxiv.org/abs/1706.03762",
    source: "arXiv",
  },
  {
    marker: 2,
    raw: "Devlin et al., BERT, NAACL 2019",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: ["J. Devlin", "M.-W. Chang"],
    year: 2019,
    abstract: null,
    url: "https://arxiv.org/abs/1810.04805",
    source: "arXiv",
  },
  {
    marker: 3,
    raw: "Katharopoulos et al., Transformers are RNNs, ICML 2020",
    title: "Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention",
    authors: ["A. Katharopoulos", "A. Vyas"],
    year: 2020,
    abstract: null,
    url: null,
    source: "DOI",
  },
];

function stub() {
  if (typeof window === "undefined") return;
  const orig = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === "string" ? input : (input as Request).url ?? input);
    if (url.includes("/references")) {
      const body = url.includes("/empty/") ? [] : REFS;
      return Promise.resolve(
        new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
      );
    }
    return orig(input as Request, init);
  }) as typeof fetch;
}
stub();

const frame = { width: 340, height: 520, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" } as const;

/** 참고문헌 카드 목록 — 마커·제목·저자·연도·출처 배지·열기 링크. */
export function WithReferences() {
  return <div style={frame}><ReferencesPanel paperId="demo" /></div>;
}

/** 참고문헌 미발견 — 빈 상태. */
export function Empty() {
  return <div style={frame}><ReferencesPanel paperId="empty" /></div>;
}
