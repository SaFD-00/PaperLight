"use client";

import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { usePapers } from "@/stores/papers";
import { useTabs } from "@/stores/tabs";

export default function ImportPage() {
  const router = useRouter();
  const meta = usePapers((s) => s.meta);
  const fetchMeta = usePapers((s) => s.fetchMeta);
  const importPaper = usePapers((s) => s.importPaper);
  const uploadPaper = usePapers((s) => s.uploadPaper);
  const fetchingMeta = usePapers((s) => s.fetchingMeta);
  const importing = usePapers((s) => s.importing);
  const error = usePapers((s) => s.error);
  const openTab = useTabs((s) => s.openTab);
  const [input, setInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function openReader(paper: { id: string; title: string }) {
    openTab({ paperId: paper.id, title: paper.title });
    router.push(`/r/${paper.id}`);
  }

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const paper = await uploadPaper(file);
    if (paper) openReader(paper);
  }

  async function onPreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await fetchMeta(input.trim());
  }

  async function onImport() {
    const paper = await importPaper(input.trim());
    if (paper) openReader(paper);
  }

  return (
    <div className="grid h-full place-items-center bg-bg-base p-6">
      <div className="w-full max-w-lg">
        <h1 className="mb-1 text-lg font-semibold text-text-primary">PDF 추가</h1>
        <p className="mb-5 text-xs text-text-secondary">
          논문 PDF를 업로드하면 자동으로 분석합니다.
        </p>

        {/* 주 입력: PDF 업로드 */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onFiles(e.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver
              ? "border-brand-primary bg-brand-primary-soft"
              : "border-border-default bg-bg-surface hover:bg-bg-muted"
          }`}
        >
          <UploadCloud size={32} className="text-brand-primary" aria-hidden />
          <span className="text-sm font-medium text-text-primary">
            {importing ? "업로드 중…" : "PDF를 끌어다 놓거나 클릭해서 선택"}
          </span>
          <span className="text-xs text-text-muted">.pdf 파일</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />

        {/* 보조 입력: arXiv */}
        <div className="my-6 flex items-center gap-3 text-xs text-text-muted">
          <span className="h-px flex-1 bg-border-subtle" />
          또는 arXiv에서 가져오기
          <span className="h-px flex-1 bg-border-subtle" />
        </div>

        <form onSubmit={onPreview} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="2602.09856 또는 arxiv.org/abs/…"
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
          <div className="mt-4 rounded-md border border-border-subtle bg-bg-surface p-4">
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
