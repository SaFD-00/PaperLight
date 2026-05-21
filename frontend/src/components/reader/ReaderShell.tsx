"use client";

import { useEffect } from "react";
import { Center } from "@/components/reader/Center";
import { FloatingSelectionMenu } from "@/components/reader/FloatingSelectionMenu";
import { RightPanel } from "@/components/reader/RightPanel";
import { SelectionExplainPopover } from "@/components/reader/SelectionExplainPopover";
import { SelectionTranslatePopover } from "@/components/reader/SelectionTranslatePopover";
import { Sidebar } from "@/components/reader/Sidebar";
import { TranslationSidePanel } from "@/components/reader/TranslationSidePanel";
import { useReader } from "@/stores/reader";
import { useSettings } from "@/stores/settings";

export function ReaderShell({ paperId }: { paperId: string }) {
  const sidebarOpen = useReader((s) => s.sidebarOpen);
  const translationOpen = useReader((s) => s.translationEnabled);
  const aiPanelOpen = useReader((s) => s.aiPanelOpen);
  const readerFontScale = useSettings((s) => s.readerFontScale);

  // 리더 라우트에서만 글꼴 스케일 적용, 벗어나면 1로 복원(Library 미영향).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--reader-font-scale", String(readerFontScale));
    return () => root.style.setProperty("--reader-font-scale", "1");
  }, [readerFontScale]);

  return (
    <>
      <div className="flex h-full">
        {sidebarOpen && <Sidebar />}
        <Center paperId={paperId} />
        {translationOpen && <TranslationSidePanel paperId={paperId} />}
        {aiPanelOpen && <RightPanel paperId={paperId} />}
      </div>
      <FloatingSelectionMenu paperId={paperId} />
      <SelectionTranslatePopover />
      <SelectionExplainPopover />
    </>
  );
}
