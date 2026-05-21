"use client";

import { Center } from "@/components/reader/Center";
import { FloatingSelectionMenu } from "@/components/reader/FloatingSelectionMenu";
import { RightPanel } from "@/components/reader/RightPanel";
import { SelectionExplainPopover } from "@/components/reader/SelectionExplainPopover";
import { SelectionTranslatePopover } from "@/components/reader/SelectionTranslatePopover";
import { Sidebar } from "@/components/reader/Sidebar";
import { TranslationSidePanel } from "@/components/reader/TranslationSidePanel";
import { useReader } from "@/stores/reader";

export function ReaderShell({ paperId }: { paperId: string }) {
  const sidebarOpen = useReader((s) => s.sidebarOpen);
  const translationOpen = useReader((s) => s.translationEnabled);
  const aiPanelOpen = useReader((s) => s.aiPanelOpen);

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
