"use client";

import { Bookmark, BookOpen, FileText, Headphones, Lightbulb, MessageSquare, Star } from "lucide-react";
import { useState } from "react";
import { ExplanationPanel } from "@/components/panels/ExplanationPanel";
import { useReader } from "@/stores/reader";

type PanelId = "explain" | "summary" | "notes" | "podcast" | "chat" | "bookmarks" | "starred";

const PANEL_TABS: { id: PanelId; label: string; icon: typeof BookOpen }[] = [
  { id: "explain", label: "Explanation", icon: Lightbulb },
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "podcast", label: "Podcast", icon: Headphones },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "starred", label: "Starred", icon: Star },
];

export function RightPanel() {
  const [active, setActive] = useState<PanelId>("explain");
  const explainText = useReader((s) => s.explainText);

  // explain 요청이 들어오면 자동으로 패널 전환
  if (explainText && active !== "explain") setActive("explain");

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
        {active !== "explain" && (
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
