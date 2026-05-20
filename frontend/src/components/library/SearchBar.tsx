"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { type SearchScope, useLibrary } from "@/stores/library";

const SCOPES: { id: SearchScope; label: string }[] = [
  { id: "title", label: "제목" },
  { id: "author", label: "저자" },
  { id: "tag", label: "태그" },
  { id: "content", label: "본문" },
];

export function SearchBar() {
  const scope = useLibrary((s) => s.scope);
  const setSearch = useLibrary((s) => s.setSearch);
  const [value, setValue] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setSearch(value, scope), 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function toggleScope(id: SearchScope) {
    const next = scope.includes(id) ? scope.filter((s) => s !== id) : [...scope, id];
    setSearch(value, next.length ? next : ["title"]);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-base px-2 py-1">
        <Search className="size-3.5 text-text-muted" aria-hidden />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="라이브러리 검색…"
          aria-label="라이브러리 검색"
          className="w-48 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="flex items-center gap-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={scope.includes(s.id)}
            onClick={() => toggleScope(s.id)}
            className={
              scope.includes(s.id)
                ? "rounded border border-brand-primary bg-brand-primary-soft px-1.5 py-0.5 text-xs text-text-primary"
                : "rounded border border-border-subtle px-1.5 py-0.5 text-xs text-text-muted hover:text-text-primary"
            }
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
