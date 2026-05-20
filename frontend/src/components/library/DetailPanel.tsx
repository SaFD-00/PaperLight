"use client";

import { ExternalLink, Star, X } from "lucide-react";
import { useState } from "react";
import type { LibraryPaper } from "@/lib/types";
import { useLibrary } from "@/stores/library";

function relativeTime(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const day = 86_400_000;
  if (diff < day) return "오늘";
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}일 전`;
  return new Date(ms).toLocaleDateString("ko-KR");
}

export function DetailPanel({
  paper,
  onOpen,
}: {
  paper: LibraryPaper | null;
  onOpen: (paper: LibraryPaper) => void;
}) {
  const collections = useLibrary((s) => s.collections);
  const addTag = useLibrary((s) => s.addTag);
  const removeTag = useLibrary((s) => s.removeTag);
  const patchPaper = useLibrary((s) => s.patchPaper);
  const [tagDraft, setTagDraft] = useState("");

  if (!paper) {
    return (
      <aside className="flex h-full items-center justify-center border-l border-border-subtle bg-bg-surface p-4 text-sm text-text-muted">
        논문을 선택하세요.
      </aside>
    );
  }

  const starredCol = collections.find((c) => c.specialKind === "starred");
  const isStarred = starredCol ? paper.collectionIds.includes(starredCol.id) : false;
  const externalUrl = paper.arxivId
    ? `https://arxiv.org/abs/${paper.arxivId}`
    : paper.doi
      ? `https://doi.org/${paper.doi}`
      : null;

  return (
    <aside className="flex h-full flex-col gap-3 overflow-auto border-l border-border-subtle bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug text-text-primary">{paper.title}</h2>
        <button
          type="button"
          aria-label={isStarred ? "별표 해제" : "별표"}
          onClick={() => void patchPaper(paper.id, { starred: !isStarred })}
          className="shrink-0 text-text-muted hover:text-brand-primary"
        >
          <Star className={isStarred ? "size-4 fill-brand-primary text-brand-primary" : "size-4"} />
        </button>
      </div>

      <dl className="grid gap-1.5 text-sm">
        <Row label="저자" value={paper.authors?.join(", ") ?? "—"} />
        <Row label="학회/저널" value={paper.venue ?? "—"} />
        <Row label="연도" value={paper.year ? String(paper.year) : "—"} />
        <Row label="추가일" value={relativeTime(paper.createdAt)} />
        <Row label="진행률" value={`${paper.progressPct ?? 0}%`} />
      </dl>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          상태
        </span>
        <select
          aria-label="읽기 상태"
          value={paper.status}
          onChange={(e) => void patchPaper(paper.id, { status: e.target.value })}
          className="mt-1 w-full rounded border border-border-default bg-bg-base px-2 py-1 text-sm"
        >
          <option value="to_read">읽기 전</option>
          <option value="reading">읽는 중</option>
          <option value="read">읽음</option>
        </select>
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          태그
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {paper.tags.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded-full bg-bg-muted px-2 py-0.5 text-xs text-text-secondary"
            >
              {t.name}
              <button
                type="button"
                aria-label={`${t.name} 태그 제거`}
                onClick={() => void removeTag(paper.id, t.id)}
                className="hover:text-text-primary"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (tagDraft.trim()) {
              void addTag(paper.id, tagDraft.trim());
              setTagDraft("");
            }
          }}
        >
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="태그 추가…"
            aria-label="태그 추가"
            className="w-full rounded border border-border-default bg-bg-base px-2 py-1 text-sm"
          />
        </form>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-brand-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> 원문 보기
          </a>
        )}
        <button
          type="button"
          onClick={() => onOpen(paper)}
          className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          리더 열기
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-text-primary">{value}</dd>
    </div>
  );
}
