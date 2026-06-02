"use client";

import { ChevronLeft, Menu, Search } from "lucide-react";
import { useReader } from "@/stores/reader";
import { IconButton } from "./IconButton";

/** 좌측 그룹 — 목차/썸네일/페이지 내 검색. */
export function ToolbarNavGroup() {
  const toggleSidebar = useReader((s) => s.toggleSidebar);
  const sidebarOpen = useReader((s) => s.sidebarOpen);
  const setSidebarMode = useReader((s) => s.setSidebarMode);

  return (
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
  );
}
