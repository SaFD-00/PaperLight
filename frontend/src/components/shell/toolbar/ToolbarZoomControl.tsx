"use client";

import { Minus, Plus } from "lucide-react";
import { useReader } from "@/stores/reader";

/** 중앙 그룹 — 페이지 카운터 + 줌 인/아웃. */
export function ToolbarZoomControl() {
  const zoom = useReader((s) => s.zoom);
  const zoomIn = useReader((s) => s.zoomIn);
  const zoomOut = useReader((s) => s.zoomOut);
  const currentPage = useReader((s) => s.currentPage);
  const totalPages = useReader((s) => s.totalPages);

  return (
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
  );
}
