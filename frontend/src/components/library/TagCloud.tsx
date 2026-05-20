"use client";

import { useLibrary } from "@/stores/library";

const SIZES = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl"];

export function TagCloud() {
  const tags = useLibrary((s) => s.tags);
  const filterTagIds = useLibrary((s) => s.filterTagIds);
  const toggleFilterTag = useLibrary((s) => s.toggleFilterTag);

  if (tags.length === 0) {
    return (
      <div className="flex h-full items-center border-t border-border-subtle bg-bg-surface px-4 text-xs text-text-muted">
        태그가 없습니다.
      </div>
    );
  }

  const max = Math.max(...tags.map((t) => t.count), 1);
  const sizeFor = (count: number) => SIZES[Math.min(SIZES.length - 1, Math.floor((count / max) * SIZES.length))];

  return (
    <div
      aria-label="태그 클라우드"
      className="h-full overflow-auto border-t border-border-subtle bg-bg-surface px-4 py-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {tags.map((t) => {
          const active = filterTagIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleFilterTag(t.id)}
              className={
                active
                  ? `${sizeFor(t.count)} font-medium text-brand-primary underline`
                  : `${sizeFor(t.count)} text-text-secondary hover:text-brand-primary`
              }
            >
              {t.name}
              <span className="ml-0.5 align-super text-[10px] text-text-muted">{t.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
