"use client";

import { BookOpen, FileText, Library, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTabs } from "@/stores/tabs";

const PILOT_PAPERS = [
  {
    paperId: "sample-1",
    title: "Code2World: A GUI World Model via Renderable Code Generation",
    arxiv: "2602.09856",
    authors: "Zheng et al., 2026",
  },
  {
    paperId: "sample-2",
    title: "How Mobile World Model Guides GUI Agents?",
    arxiv: "2605.10347",
    authors: "Xu et al., 2026",
  },
];

export function LibraryShell() {
  const router = useRouter();
  const openTab = useTabs((s) => s.openTab);
  const tabs = useTabs((s) => s.tabs);

  function openPaper(paperId: string, title: string) {
    const existing = tabs.find((t) => t.paperId === paperId);
    if (existing) {
      router.push(`/r/${paperId}`);
      return;
    }
    openTab({ paperId, title });
    router.push(`/r/${paperId}`);
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <header className="border-b border-border-subtle px-6 py-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Library className="size-5 text-brand-primary" aria-hidden />
          내 라이브러리
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          Phase 1에서 4-pane (Tree · List · Detail · Tag Cloud) 본격 도입.
        </p>
      </header>

      <div className="grid gap-6 overflow-auto px-6 py-6 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <BookOpen className="size-3.5" aria-hidden /> 파일럿 논문
          </h2>
          <ul className="grid gap-3">
            {PILOT_PAPERS.map((p) => (
              <li key={p.paperId}>
                <button
                  type="button"
                  onClick={() => openPaper(p.paperId, p.title)}
                  className="group flex w-full items-start gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 text-left transition-colors hover:border-brand-primary hover:bg-bg-muted"
                >
                  <FileText
                    className="mt-0.5 size-4 text-text-muted group-hover:text-brand-primary"
                    aria-hidden
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-text-primary group-hover:text-brand-primary">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      arXiv:{p.arxiv} · {p.authors}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="grid h-fit gap-3 rounded-lg border border-dashed border-border-default bg-bg-muted p-4 text-xs text-text-muted">
          <p className="flex items-center gap-2 font-medium text-text-secondary">
            <Tag className="size-3.5" aria-hidden /> Phase 1 예정
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>arXiv URL / 파일 업로드</li>
            <li>4-pane: Tree · List · Detail · Tag Cloud</li>
            <li>태그 · 컬렉션 · 멀티 선택 · Bulk 작업</li>
            <li>Ingestion (parser → chunker → embedder)</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
