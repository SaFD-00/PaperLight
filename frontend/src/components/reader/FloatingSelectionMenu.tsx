"use client";

import { Copy, Highlighter, Languages, Lightbulb, MessageSquare } from "lucide-react";
import { useState } from "react";
import { HighlightColorPalette } from "@/components/reader/HighlightColorPalette";
import { useMarkup } from "@/stores/markup";
import { useReader } from "@/stores/reader";

export function FloatingSelectionMenu({ paperId }: { paperId: string }) {
  const selection = useReader((s) => s.selection);
  const setSelection = useReader((s) => s.setSelection);
  const triggerExplain = useReader((s) => s.triggerExplain);
  const triggerAsk = useReader((s) => s.triggerAsk);
  const triggerTranslateSelection = useReader((s) => s.triggerTranslateSelection);
  const addHighlight = useMarkup((s) => s.addHighlight);
  const [showPalette, setShowPalette] = useState(false);

  if (!selection) return null;

  const { hostRect, text, page, rects } = selection;
  const top = Math.max(hostRect.top - 44, 8);
  const left = hostRect.left + hostRect.width / 2;

  async function pickColor(color: string) {
    if (!selection) return;
    await addHighlight(paperId, {
      page: page ?? 1,
      bbox: { rects },
      text,
      color,
    });
    setShowPalette(false);
    setSelection(null);
  }

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
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
          onClick={() => triggerTranslateSelection({ text, hostRect })}
          aria-label="선택 번역"
        >
          <Languages className="size-3.5" aria-hidden /> 번역
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
          onClick={() => triggerAsk(text)}
          aria-label="선택 질문"
        >
          <MessageSquare className="size-3.5" aria-hidden /> Ask
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
          onClick={() => setShowPalette((v) => !v)}
          aria-label="하이라이트"
          aria-pressed={showPalette}
        >
          <Highlighter className="size-3.5" aria-hidden /> 하이라이트
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-bg-muted"
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setSelection(null);
          }}
          aria-label="복사"
        >
          <Copy className="size-3.5" aria-hidden /> 복사
        </button>
        {showPalette && <HighlightColorPalette onPick={pickColor} />}
      </div>
    </div>
  );
}
