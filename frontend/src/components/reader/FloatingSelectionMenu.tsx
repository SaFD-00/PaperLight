"use client";

import { Languages, Lightbulb, Quote } from "lucide-react";
import { useReader } from "@/stores/reader";

export function FloatingSelectionMenu() {
  const selection = useReader((s) => s.selection);
  const triggerExplain = useReader((s) => s.triggerExplain);

  if (!selection) return null;

  const { hostRect, text } = selection;
  const top = Math.max(hostRect.top - 44, 8);
  const left = hostRect.left + hostRect.width / 2;

  return (
    <div
      role="toolbar"
      aria-label="선택 액션"
      className="pointer-events-auto fixed z-50 -translate-x-1/2 rounded-md border border-border-default bg-bg-surface shadow-md"
      style={{ top, left }}
    >
      <div className="flex items-center gap-px p-1 text-xs">
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
          onClick={() => triggerExplain(text)}
          aria-label="선택 설명"
        >
          <Lightbulb className="size-3.5" aria-hidden /> 설명
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-text-muted hover:bg-bg-muted"
          disabled
          title="Phase 1"
          aria-label="번역"
        >
          <Languages className="size-3.5" aria-hidden /> 번역
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-text-muted hover:bg-bg-muted"
          disabled
          title="Phase 1"
          aria-label="인용"
        >
          <Quote className="size-3.5" aria-hidden /> 인용
        </button>
      </div>
    </div>
  );
}
