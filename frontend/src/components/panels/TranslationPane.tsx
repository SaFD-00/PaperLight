"use client";

import { Languages, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Sentence, splitSentences } from "@/lib/text/sentences";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export function TranslationPane({ paperId }: { paperId: string }) {
  const setTranslation = useReader((s) => s.setTranslation);
  const currentPage = useReader((s) => s.currentPage);
  const pageText = useReader((s) => s.pageText[currentPage] ?? "");
  const setLinkedHighlight = useReader((s) => s.setLinkedHighlight);
  const hoveredSentence = useReader((s) => s.hoveredSentence);

  const sentences = useMemo<Sentence[]>(() => splitSentences(pageText), [pageText]);
  const [pairs, setPairs] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 페이지 텍스트가 준비되면 문장 단위 정렬 번역을 스트리밍.
  useEffect(() => {
    if (sentences.length === 0) {
      setPairs({});
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPairs({});
    setError(null);
    setStatus("streaming");
    streamSse(
      "/api/translate",
      {
        sentences: sentences.map((s) => s.text),
        aligned: true,
        targetLang: "ko",
        paperId,
        page: currentPage,
      },
      {
        onToken: () => {},
        onMeta: (ev) => {
          const pair = ev.pair as { i: number; tgt: string } | undefined;
          if (pair && typeof pair.i === "number") {
            setPairs((prev) => ({ ...prev, [pair.i]: pair.tgt }));
          }
        },
        onDone: () => setStatus("done"),
        onError: (err) => {
          setError(err);
          setStatus("error");
        },
      },
      ctrl.signal,
    );
    return () => ctrl.abort();
  }, [sentences, currentPage, paperId]);

  // 패널 닫힐 때 PDF 교차 하이라이트 정리.
  useEffect(() => () => setLinkedHighlight(null), [setLinkedHighlight]);

  // PDF 본문 hover → 대응 한국어 문장 index.
  const hoveredIdx = useMemo(() => {
    if (!hoveredSentence || hoveredSentence.page !== currentPage) return null;
    const off = hoveredSentence.offset;
    const idx = sentences.findIndex((s) => off >= s.start && off < s.end);
    return idx >= 0 ? idx : null;
  }, [hoveredSentence, currentPage, sentences]);

  // PDF에서 가리킨 문장이 패널 밖이면 보이도록 스크롤.
  useEffect(() => {
    if (hoveredIdx == null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-i="${hoveredIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hoveredIdx]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          <Languages className="size-3.5" aria-hidden />
          해석 · 페이지 {currentPage}
        </h2>
        <button
          type="button"
          className="rounded p-1 text-text-muted hover:bg-bg-muted hover:text-text-primary"
          onClick={() => {
            abortRef.current?.abort();
            setLinkedHighlight(null);
            setTranslation(false);
          }}
          aria-label="해석 닫기"
        >
          <X className="size-3.5" />
        </button>
      </header>
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 text-sm leading-relaxed">
        {sentences.length === 0 && <p className="text-text-muted">페이지 텍스트 추출 중…</p>}
        {status === "error" && (
          <p className="rounded bg-danger/10 p-2 text-danger">에러: {error ?? "unknown"}</p>
        )}
        {sentences.map((s, i) => {
          const tgt = pairs[i];
          return (
            <span
              key={i}
              data-i={i}
              onMouseEnter={() =>
                setLinkedHighlight({ page: currentPage, startOffset: s.start, endOffset: s.end })
              }
              onMouseLeave={() => setLinkedHighlight(null)}
              className={
                hoveredIdx === i
                  ? "cursor-default rounded bg-text-primary/10 text-text-primary"
                  : "cursor-default rounded text-text-primary hover:bg-text-primary/5"
              }
            >
              {tgt ?? (
                <span className="text-text-muted">{status === "streaming" ? "…" : s.text}</span>
              )}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
}
