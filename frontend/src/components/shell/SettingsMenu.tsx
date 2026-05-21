"use client";

import clsx from "clsx";
import { Check, Minus, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type Density,
  READER_FONT_SCALE_MAX,
  READER_FONT_SCALE_MIN,
  READER_FONT_SCALE_STEP,
  type Theme,
  type TranslationFontFamily,
  useSettings,
} from "@/stores/settings";

const THEMES: { value: Theme; label: string }[] = [
  { value: "auto", label: "Auto (시스템 설정)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DENSITIES: { value: Density; label: string; rowH: string }[] = [
  { value: "compact", label: "Compact", rowH: "28px" },
  { value: "cozy", label: "Cozy", rowH: "40px" },
  { value: "spacious", label: "Spacious", rowH: "56px" },
];

const TRANSLATION_FONTS: { value: TranslationFontFamily; label: string }[] = [
  { value: "sans", label: "Sans (Pretendard)" },
  { value: "serif", label: "Serif (본명조)" },
];

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);
  const translationFontFamily = useSettings((s) => s.translationFontFamily);
  const readerFontScale = useSettings((s) => s.readerFontScale);
  const setTheme = useSettings((s) => s.setTheme);
  const setDensity = useSettings((s) => s.setDensity);
  const setTranslationFontFamily = useSettings((s) => s.setTranslationFontFamily);
  const setReaderFontScale = useSettings((s) => s.setReaderFontScale);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="설정"
        aria-haspopup="menu"
        aria-expanded={open}
        title="설정"
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-40 w-56 rounded-md border border-border-default bg-bg-surface p-2 shadow-lg"
        >
          <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Theme
          </p>
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.value}
              onClick={() => setTheme(t.value)}
              className={clsx(
                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-bg-muted",
                theme === t.value && "text-brand-primary",
              )}
            >
              <span>{t.label}</span>
              {theme === t.value && <Check className="size-3.5" />}
            </button>
          ))}

          <div className="my-1 h-px bg-border-subtle" />
          <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Density
          </p>
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              type="button"
              role="menuitemradio"
              aria-checked={density === d.value}
              onClick={() => setDensity(d.value)}
              className={clsx(
                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-bg-muted",
                density === d.value && "text-brand-primary",
              )}
            >
              <span>
                {d.label}
                <span className="ml-2 text-[10px] text-text-muted">{d.rowH}</span>
              </span>
              {density === d.value && <Check className="size-3.5" />}
            </button>
          ))}

          <div className="my-1 h-px bg-border-subtle" />
          <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            번역 글꼴
          </p>
          {TRANSLATION_FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="menuitemradio"
              aria-checked={translationFontFamily === f.value}
              onClick={() => setTranslationFontFamily(f.value)}
              className={clsx(
                "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-bg-muted",
                translationFontFamily === f.value && "text-brand-primary",
              )}
            >
              <span>{f.label}</span>
              {translationFontFamily === f.value && <Check className="size-3.5" />}
            </button>
          ))}

          <div className="my-1 h-px bg-border-subtle" />
          <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            리더 글꼴 크기
          </p>
          <div className="flex items-center justify-between px-2 py-1">
            <button
              type="button"
              aria-label="글꼴 작게"
              disabled={readerFontScale <= READER_FONT_SCALE_MIN}
              onClick={() => setReaderFontScale(readerFontScale - READER_FONT_SCALE_STEP)}
              className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:bg-bg-muted hover:text-text-primary disabled:opacity-40"
            >
              <Minus size={12} />
            </button>
            <span className="font-mono text-xs tabular-nums text-text-primary">
              {Math.round(readerFontScale * 100)}%
            </span>
            <button
              type="button"
              aria-label="글꼴 크게"
              disabled={readerFontScale >= READER_FONT_SCALE_MAX}
              onClick={() => setReaderFontScale(readerFontScale + READER_FONT_SCALE_STEP)}
              className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:bg-bg-muted hover:text-text-primary disabled:opacity-40"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
