"use client";

import { Lightbulb, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/common/Markdown";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export function SelectionExplainPopover() {
  const sel = useReader((s) => s.explainSelection);
  const clear = useReader((s) => s.clearExplain);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"streaming" | "done" | "error">("streaming");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sel) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setContent("");
    setStatus("streaming");
    streamSse(
      "/api/explain",
      { text: sel.text },
      {
        onToken: (t) => setContent((prev) => prev + t),
        onDone: () => setStatus("done"),
        onError: () => setStatus("error"),
      },
      ctrl.signal,
    );
    return () => ctrl.abort();
  }, [sel]);

  if (!sel) return null;

  const top = Math.min(sel.hostRect.bottom + 8, window.innerHeight - 340);
  const left = Math.min(
    Math.max(sel.hostRect.left + sel.hostRect.width / 2, 200),
    window.innerWidth - 200,
  );

  return (
    <div
      role="dialog"
      aria-label="선택 설명"
      className="fixed z-50 flex max-h-80 w-96 -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border-default bg-bg-surface shadow-lg"
      style={{ top, left }}
    >
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-2.5 py-1.5 text-xs text-text-secondary">
        <Lightbulb className="size-3.5" aria-hidden />
        <span className="font-semibold">설명</span>
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            clear();
          }}
          aria-label="설명 닫기"
          className="ml-auto rounded p-0.5 hover:bg-bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto px-3 py-2 text-sm">
        {status === "streaming" && content === "" && (
          <p className="text-text-muted">설명 생성 중…</p>
        )}
        {status === "error" && <p className="text-danger">설명 생성에 실패했습니다.</p>}
        {content !== "" && <Markdown>{content}</Markdown>}
        {status === "streaming" && content !== "" && (
          <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-brand-primary align-middle" />
        )}
      </div>
    </div>
  );
}
