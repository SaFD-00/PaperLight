"use client";

import {
  Bookmark,
  BookOpen,
  FileText,
  Headphones,
  Languages,
  Lightbulb,
  MessageSquare,
  Quote,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { ExplanationPanel } from "@/components/panels/ExplanationPanel";
import { InsightsPanel } from "@/components/panels/InsightsPanel";
import { ReferencesPanel } from "@/components/panels/ReferencesPanel";
import { SummaryPanel } from "@/components/panels/SummaryPanel";
import { TranslationPane } from "@/components/panels/TranslationPane";
import { useReader } from "@/stores/reader";

type PanelId =
  | "explain"
  | "translate"
  | "summary"
  | "insights"
  | "chat"
  | "references"
  | "notes"
  | "podcast"
  | "bookmarks"
  | "starred";

const PANEL_TABS: { id: PanelId; label: string; icon: typeof BookOpen }[] = [
  { id: "explain", label: "Explanation", icon: Lightbulb },
  { id: "translate", label: "Translation", icon: Languages },
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "references", label: "References", icon: Quote },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "podcast", label: "Podcast", icon: Headphones },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "starred", label: "Starred", icon: Star },
];

export function RightPanel({ paperId }: { paperId: string }) {
  const [active, setActive] = useState<PanelId>("explain");
  const explainText = useReader((s) => s.explainText);
  const translationEnabled = useReader((s) => s.translationEnabled);

  useEffect(() => {
    if (explainText) setActive("explain");
  }, [explainText]);

  useEffect(() => {
    if (translationEnabled) setActive("translate");
  }, [translationEnabled]);

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
        {active === "explain" && <ExplanationPanel />}
        {active === "translate" && <TranslationPane />}
        {active === "summary" && <SummaryPanel paperId={paperId} />}
        {active === "insights" && <InsightsPanel paperId={paperId} />}
        {active === "chat" && <ChatPanel paperId={paperId} />}
        {active === "references" && <ReferencesPanel paperId={paperId} />}
        {active !== "explain" &&
          active !== "translate" &&
          active !== "summary" &&
          active !== "insights" &&
          active !== "chat" &&
          active !== "references" && (
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
