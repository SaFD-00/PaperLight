"use client";

import clsx from "clsx";
import { ListTree, PanelRight, Search } from "lucide-react";
import { SettingsMenu } from "@/components/shell/SettingsMenu";
import { cycle, DENSITY_CYCLE, THEME_CYCLE } from "@/lib/cycle";
import { useCommand } from "@/stores/command";
import { useReader } from "@/stores/reader";
import { useSettings } from "@/stores/settings";
import { IconButton } from "./IconButton";

/** 우측 그룹 — 테마/밀도/명령 팔레트/AI 패널/설정. */
export function ToolbarSettingsGroup() {
  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);
  const setTheme = useSettings((s) => s.setTheme);
  const setDensity = useSettings((s) => s.setDensity);

  const aiPanelOpen = useReader((s) => s.aiPanelOpen);
  const toggleAiPanel = useReader((s) => s.toggleAiPanel);

  return (
    <>
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
            : "text-text-secondary hover:bg-bg-muted hover:text-text-primary",
        )}
      >
        <PanelRight size={14} />
      </button>
      <SettingsMenu />
    </>
  );
}
