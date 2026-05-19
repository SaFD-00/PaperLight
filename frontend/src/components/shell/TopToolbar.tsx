"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  ChevronLeft,
  Globe,
  Image as ImageIcon,
  ListTree,
  Menu,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Type,
  UserRound,
  Wand2,
  Zap,
} from "lucide-react";
import { type Density, type Theme, useSettings } from "@/stores/settings";
import { useReader } from "@/stores/reader";

type ToggleId = "auto-hl" | "image-desc" | "paragraph" | "skim" | "translate";

const TOGGLES: { id: ToggleId; label: string; short: string; icon: typeof Wand2 }[] = [
  { id: "auto-hl", label: "오토 하이라이트 (A)", short: "A", icon: Wand2 },
  { id: "image-desc", label: "이미지 설명 (G)", short: "G", icon: ImageIcon },
  { id: "paragraph", label: "단락 설명 (P)", short: "P", icon: Type },
  { id: "skim", label: "Quick Skim (K)", short: "K", icon: Zap },
  { id: "translate", label: "자동 번역 (T)", short: "T", icon: Globe },
];

const THEME_CYCLE: Theme[] = ["auto", "light", "dark"];
const DENSITY_CYCLE: Density[] = ["compact", "cozy", "spacious"];

function cycle<T>(arr: T[], current: T): T {
  const idx = arr.indexOf(current);
  return arr[(idx + 1) % arr.length];
}

export function TopToolbar() {
  const [active, setActive] = useState<Record<ToggleId, boolean>>({
    "auto-hl": false,
    "image-desc": false,
    paragraph: false,
    skim: false,
    translate: false,
  });

  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);
  const setTheme = useSettings((s) => s.setTheme);
  const setDensity = useSettings((s) => s.setDensity);

  const translationEnabled = useReader((s) => s.translationEnabled);
  const toggleTranslation = useReader((s) => s.toggleTranslation);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-3">
      <div className="flex items-center gap-1">
        <IconButton label="목차 토글">
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton label="썸네일">
          <Menu size={16} />
        </IconButton>
        <IconButton label="페이지 내 검색">
          <Search size={16} />
        </IconButton>
      </div>

      <div className="flex items-center gap-3 text-text-secondary">
        <span className="font-mono text-xs">3 / 45</span>
        <div className="flex items-center rounded-md border border-border-subtle bg-bg-base">
          <button
            type="button"
            aria-label="축소"
            className="grid h-7 w-7 place-items-center hover:text-text-primary"
          >
            <Minus size={14} />
          </button>
          <span className="px-1 font-mono text-xs">100%</span>
          <button
            type="button"
            aria-label="확대"
            className="grid h-7 w-7 place-items-center hover:text-text-primary"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1">
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
                    : "text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                )}
                title={t.label}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>

        <IconButton label={`테마: ${theme}`} onClick={() => setTheme(cycle(THEME_CYCLE, theme))}>
          <span className="text-[11px] font-medium">
            {theme === "auto" ? "🌓" : theme === "dark" ? "🌙" : "☀️"}
          </span>
        </IconButton>
        <IconButton
          label={`Density: ${density}`}
          onClick={() => setDensity(cycle(DENSITY_CYCLE, density))}
        >
          <ListTree size={14} />
        </IconButton>
        <IconButton label="명령 팔레트 (⌘K)">
          <Search size={14} />
        </IconButton>
        <IconButton label="더보기">
          <MoreHorizontal size={14} />
        </IconButton>
        <IconButton label="계정">
          <UserRound size={14} />
        </IconButton>
        <IconButton label="재생">
          <Play size={14} />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
    >
      {children}
    </button>
  );
}
