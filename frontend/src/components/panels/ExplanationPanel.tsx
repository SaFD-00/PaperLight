"use client";

import { Lightbulb, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export function ExplanationPanel() {
  const explainText = useReader((s) => s.explainText);
  const clearExplain = useReader((s) => s.clearExplain);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!explainText) {
      setContent("");
      setStatus("idle");
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setContent("");
    setError(null);
    setStatus("streaming");
    streamSse(
      "/api/explain",
      { text: explainText },
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
  }, [explainText]);

  if (!explainText) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-text-muted">
        <Lightbulb className="size-5 opacity-60" aria-hidden />
        <p>PDF에서 텍스트를 선택하고 [💡 설명]을 누르세요.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Explanation
        </h2>
        <button
          type="button"
          className="rounded p-1 text-text-muted hover:bg-bg-muted hover:text-text-primary"
          onClick={() => {
            abortRef.current?.abort();
            clearExplain();
          }}
          aria-label="설명 닫기"
        >
          <X className="size-3.5" />
        </button>
      </header>
      <section className="flex-1 overflow-y-auto p-3 text-sm">
        <details className="mb-2 text-xs text-text-muted" open>
          <summary className="cursor-pointer">선택한 단락</summary>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-bg-muted p-2 text-text-secondary">
            {explainText}
          </pre>
        </details>
        {status === "streaming" && content === "" && (
          <p className="text-text-muted">Qwen 응답 대기 중…</p>
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
