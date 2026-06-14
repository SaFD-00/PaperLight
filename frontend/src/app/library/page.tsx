"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Paper } from "@/lib/types";
import { usePapers } from "@/stores/papers";
import { LIBRARY_TAB_ID, useTabs } from "@/stores/tabs";

const STATUS_LABEL: Record<string, string> = {
  ready: "준비됨",
  pending: "대기 중",
  parsing: "분석 중",
  embedding: "처리 중",
  failed: "실패",
};

export default function LibraryPage() {
  const router = useRouter();
  const papers = usePapers((s) => s.list);
  const refreshList = usePapers((s) => s.refreshList);
  const activateTab = useTabs((s) => s.activateTab);
  const openTab = useTabs((s) => s.openTab);

  useEffect(() => {
    activateTab(LIBRARY_TAB_ID);
    void refreshList();
  }, [activateTab, refreshList]);

  function open(paper: Paper) {
    openTab({ paperId: paper.id, title: paper.title });
    router.push(`/r/${paper.id}`);
  }

  return (
    <div className="mx-auto h-full w-full max-w-5xl overflow-y-auto px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">내 논문</h1>
          <p className="mt-1 text-sm text-text-secondary">{papers.length}편의 논문</p>
        </div>
        <Link
          href="/import"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-hover"
        >
          <Plus size={16} />
          PDF 추가
        </Link>
      </header>

      {papers.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <FileText size={40} className="text-text-muted" aria-hidden />
          <p className="text-sm text-text-secondary">아직 논문이 없습니다.</p>
          <Link
            href="/import"
            className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted"
          >
            첫 PDF 업로드하기
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {papers.map((paper) => (
            <li key={paper.id}>
              <button
                type="button"
                onClick={() => open(paper)}
                className="flex w-full flex-col gap-2 rounded-xl border border-border-subtle bg-bg-surface p-4 text-left transition-colors hover:border-border-default hover:bg-bg-muted"
              >
                <span className="line-clamp-2 text-sm font-medium text-text-primary">
                  {paper.title}
                </span>
                <span className="line-clamp-1 text-xs text-text-secondary">
                  {(paper.authors ?? []).join(", ") || "저자 미상"}
                  {paper.year ? ` · ${paper.year}` : ""}
                </span>
                <span className="mt-1 inline-flex w-fit rounded-full bg-bg-muted px-2 py-0.5 text-[11px] text-text-muted">
                  {STATUS_LABEL[paper.ingestionStatus] ?? paper.ingestionStatus}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
