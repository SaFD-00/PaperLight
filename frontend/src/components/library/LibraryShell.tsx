"use client";

import { Library, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { CollectionTree } from "@/components/library/CollectionTree";
import { DetailPanel } from "@/components/library/DetailPanel";
import { ImportExportMenu } from "@/components/library/ImportExportMenu";
import { PaperList } from "@/components/library/PaperList";
import { SearchBar } from "@/components/library/SearchBar";
import { TagCloud } from "@/components/library/TagCloud";
import { PILOTS } from "@/lib/fixtures/pilots";
import type { LibraryPaper } from "@/lib/types";
import { useLibrary } from "@/stores/library";
import { useTabs } from "@/stores/tabs";

export function LibraryShell() {
  const router = useRouter();
  const openTab = useTabs((s) => s.openTab);
  const tabs = useTabs((s) => s.tabs);

  const papers = useLibrary((s) => s.papers);
  const activeCollectionId = useLibrary((s) => s.activeCollectionId);
  const query = useLibrary((s) => s.query);
  const filterTagIds = useLibrary((s) => s.filterTagIds);
  const selectedPaperId = useLibrary((s) => s.selectedPaperId);
  const selectedPaperIds = useLibrary((s) => s.selectedPaperIds);
  const refreshAll = useLibrary((s) => s.refreshAll);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const showPilots = activeCollectionId === null && query === "" && filterTagIds.length === 0;
  const combined = useMemo(() => {
    if (!showPilots) return papers;
    // Once the backend seeds the pilots, GET /api/papers returns them too;
    // dedupe by id so they don't show twice (API row wins over the placeholder).
    const byId = new Map<string, LibraryPaper>();
    for (const p of [...PILOTS, ...papers]) byId.set(p.id, p);
    return [...byId.values()];
  }, [showPilots, papers]);
  const selectedPaper = combined.find((p) => p.id === selectedPaperId) ?? null;
  const exportIds = selectedPaperIds.length ? selectedPaperIds : papers.map((p) => p.id);

  function openPaper(paper: LibraryPaper) {
    const existing = tabs.find((t) => t.paperId === paper.id);
    if (!existing) openTab({ paperId: paper.id, title: paper.title });
    router.push(`/r/${paper.id}`);
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr_120px]">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Library className="size-5 text-brand-primary" aria-hidden />
          내 라이브러리
        </h1>
        <div className="flex items-center gap-2">
          <SearchBar />
          <ImportExportMenu exportIds={exportIds} />
          <Link
            href="/import"
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden /> 논문 추가
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[250px_minmax(0,1fr)_320px]">
        <CollectionTree />
        <PaperList papers={combined} onOpen={openPaper} />
        <DetailPanel paper={selectedPaper} onOpen={openPaper} />
      </div>

      <TagCloud />
    </div>
  );
}
