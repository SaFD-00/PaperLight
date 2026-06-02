import type { HostToIframeMessage } from "@/lib/pdf/messages";
import { HOST_SOURCE } from "@/lib/pdf/messages";
import { streamSse } from "@/lib/sse";
import { type Sentence, splitSentences } from "@/lib/text/sentences";

/** 페이지별 번역 진행 상태 캐시(렌더는 iframe 컬럼이 담당, host는 데이터 펌프). */
export interface PageTranslation {
  sentences: Sentence[];
  pairs: Record<number, string>;
  status: "streaming" | "done" | "error";
  ctrl: AbortController;
}

/**
 * 본문(필터된) 텍스트 → 문장 정렬 번역 스트리밍 → iframe 컬럼으로 push.
 * 이미 스트리밍/완료된 페이지(컬럼 DOM은 iframe이 유지)거나 문장이 없으면 no-op.
 */
export function streamPageTranslation(args: {
  page: number;
  text: string;
  paperId: string;
  cache: Map<number, PageTranslation>;
  postToIframe: (msg: HostToIframeMessage) => void;
}): void {
  const { page, text, paperId, cache, postToIframe } = args;
  if (cache.has(page)) return;
  const sentences = splitSentences(text);
  if (sentences.length === 0) return;
  const ctrl = new AbortController();
  const entry: PageTranslation = { sentences, pairs: {}, status: "streaming", ctrl };
  cache.set(page, entry);
  streamSse(
    "/api/translate",
    {
      sentences: sentences.map((s) => s.text),
      aligned: true,
      targetLang: "ko",
      paperId,
      page,
    },
    {
      onToken: () => {},
      onMeta: (ev) => {
        const pair = ev.pair as { i: number; tgt: string } | undefined;
        if (!pair || typeof pair.i !== "number") return;
        const s = entry.sentences[pair.i];
        if (!s) return;
        const isFirst = Object.keys(entry.pairs).length === 0;
        entry.pairs[pair.i] = pair.tgt;
        postToIframe({
          source: HOST_SOURCE,
          type: "RENDER_TRANSLATION",
          page,
          pairs: [{ i: pair.i, tgt: pair.tgt, bodyStart: s.start, bodyEnd: s.end }],
          replace: isFirst,
        });
      },
      onDone: () => {
        entry.status = "done";
      },
      onError: () => {
        entry.status = "error";
      },
    },
    ctrl.signal,
  );
}
