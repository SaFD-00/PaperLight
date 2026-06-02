"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useReader } from "@/stores/reader";

/** 페이지 내 검색 바 — 툴바의 "페이지 내 검색"·⌘F 로 열린다. */
export function SearchBar() {
  const open = useReader((s) => s.searchOpen);
  const query = useReader((s) => s.searchQuery);
  const matchCount = useReader((s) => s.searchMatchCount);
  const current = useReader((s) => s.searchCurrent);
  const requestFind = useReader((s) => s.requestFind);
  const requestFindStep = useReader((s) => s.requestFindStep);
  const closeSearch = useReader((s) => s.closeSearch);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 열릴 때 입력에 포커스.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;

  return (
    <div className="pointer-events-auto absolute right-4 top-3 z-20 flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5 shadow-lg">
      <Search size={14} className="text-text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        aria-label="페이지 내 검색어"
        placeholder="페이지에서 찾기"
        onChange={(e) => requestFind(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            closeSearch();
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (matchCount > 0) requestFindStep(e.shiftKey ? -1 : 1);
          }
        }}
        className="w-40 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
      />
      <span className="min-w-14 text-center font-mono text-xs text-text-secondary">
        {hasQuery ? (matchCount > 0 ? `${current} / ${matchCount}` : "결과 없음") : ""}
      </span>
      <button
        type="button"
        aria-label="이전 일치"
        disabled={matchCount === 0}
        onClick={() => requestFindStep(-1)}
        className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary disabled:opacity-40"
      >
        <ChevronUp size={15} />
      </button>
      <button
        type="button"
        aria-label="다음 일치"
        disabled={matchCount === 0}
        onClick={() => requestFindStep(1)}
        className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary disabled:opacity-40"
      >
        <ChevronDown size={15} />
      </button>
      <button
        type="button"
        aria-label="검색 닫기"
        onClick={closeSearch}
        className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
      >
        <X size={15} />
      </button>
    </div>
  );
}
