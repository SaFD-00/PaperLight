"use client";

import clsx from "clsx";
import { Check, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Density, type Theme, useSettings } from "@/stores/settings";

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

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);
  const setTheme = useSettings((s) => s.setTheme);
  const setDensity = useSettings((s) => s.setDensity);

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
          <p className="px-2 pb-1 pt-1 text-[10px] text-text-muted">
            Phase 0 — 본격 Settings 화면은 Phase 1
          </p>
        </div>
      )}
    </div>
  );
}
