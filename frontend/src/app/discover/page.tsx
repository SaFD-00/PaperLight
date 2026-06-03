"use client";

import { useState } from "react";
import { type DeepSearchResult, useDeepSearch } from "@/stores/deepSearch";

export default function DiscoverPage() {
  const results = useDeepSearch((s) => s.results);
  const loading = useDeepSearch((s) => s.loading);
  const searched = useDeepSearch((s) => s.searched);
  const search = useDeepSearch((s) => s.search);
  const [query, setQuery] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void search(query);
  }

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <h1 className="mb-1 text-lg font-semibold text-text-primary">Deep Search</h1>
      <p className="mb-4 text-xs text-text-secondary">
        내 라이브러리의 관심사를 바탕으로 관련 논문을 추천하고, 추천 이유를 함께 보여줍니다.
      </p>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="관심 주제 (예: diffusion models)"
          className="flex-1 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-brand-primary"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "검색 중…" : "검색"}
        </button>
      </form>

      {searched && results.length === 0 && !loading && (
        <p className="mt-4 text-sm text-text-muted">추천 결과가 없습니다.</p>
      )}

      <ul className="mt-4 space-y-3">
        {results.map((r, i) => (
          <ResultCard key={`${r.url}-${i}`} result={r} />
        ))}
      </ul>
    </div>
  );
}

function ResultCard({ result }: { result: DeepSearchResult }) {
  const [showWhy, setShowWhy] = useState(false);
  const meta = [result.authors[0], result.year].filter(Boolean).join(" · ");

  return (
    <li className="rounded-md border border-border-subtle bg-bg-surface p-4">
      <a
        href={result.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-text-primary hover:text-brand-primary"
      >
        {result.title}
      </a>
      {meta && <p className="mt-0.5 text-xs text-text-muted">{meta}</p>}
      {result.abstract && (
        <p className="mt-2 line-clamp-3 text-xs text-text-secondary">{result.abstract}</p>
      )}
      <button
        type="button"
        onClick={() => setShowWhy((v) => !v)}
        className="mt-2 text-xs text-brand-primary underline underline-offset-2"
      >
        {showWhy ? "이유 숨기기" : "왜 추천?"}
      </button>
      {showWhy && <p className="mt-1 text-xs text-text-secondary">{result.why}</p>}
    </li>
  );
}
