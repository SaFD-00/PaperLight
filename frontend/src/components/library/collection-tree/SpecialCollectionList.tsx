import { Clock, Folder, Inbox, Star, Trash2 } from "lucide-react";
import type { ComponentType } from "react";

const SPECIALS: { id: string | null; label: string; icon: ComponentType<{ className?: string }> }[] =
  [
    { id: null, label: "내 라이브러리", icon: Folder },
    { id: "__starred__", label: "Starred", icon: Star },
    { id: "__unread__", label: "Unread", icon: Inbox },
    { id: "__recent__", label: "Recently Read", icon: Clock },
    { id: "__trash__", label: "Trash", icon: Trash2 },
  ];

/** 가상(스마트) 컬렉션 목록 — 내 라이브러리/Starred/Unread/Recent/Trash. */
export function SpecialCollectionList({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {SPECIALS.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={
                isActive
                  ? "flex w-full items-center gap-2 rounded-md bg-brand-primary-soft px-2 py-1 text-sm text-text-primary"
                  : "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-muted"
              }
            >
              <Icon className="size-3.5" />
              <span className="flex-1 truncate text-left">{s.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
