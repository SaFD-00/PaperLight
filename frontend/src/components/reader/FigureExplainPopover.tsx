"use client";

import { ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/common/Markdown";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export function FigureExplainPopover({ paperId }: { paperId: string }) {
  const fig = useReader((s) => s.figureExplain);
  const clear = useReader((s) => s.clearFigureExplain);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"streaming" | "done" | "error">("streaming");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!fig) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setContent("");
    setStatus("streaming");
    streamSse(
      "/api/explain/figure",
      {
        kind: fig.kind,
        image: fig.imageDataUrl,
        label: fig.label,
        captionText: fig.captionText,
        paperId,
        page: fig.page,
      },
      {
        onToken: (t) => setContent((prev) => prev + t),
        onDone: () => setStatus("done"),
        onError: () => setStatus("error"),
      },
      ctrl.signal,
    );
    return () => ctrl.abort();
  }, [fig, paperId]);

  if (!fig) return null;

  const title = fig.kind === "table" ? "표 분석" : "그림 분석";
  const top = Math.min(fig.hostRect.bottom + 8, window.innerHeight - 380);
  const left = Math.min(
    Math.max(fig.hostRect.left + fig.hostRect.width / 2, 220),
    window.innerWidth - 220,
  );

  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed z-50 flex max-h-[26rem] w-[26rem] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border-default bg-bg-surface shadow-lg"
      style={{ top, left }}
    >
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-2.5 py-1.5 text-xs text-text-secondary">
        <ImageIcon className="size-3.5" aria-hidden />
        <span className="font-semibold">{title}</span>
        {fig.label && <span className="text-text-muted">· {fig.label}</span>}
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            clear();
          }}
          aria-label={`${title} 닫기`}
          className="ml-auto rounded p-0.5 hover:bg-bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="overflow-y-auto px-3 py-2 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- crop은 in-memory dataURL이라 next/image 부적합 */}
        <img
          src={fig.imageDataUrl}
          alt={fig.label || title}
          className="mb-2 w-full rounded border border-border-subtle bg-white object-contain"
        />
        {status === "streaming" && content === "" && (
          <p className="text-text-muted">분석 중…</p>
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
