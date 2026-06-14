"use client";

import { BookOpen, FileText, MessageSquare, Quote, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { InsightsPanel } from "@/components/panels/InsightsPanel";
import { NotesPanel } from "@/components/panels/NotesPanel";
import { ReferencesPanel } from "@/components/panels/ReferencesPanel";
import { SummaryPanel } from "@/components/panels/SummaryPanel";
import { useReader } from "@/stores/reader";
import { ResizeHandle } from "./ResizeHandle";

type PanelId = "summary" | "insights" | "chat" | "references" | "notes";

const PANEL_TABS: { id: PanelId; label: string; hint: string; icon: typeof BookOpen }[] = [
  { id: "summary", label: "Summary", hint: "논문 전체를 요약해 보여줍니다", icon: BookOpen },
  { id: "insights", label: "Insights", hint: "논문의 핵심 통찰을 정리합니다", icon: Sparkles },
  { id: "chat", label: "Chat", hint: "논문 내용에 대해 질문하고 대화합니다", icon: MessageSquare },
  { id: "references", label: "References", hint: "참고문헌 목록을 보여줍니다", icon: Quote },
  { id: "notes", label: "Notes", hint: "하이라이트와 메모를 모아 봅니다", icon: FileText },
];

export function RightPanel({ paperId }: { paperId: string }) {
  const [active, setActive] = useState<PanelId>("summary");
  const askText = useReader((s) => s.askText);
  const panelRequest = useReader((s) => s.panelRequest);
  const width = useReader((s) => s.rightPanelWidth);
  const setWidth = useReader((s) => s.setRightPanelWidth);

  useEffect(() => {
    if (askText) setActive("chat");
  }, [askText]);

  useEffect(() => {
    if (panelRequest) setActive(panelRequest.panel as PanelId);
  }, [panelRequest]);

  return (
    <aside
      aria-label="AI 패널"
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-l border-border-subtle bg-bg-surface"
    >
      <ResizeHandle side="left" width={width} onChange={setWidth} />
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border-subtle px-1.5 py-1.5">
        {PANEL_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              title={t.hint}
              onClick={() => setActive(t.id)}
              className={
                isActive
                  ? "grid h-8 w-8 place-items-center rounded-md bg-bg-muted text-text-primary"
                  : "grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-bg-muted hover:text-text-primary"
              }
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        {active === "summary" && <SummaryPanel paperId={paperId} />}
        {active === "insights" && <InsightsPanel paperId={paperId} />}
        {active === "chat" && <ChatPanel paperId={paperId} />}
        {active === "references" && <ReferencesPanel paperId={paperId} />}
        {active === "notes" && <NotesPanel paperId={paperId} />}
      </div>
    </aside>
  );
}
