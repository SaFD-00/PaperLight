"use client";

import { use, useEffect } from "react";
import { ReaderShell } from "@/components/reader/ReaderShell";
import { capture } from "@/lib/analytics";
import { useTabs } from "@/stores/tabs";

export default function ReaderPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = use(params);
  const activateTab = useTabs((s) => s.activateTab);

  useEffect(() => {
    capture("paper_opened", { paperId });
  }, [paperId]);

  // paperId 변경 시점에만 활성화 — tabs를 deps에 두면 activateTab이 lastActiveAt 갱신 → 무한 루프.
  useEffect(() => {
    const target = useTabs.getState().tabs.find((t) => t.paperId === paperId);
    if (target && useTabs.getState().activeId !== target.id) {
      activateTab(target.id);
    }
  }, [paperId, activateTab]);

  return <ReaderShell paperId={paperId} />;
}
