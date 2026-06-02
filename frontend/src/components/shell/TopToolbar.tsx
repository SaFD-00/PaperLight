"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ChevronLeft,
  Globe,
  Image as ImageIcon,
  ListTree,
  LogOut,
  Menu,
  Minus,
  PanelRight,
  Play,
  Plus,
  Search,
  Type,
  UserRound,
  Wand2,
  Zap,
} from "lucide-react";
import { SettingsMenu } from "@/components/shell/SettingsMenu";
import { cycle, DENSITY_CYCLE, THEME_CYCLE } from "@/lib/cycle";
import { useAuth } from "@/stores/auth";
import { useCommand } from "@/stores/command";
import { useSettings } from "@/stores/settings";
import { useReader } from "@/stores/reader";

type ToggleId = "auto-hl" | "image-desc" | "paragraph" | "skim" | "translate";

const TOGGLES: { id: ToggleId; label: string; short: string; icon: typeof Wand2 }[] = [
  { id: "auto-hl", label: "오토 하이라이트 (A)", short: "A", icon: Wand2 },
  { id: "image-desc", label: "이미지 설명 (G)", short: "G", icon: ImageIcon },
  { id: "paragraph", label: "단락 설명 (P)", short: "P", icon: Type },
  { id: "skim", label: "Quick Skim (K)", short: "K", icon: Zap },
  { id: "translate", label: "자동 번역 (T)", short: "T", icon: Globe },
];


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
  const aiPanelOpen = useReader((s) => s.aiPanelOpen);
  const toggleAiPanel = useReader((s) => s.toggleAiPanel);
  const toggleSidebar = useReader((s) => s.toggleSidebar);
  const sidebarOpen = useReader((s) => s.sidebarOpen);
  const setSidebarMode = useReader((s) => s.setSidebarMode);
  const zoom = useReader((s) => s.zoom);
  const zoomIn = useReader((s) => s.zoomIn);
  const zoomOut = useReader((s) => s.zoomOut);
  const currentPage = useReader((s) => s.currentPage);
  const totalPages = useReader((s) => s.totalPages);

  const authUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const isLoggedIn = authUser !== null && !authUser.anonymous;

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-3">
      <div className="flex items-center gap-1">
        <IconButton label="목차 토글" onClick={toggleSidebar}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton
          label="썸네일"
          onClick={() => {
            setSidebarMode("pages");
            if (!sidebarOpen) toggleSidebar();
          }}
        >
          <Menu size={16} />
        </IconButton>
        <IconButton label="페이지 내 검색" onClick={() => useReader.getState().toggleSearch()}>
          <Search size={16} />
        </IconButton>
      </div>

      <div className="flex items-center gap-3 text-text-secondary">
        <span className="font-mono text-xs">
          {totalPages > 0 ? `${currentPage} / ${totalPages}` : "– / –"}
        </span>
        <div className="flex items-center rounded-md border border-border-subtle bg-bg-base">
          <button
            type="button"
            aria-label="축소"
            onClick={zoomOut}
            className="grid h-7 w-7 place-items-center hover:text-text-primary"
          >
            <Minus size={14} />
          </button>
          <span className="px-1 font-mono text-xs">{zoom}%</span>
          <button
            type="button"
            aria-label="확대"
            onClick={zoomIn}
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
        <IconButton label="명령 팔레트 (⌘K)" onClick={() => useCommand.getState().toggle()}>
          <Search size={14} />
        </IconButton>
        <button
          type="button"
          aria-label="AI 패널 토글"
          aria-pressed={aiPanelOpen}
          onClick={toggleAiPanel}
          title="AI 패널 토글"
          className={clsx(
            "grid h-8 w-8 place-items-center rounded-md transition-colors",
            aiPanelOpen
              ? "bg-bg-muted text-text-primary"
              : "text-text-secondary hover:bg-bg-muted hover:text-text-primary"
          )}
        >
          <PanelRight size={14} />
        </button>
        <SettingsMenu />
        {isLoggedIn ? (
          <IconButton
            label={`로그아웃 (${authUser?.email ?? ""})`}
            onClick={() => void logout()}
          >
            <LogOut size={14} />
          </IconButton>
        ) : (
          <Link
            href="/login"
            aria-label="로그인"
            title="로그인"
            className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
          >
            <UserRound size={14} />
          </Link>
        )}
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
