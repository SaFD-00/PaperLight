"use client";

import { Search, Sparkles } from "lucide-react";
import { CommandList } from "./command-palette/CommandList";
import { useCommandPalette } from "./command-palette/useCommandPalette";

export function CommandPalette() {
  const { open, query, setQuery, active, setActive, filtered, inputRef, close, onInputKey } =
    useCommandPalette();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay p-4 pt-[12vh]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="명령 팔레트"
        className="pl-rise w-full max-w-lg overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3">
          <Search size={16} className="text-text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="논문 검색, 이동, 설정…"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="rounded border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-muted">
            Esc
          </kbd>
        </div>
        <CommandList
          items={filtered}
          active={active}
          onHover={setActive}
          onRun={(c) => {
            c.run();
            close();
          }}
        />
        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-2 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <Sparkles size={11} /> PaperLight
          </span>
          <span className="ml-auto">↑↓ 이동 · ↵ 실행 · Esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
