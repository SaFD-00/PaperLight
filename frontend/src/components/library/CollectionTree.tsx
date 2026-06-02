"use client";

import { Plus } from "lucide-react";
import { CollectionNode } from "./collection-tree/CollectionNode";
import { InlineNameInput } from "./collection-tree/InlineNameInput";
import { SpecialCollectionList } from "./collection-tree/SpecialCollectionList";
import { useCollectionTree } from "./collection-tree/useCollectionTree";

export function CollectionTree() {
  const ctrl = useCollectionTree();

  return (
    <nav
      aria-label="컬렉션"
      className="flex h-full flex-col gap-1 overflow-auto border-r border-border-subtle bg-bg-surface p-2"
    >
      <SpecialCollectionList active={ctrl.active} onSelect={ctrl.setActive} />

      <div className="mt-2 flex items-center justify-between px-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          컬렉션
        </span>
        <button
          type="button"
          aria-label="새 컬렉션"
          onClick={() => ctrl.startCreate(null)}
          className="grid size-5 place-items-center rounded text-text-muted hover:bg-bg-muted"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {ctrl.creatingParent === null && (
        <InlineNameInput
          value={ctrl.draftName}
          onChange={ctrl.setDraftName}
          onSubmit={() => void ctrl.submitCreate(null)}
          onCancel={ctrl.cancelCreate}
          placeholder="컬렉션 이름"
          ariaLabel="컬렉션 이름"
          className="mx-1.5 rounded border border-border-default bg-bg-base px-1 text-sm"
        />
      )}
      <ul className="flex flex-col gap-0.5">
        {ctrl.childrenOf(null).map((c) => (
          <CollectionNode key={c.id} col={c} depth={0} ctrl={ctrl} />
        ))}
      </ul>
    </nav>
  );
}
