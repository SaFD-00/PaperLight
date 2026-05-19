"use client";

import { BookOpen, X } from "lucide-react";
import clsx from "clsx";
import type { Tab as TabModel } from "@/stores/tabs";

interface TabProps {
  tab: TabModel;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}

export function Tab({ tab, active, onActivate, onClose }: TabProps) {
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={clsx(
        "group flex h-9 max-w-[200px] items-center gap-1.5 border-r border-border-subtle px-3 cursor-pointer select-none",
        active ? "bg-bg-surface text-text-primary" : "bg-bg-base text-text-secondary",
        "transition-colors hover:bg-bg-surface"
      )}
      title={tab.title}
    >
      {tab.isLibrary && <BookOpen size={14} className="shrink-0 text-text-secondary" />}
      <span
        className={clsx(
          "h-1.5 w-1.5 shrink-0 rounded-full transition-opacity",
          active ? "bg-brand-primary opacity-100" : "opacity-0"
        )}
        aria-hidden
      />
      <span className="truncate text-[13px]">{tab.title}</span>
      {!tab.isLibrary && (
        <button
          type="button"
          aria-label={`${tab.title} 탭 닫기`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-sm text-text-muted opacity-0 transition-opacity hover:bg-bg-muted hover:text-text-primary group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
