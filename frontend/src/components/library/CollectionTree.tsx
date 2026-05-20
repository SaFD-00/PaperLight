"use client";

import {
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  Inbox,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import type { Collection } from "@/lib/types";
import { useLibrary } from "@/stores/library";

const SPECIALS: { id: string | null; label: string; icon: ComponentType<{ className?: string }> }[] =
  [
    { id: null, label: "내 라이브러리", icon: Folder },
    { id: "__starred__", label: "Starred", icon: Star },
    { id: "__unread__", label: "Unread", icon: Inbox },
    { id: "__recent__", label: "Recently Read", icon: Clock },
    { id: "__trash__", label: "Trash", icon: Trash2 },
  ];

export function CollectionTree() {
  const collections = useLibrary((s) => s.collections);
  const active = useLibrary((s) => s.activeCollectionId);
  const setActive = useLibrary((s) => s.setActiveCollection);
  const createCollection = useLibrary((s) => s.createCollection);
  const renameCollection = useLibrary((s) => s.renameCollection);
  const deleteCollection = useLibrary((s) => s.deleteCollection);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined);

  const userCols = collections.filter((c) => !c.isSpecial);
  const childrenOf = (pid: string | null) =>
    userCols.filter((c) => c.parentId === pid).sort((a, b) => a.position - b.position);

  async function submitCreate(parentId: string | null) {
    const name = draftName.trim();
    if (name) await createCollection(name, parentId);
    setDraftName("");
    setCreatingParent(undefined);
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
  }

  async function submitRename(id: string) {
    const name = draftName.trim();
    if (name) await renameCollection(id, name);
    setDraftName("");
    setRenamingId(null);
  }

  function renderNode(col: Collection, depth: number) {
    const kids = childrenOf(col.id);
    const isOpen = expanded[col.id] ?? false;
    return (
      <li key={col.id}>
        <div
          className={
            active === col.id
              ? "group flex items-center gap-1 rounded-md bg-brand-primary-soft px-1.5 py-1 text-sm"
              : "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-bg-muted"
          }
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              aria-label={isOpen ? "접기" : "펼치기"}
              onClick={() => setExpanded((e) => ({ ...e, [col.id]: !isOpen }))}
              className="grid size-4 place-items-center text-text-muted"
            >
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="size-4" />
          )}
          <Folder className="size-3.5 shrink-0 text-text-muted" aria-hidden />
          {renamingId === col.id ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => submitRename(col.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename(col.id);
                if (e.key === "Escape") {
                  setRenamingId(null);
                  setDraftName("");
                }
              }}
              className="flex-1 rounded border border-border-default bg-bg-base px-1 text-sm"
              aria-label="컬렉션 이름"
            />
          ) : (
            <button
              type="button"
              onClick={() => setActive(col.id)}
              className="flex-1 truncate text-left text-text-primary"
            >
              {col.name}
            </button>
          )}
          <span className="text-xs text-text-muted">{col.paperCount || ""}</span>
          <div className="relative">
            <button
              type="button"
              aria-label="컬렉션 메뉴"
              onClick={() => setMenuId(menuId === col.id ? null : col.id)}
              className="grid size-5 place-items-center rounded text-text-muted opacity-0 hover:bg-bg-base group-hover:opacity-100"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
            {menuId === col.id && (
              <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-border-subtle bg-bg-surface py-1 text-sm shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left hover:bg-bg-muted"
                  onClick={() => {
                    setRenamingId(col.id);
                    setDraftName(col.name);
                    setMenuId(null);
                  }}
                >
                  이름 변경
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left hover:bg-bg-muted"
                  onClick={() => {
                    setCreatingParent(col.id);
                    setDraftName("");
                    setMenuId(null);
                  }}
                >
                  하위 컬렉션
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1 text-left text-text-secondary hover:bg-bg-muted"
                  onClick={() => {
                    void deleteCollection(col.id);
                    setMenuId(null);
                  }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
        {creatingParent === col.id && (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => submitCreate(col.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitCreate(col.id);
              if (e.key === "Escape") setCreatingParent(undefined);
            }}
            placeholder="하위 컬렉션 이름"
            aria-label="하위 컬렉션 이름"
            className="my-1 ml-6 w-[calc(100%-1.5rem)] rounded border border-border-default bg-bg-base px-1 text-sm"
          />
        )}
        {isOpen && kids.length > 0 && (
          <ul>{kids.map((k) => renderNode(k, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <nav
      aria-label="컬렉션"
      className="flex h-full flex-col gap-1 overflow-auto border-r border-border-subtle bg-bg-surface p-2"
    >
      <ul className="flex flex-col gap-0.5">
        {SPECIALS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => setActive(s.id)}
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

      <div className="mt-2 flex items-center justify-between px-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          컬렉션
        </span>
        <button
          type="button"
          aria-label="새 컬렉션"
          onClick={() => {
            setCreatingParent(null);
            setDraftName("");
          }}
          className="grid size-5 place-items-center rounded text-text-muted hover:bg-bg-muted"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {creatingParent === null && (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => submitCreate(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitCreate(null);
            if (e.key === "Escape") setCreatingParent(undefined);
          }}
          placeholder="컬렉션 이름"
          aria-label="컬렉션 이름"
          className="mx-1.5 rounded border border-border-default bg-bg-base px-1 text-sm"
        />
      )}
      <ul className="flex flex-col gap-0.5">{childrenOf(null).map((c) => renderNode(c, 0))}</ul>
    </nav>
  );
}
