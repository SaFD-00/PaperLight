"use client";

import { Languages, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export function TranslationPane() {
  const enabled = useReader((s) => s.translationEnabled);
  const setTranslation = useReader((s) => s.setTranslation);
  const currentPage = useReader((s) => s.currentPage);
  const pageText = useReader((s) => s.pageText[currentPage] ?? "");

  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !pageText) {
      setContent("");
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setContent("");
    setError(null);
    setStatus("streaming");
    streamSse(
      "/api/translate",
      { text: pageText, targetLang: "ko", page: currentPage },
      {
        onToken: (t) => setContent((prev) => prev + t),
        onDone: () => setStatus("done"),
        onError: (err) => {
          setError(err);
          setStatus("error");
        },
      },
      ctrl.signal,
    );
    return () => ctrl.abort();
  }, [enabled, pageText, currentPage]);

  if (!enabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-text-muted">
        <Languages className="size-5 opacity-60" aria-hidden />
        <p>상단 [T] 토글을 켜면 현재 페이지를 한국어로 번역합니다.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Translation · 페이지 {currentPage}
        </h2>
        <button
          type="button"
          className="rounded p-1 text-text-muted hover:bg-bg-muted hover:text-text-primary"
          onClick={() => {
            abortRef.current?.abort();
            setTranslation(false);
          }}
          aria-label="번역 끄기"
        >
          <X className="size-3.5" />
        </button>
      </header>
      <section className="flex-1 overflow-y-auto p-3 text-sm">
        {!pageText && (
          <p className="text-text-muted">페이지 텍스트 추출 중…</p>
        )}
        {status === "streaming" && content === "" && pageText && (
          <p className="text-text-muted">Qwen 번역 대기 중…</p>
        )}
        {status === "error" && (
          <p className="rounded bg-danger/10 p-2 text-danger">에러: {error ?? "unknown"}</p>
        )}
        <article className="whitespace-pre-wrap leading-relaxed text-text-primary">
          {content}
          {status === "streaming" && (
            <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-brand-primary align-middle" />
          )}
        </article>
      </section>
    </div>
  );
}
