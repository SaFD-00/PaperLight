"use client";

import { ToolbarNavGroup } from "./toolbar/ToolbarNavGroup";
import { ToolbarSettingsGroup } from "./toolbar/ToolbarSettingsGroup";
import { ToolbarToggleGroup } from "./toolbar/ToolbarToggleGroup";
import { ToolbarZoomControl } from "./toolbar/ToolbarZoomControl";

export function TopToolbar() {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-3">
      <ToolbarNavGroup />
      <ToolbarZoomControl />
      <div className="flex items-center gap-1">
        <ToolbarToggleGroup />
        <ToolbarSettingsGroup />
      </div>
    </div>
  );
}
