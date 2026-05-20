"use client";

import { Languages, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export function SelectionTranslatePopover() {
  const sel = useReader((s) => s.translateSelection);
  const clear = useReader((s) => s.clearTranslateSelection);
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
      "/api/translate",
      { text: sel.text, targetLang: "ko" },
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

  const top = Math.min(sel.hostRect.bottom + 8, window.innerHeight - 160);
  const left = sel.hostRect.left + sel.hostRect.width / 2;

  return (
    <div
      role="dialog"
      aria-label="선택 번역"
      className="fixed z-50 max-h-40 w-72 -translate-x-1/2 overflow-y-auto rounded-md border border-border-default bg-bg-surface p-2 shadow-lg"
      style={{ top, left }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs text-text-secondary">
        <Languages className="size-3.5" aria-hidden />
        <span className="font-semibold">번역</span>
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            clear();
          }}
          aria-label="번역 닫기"
          className="ml-auto rounded p-0.5 hover:bg-bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
        {content || (status === "error" ? "번역 실패" : "번역 중…")}
      </p>
    </div>
  );
}
