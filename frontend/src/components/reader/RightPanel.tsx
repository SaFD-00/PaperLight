"use client";

import {
  Bookmark,
  BookOpen,
  FileText,
  Headphones,
  MessageSquare,
  Quote,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { InsightsPanel } from "@/components/panels/InsightsPanel";
import { NotesPanel } from "@/components/panels/NotesPanel";
import { ReferencesPanel } from "@/components/panels/ReferencesPanel";
import { SummaryPanel } from "@/components/panels/SummaryPanel";
import { useReader } from "@/stores/reader";

type PanelId =
  | "summary"
  | "insights"
  | "chat"
  | "references"
  | "notes"
  | "podcast"
  | "bookmarks"
  | "starred";

const PANEL_TABS: { id: PanelId; label: string; hint: string; icon: typeof BookOpen }[] = [
  { id: "summary", label: "Summary", hint: "논문 전체를 요약해 보여줍니다", icon: BookOpen },
  { id: "insights", label: "Insights", hint: "논문의 핵심 통찰을 정리합니다", icon: Sparkles },
  { id: "chat", label: "Chat", hint: "논문 내용에 대해 질문하고 대화합니다", icon: MessageSquare },
  { id: "references", label: "References", hint: "참고문헌 목록을 보여줍니다", icon: Quote },
  { id: "notes", label: "Notes", hint: "하이라이트와 메모를 모아 봅니다", icon: FileText },
  { id: "podcast", label: "Podcast", hint: "논문을 오디오 팟캐스트로 만듭니다", icon: Headphones },
  { id: "bookmarks", label: "Bookmarks", hint: "북마크한 위치를 모아 봅니다", icon: Bookmark },
  { id: "starred", label: "Starred", hint: "즐겨찾기한 항목을 모아 봅니다", icon: Star },
];

export function RightPanel({ paperId }: { paperId: string }) {
  const [active, setActive] = useState<PanelId>("summary");
  const askText = useReader((s) => s.askText);
  const panelRequest = useReader((s) => s.panelRequest);

  useEffect(() => {
    if (askText) setActive("chat");
  }, [askText]);

  useEffect(() => {
    if (panelRequest) setActive(panelRequest.panel as PanelId);
  }, [panelRequest]);

  return (
    <aside
      aria-label="AI 패널"
      className="flex h-full w-[360px] flex-col border-l border-border-subtle bg-bg-surface"
    >
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
        {active !== "summary" &&
          active !== "insights" &&
          active !== "chat" &&
          active !== "references" &&
          active !== "notes" && (
            <div className="space-y-4 p-4 text-sm text-text-muted">
              <p className="text-xs">
                {PANEL_TABS.find((p) => p.id === active)?.label} placeholder · Phase 1
              </p>
            </div>
          )}
      </div>
    </aside>
  );
}
