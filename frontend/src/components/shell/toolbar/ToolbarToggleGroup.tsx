"use client";

import clsx from "clsx";
import { Globe, Image as ImageIcon, Type, Wand2, Zap } from "lucide-react";
import { useState } from "react";
import { useReader } from "@/stores/reader";

type ToggleId = "auto-hl" | "image-desc" | "paragraph" | "skim" | "translate";

const TOGGLES: { id: ToggleId; label: string; short: string; icon: typeof Wand2 }[] = [
  { id: "auto-hl", label: "오토 하이라이트 (A)", short: "A", icon: Wand2 },
  { id: "image-desc", label: "이미지 설명 (G)", short: "G", icon: ImageIcon },
  { id: "paragraph", label: "단락 설명 (P)", short: "P", icon: Type },
  { id: "skim", label: "Quick Skim (K)", short: "K", icon: Zap },
  { id: "translate", label: "자동 번역 (T)", short: "T", icon: Globe },
];

/** AI 기능 토글 묶음 — translate만 전역 상태, 나머지는 로컬(미구현 placeholder). */
export function ToolbarToggleGroup() {
  const [active, setActive] = useState<Record<ToggleId, boolean>>({
    "auto-hl": false,
    "image-desc": false,
    paragraph: false,
    skim: false,
    translate: false,
  });
  const translationEnabled = useReader((s) => s.translationEnabled);
  const toggleTranslation = useReader((s) => s.toggleTranslation);

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-bg-base p-0.5">
      {TOGGLES.map((t) => {
        const Icon = t.icon;
        const on = t.id === "translate" ? translationEnabled : active[t.id];
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-pressed={on}
            onClick={() => {
              if (t.id === "translate") toggleTranslation();
              else setActive((s) => ({ ...s, [t.id]: !s[t.id] }));
            }}
            className={clsx(
              "grid h-7 w-7 place-items-center rounded-sm text-[11px] font-semibold transition-colors",
              on
                ? "bg-brand-primary text-white"
                : "text-text-secondary hover:bg-bg-muted hover:text-text-primary",
            )}
            title={t.label}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
