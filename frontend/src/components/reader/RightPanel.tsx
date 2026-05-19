import { Bookmark, BookOpen, FileText, Headphones, MessageSquare, Star } from "lucide-react";

const PANEL_TABS = [
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "podcast", label: "Podcast", icon: Headphones },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "starred", label: "Starred", icon: Star },
] as const;

export function RightPanel() {
  return (
    <aside
      aria-label="AI 패널"
      className="flex h-full w-[360px] flex-col border-l border-border-subtle bg-bg-surface"
    >
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border-subtle px-1.5 py-1.5">
        {PANEL_TABS.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              className={
                i === 0
                  ? "grid h-8 w-8 place-items-center rounded-md bg-bg-muted text-text-primary"
                  : "grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-bg-muted hover:text-text-primary"
              }
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-4 text-sm text-text-muted">
        <section>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">키워드 사전</p>
          <p className="text-xs">placeholder · S4 (Explanation) 이후 채워짐</p>
        </section>
        <section>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">3줄 요약</p>
          <p className="text-xs">placeholder · Phase 1 ingestion 이후 채워짐</p>
        </section>
        <section>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">후속 질문</p>
          <p className="text-xs">placeholder</p>
        </section>
      </div>
    </aside>
  );
}
