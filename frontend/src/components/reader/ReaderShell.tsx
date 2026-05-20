import { Center } from "@/components/reader/Center";
import { FloatingSelectionMenu } from "@/components/reader/FloatingSelectionMenu";
import { RightPanel } from "@/components/reader/RightPanel";
import { SelectionTranslatePopover } from "@/components/reader/SelectionTranslatePopover";
import { Sidebar } from "@/components/reader/Sidebar";

export function ReaderShell({ paperId }: { paperId: string }) {
  return (
    <>
      <div className="grid h-full" style={{ gridTemplateColumns: "180px minmax(0, 1fr) 360px" }}>
        <Sidebar />
        <Center paperId={paperId} />
        <RightPanel paperId={paperId} />
      </div>
      <FloatingSelectionMenu paperId={paperId} />
      <SelectionTranslatePopover />
    </>
  );
}
