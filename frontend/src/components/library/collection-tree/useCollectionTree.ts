"use client";

import { useState } from "react";
import type { Collection } from "@/lib/types";
import { useLibrary } from "@/stores/library";

/** 컬렉션 트리의 펼침/메뉴/이름편집/생성 상태와 핸들러를 한데 모은 컨트롤러. */
export function useCollectionTree() {
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

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !(e[id] ?? false) }));

  const startRename = (col: Collection) => {
    setRenamingId(col.id);
    setDraftName(col.name);
    setMenuId(null);
  };
  const cancelRename = () => {
    setRenamingId(null);
    setDraftName("");
  };

  const startCreate = (parentId: string | null) => {
    setCreatingParent(parentId);
    setDraftName("");
    setMenuId(null);
  };
  const cancelCreate = () => setCreatingParent(undefined);

  return {
    active,
    setActive,
    childrenOf,
    expanded,
    toggleExpand,
    menuId,
    setMenuId,
    renamingId,
    creatingParent,
    draftName,
    setDraftName,
    startRename,
    submitRename,
    cancelRename,
    startCreate,
    submitCreate,
    cancelCreate,
    deleteCollection,
  };
}

export type CollectionTreeController = ReturnType<typeof useCollectionTree>;
