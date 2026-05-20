"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { usePapers } from "@/stores/papers";

export default function ImportPage() {
  const router = useRouter();
  const meta = usePapers((s) => s.meta);
  const fetchMeta = usePapers((s) => s.fetchMeta);
  const importPaper = usePapers((s) => s.importPaper);
  const fetchingMeta = usePapers((s) => s.fetchingMeta);
  const importing = usePapers((s) => s.importing);
  const error = usePapers((s) => s.error);
  const [input, setInput] = useState("");

  async function onPreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await fetchMeta(input.trim());
  }

  async function onImport() {
    const paper = await importPaper(input.trim());
    if (paper) router.push(`/r/${paper.id}`);
  }

  return (
    <div className="grid h-full place-items-center bg-bg-base p-6">
      <div className="w-full max-w-lg rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-text-primary">arXiv 논문 가져오기</h1>
        <p className="mb-4 text-xs text-text-secondary">
          arXiv ID 또는 URL을 붙여넣으세요. 예: 2602.09856 또는 https://arxiv.org/abs/2602.09856
        </p>

        <form onSubmit={onPreview} className="flex gap-2">
          <input
            type="text"
            required
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="2602.09856"
            className="flex-1 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-brand-primary"
          />
          <button
            type="submit"
            disabled={fetchingMeta || !input.trim()}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-bg-muted disabled:opacity-50"
          >
            {fetchingMeta ? "조회 중…" : "미리보기"}
          </button>
        </form>

        {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}

        {meta ? (
          <div className="mt-4 rounded-md border border-border-subtle bg-bg-base p-4">
            <h2 className="text-sm font-semibold text-text-primary">{meta.title}</h2>
            <p className="mt-1 text-xs text-text-muted">
              {meta.authors.slice(0, 6).join(", ")}
              {meta.authors.length > 6 ? " 외" : ""}
              {meta.year ? ` · ${meta.year}` : ""} · arXiv:{meta.arxivId}
            </p>
            {meta.abstract ? (
              <p className="mt-2 line-clamp-4 text-xs text-text-secondary">{meta.abstract}</p>
            ) : null}
            <button
              type="button"
              onClick={onImport}
              disabled={importing}
              className="mt-4 w-full rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-50"
            >
              {importing ? "가져오는 중…" : "가져오기"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
