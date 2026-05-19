"use client";

import { useEffect, use } from "react";
import { useTabs } from "@/stores/tabs";
import { ReaderShell } from "@/components/reader/ReaderShell";

export default function ReaderPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = use(params);
  const tabs = useTabs((s) => s.tabs);
  const activateTab = useTabs((s) => s.activateTab);

  useEffect(() => {
    const target = tabs.find((t) => t.paperId === paperId);
    if (target) activateTab(target.id);
  }, [paperId, tabs, activateTab]);

  return <ReaderShell paperId={paperId} />;
}
