"use client";

import { useState } from "react";
import type { LibraryPaper } from "@/lib/types";
import { useLibrary } from "@/stores/library";

const STATUS_LABEL: Record<string, string> = {
  to_read: "읽기 전",
  reading: "읽는 중",
  read: "읽음",
};

const COLUMNS: { key: string; label: string; sortable: boolean }[] = [
  { key: "title", label: "제목", sortable: true },
  { key: "author", label: "저자", sortable: false },
  { key: "year", label: "연도", sortable: true },
  { key: "status", label: "상태", sortable: true },
  { key: "created", label: "추가일", sortable: true },
];

function BulkToolbar() {
  const selected = useLibrary((s) => s.selectedPaperIds);
  const collections = useLibrary((s) => s.collections);
  const bulk = useLibrary((s) => s.bulk);
  const clear = useLibrary((s) => s.clearSelection);
  const [tagDraft, setTagDraft] = useState("");

  if (selected.length === 0) return null;
  const userCols = collections.filter((c) => !c.isSpecial);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-bg-muted px-3 py-2 text-sm">
      <span className="font-medium text-text-primary">{selected.length}개 선택</span>
      <select
        aria-label="상태 일괄 변경"
        defaultValue=""
        onChange={(e) => e.target.value && void bulk("status", e.target.value)}
        className="rounded border border-border-default bg-bg-surface px-1.5 py-0.5"
      >
        <option value="" disabled>
          상태
        </option>
        <option value="to_read">읽기 전</option>
        <option value="reading">읽는 중</option>
        <option value="read">읽음</option>
      </select>
      <select
        aria-label="컬렉션 이동"
        defaultValue=""
        onChange={(e) => e.target.value && void bulk("move", e.target.value)}
        className="rounded border border-border-default bg-bg-surface px-1.5 py-0.5"
      >
        <option value="" disabled>
          컬렉션 이동
        </option>
        {userCols.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (tagDraft.trim()) {
            void bulk("addTag", tagDraft.trim());
            setTagDraft("");
          }
        }}
      >
        <input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          placeholder="태그 추가"
          aria-label="태그 일괄 추가"
          className="w-24 rounded border border-border-default bg-bg-surface px-1.5 py-0.5"
        />
      </form>
      <button
        type="button"
        onClick={() => void bulk("trash")}
        className="rounded border border-border-default bg-bg-surface px-2 py-0.5 hover:bg-bg-base"
      >
        삭제
      </button>
      <button type="button" onClick={clear} className="text-text-muted hover:text-text-primary">
        선택 해제
      </button>
    </div>
  );
}

export function PaperList({
  papers,
  onOpen,
}: {
  papers: LibraryPaper[];
  onOpen: (paper: LibraryPaper) => void;
}) {
  const selectedPaperId = useLibrary((s) => s.selectedPaperId);
  const selectedPaperIds = useLibrary((s) => s.selectedPaperIds);
  const selectPaper = useLibrary((s) => s.selectPaper);
  const toggleSelect = useLibrary((s) => s.toggleSelect);
  const sort = useLibrary((s) => s.sort);
  const order = useLibrary((s) => s.order);
  const setSort = useLibrary((s) => s.setSort);

  function onHeader(key: string) {
    if (sort === key) setSort(key, order === "asc" ? "desc" : "asc");
    else setSort(key, "asc");
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <BulkToolbar />
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        <span className="w-4" />
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={!c.sortable}
            onClick={() => c.sortable && onHeader(c.key)}
            className={
              c.key === "title"
                ? "flex-1 text-left enabled:hover:text-text-primary"
                : "w-16 shrink-0 text-left enabled:hover:text-text-primary"
            }
          >
            {c.label}
            {sort === c.key ? (order === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      <ul aria-label="논문 목록" className="flex-1 overflow-auto">
        {papers.length === 0 ? (
          <li className="p-6 text-sm text-text-muted">논문이 없습니다.</li>
        ) : (
          papers.map((p) => {
            const authors = p.authors?.join(", ") ?? "";
            return (
              <li
                key={p.id}
                className={
                  selectedPaperId === p.id
                    ? "flex items-center gap-2 border-b border-border-subtle bg-brand-primary-soft px-3 py-2"
                    : "flex items-center gap-2 border-b border-border-subtle px-3 py-2 hover:bg-bg-muted"
                }
              >
                <input
                  type="checkbox"
                  aria-label={`${p.title} 선택`}
                  checked={selectedPaperIds.includes(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="size-4 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => selectPaper(p.id)}
                  onDoubleClick={() => onOpen(p)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">
                      {p.title}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {p.arxivId ? `arXiv:${p.arxivId} · ` : ""}
                      {authors || p.ingestionStatus}
                    </span>
                  </span>
                  <span className="w-16 shrink-0 truncate text-xs text-text-secondary">
                    {authors.split(",")[0] || "—"}
                  </span>
                  <span className="w-16 shrink-0 text-xs text-text-secondary">{p.year ?? "—"}</span>
                  <span className="w-16 shrink-0 text-xs text-text-secondary">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <span className="w-16 shrink-0 text-xs text-text-muted">
                    {p.progressPct ? `${p.progressPct}%` : "—"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
