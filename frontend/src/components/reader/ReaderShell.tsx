import { Center } from "@/components/reader/Center";
import { FloatingSelectionMenu } from "@/components/reader/FloatingSelectionMenu";
import { RightPanel } from "@/components/reader/RightPanel";
import { Sidebar } from "@/components/reader/Sidebar";

export function ReaderShell({ paperId }: { paperId: string }) {
  return (
    <>
      <div className="grid h-full" style={{ gridTemplateColumns: "180px minmax(0, 1fr) 360px" }}>
        <Sidebar />
        <Center paperId={paperId} />
        <RightPanel />
      </div>
      <FloatingSelectionMenu />
    </>
  );
}
