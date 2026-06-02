import { ChevronDown, ChevronRight, Folder, MoreHorizontal } from "lucide-react";
import type { Collection } from "@/lib/types";
import { InlineNameInput } from "./InlineNameInput";
import type { CollectionTreeController } from "./useCollectionTree";

/** 사용자 컬렉션 노드(재귀). 펼침/이름변경/메뉴/하위생성 + 자식 렌더. */
export function CollectionNode({
  col,
  depth,
  ctrl,
}: {
  col: Collection;
  depth: number;
  ctrl: CollectionTreeController;
}) {
  const kids = ctrl.childrenOf(col.id);
  const isOpen = ctrl.expanded[col.id] ?? false;
  return (
    <li>
      <div
        className={
          ctrl.active === col.id
            ? "group flex items-center gap-1 rounded-md bg-brand-primary-soft px-1.5 py-1 text-sm"
            : "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-bg-muted"
        }
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {kids.length > 0 ? (
          <button
            type="button"
            aria-label={isOpen ? "접기" : "펼치기"}
            onClick={() => ctrl.toggleExpand(col.id)}
            className="grid size-4 place-items-center text-text-muted"
          >
            {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-4" />
        )}
        <Folder className="size-3.5 shrink-0 text-text-muted" aria-hidden />
        {ctrl.renamingId === col.id ? (
          <InlineNameInput
            value={ctrl.draftName}
            onChange={ctrl.setDraftName}
            onSubmit={() => void ctrl.submitRename(col.id)}
            onCancel={ctrl.cancelRename}
            ariaLabel="컬렉션 이름"
            className="flex-1 rounded border border-border-default bg-bg-base px-1 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => ctrl.setActive(col.id)}
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
            onClick={() => ctrl.setMenuId(ctrl.menuId === col.id ? null : col.id)}
            className="grid size-5 place-items-center rounded text-text-muted opacity-0 hover:bg-bg-base group-hover:opacity-100"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
          {ctrl.menuId === col.id && (
            <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-border-subtle bg-bg-surface py-1 text-sm shadow-md">
              <button
                type="button"
                className="block w-full px-3 py-1 text-left hover:bg-bg-muted"
                onClick={() => ctrl.startRename(col)}
              >
                이름 변경
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1 text-left hover:bg-bg-muted"
                onClick={() => ctrl.startCreate(col.id)}
              >
                하위 컬렉션
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1 text-left text-text-secondary hover:bg-bg-muted"
                onClick={() => {
                  void ctrl.deleteCollection(col.id);
                  ctrl.setMenuId(null);
                }}
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </div>
      {ctrl.creatingParent === col.id && (
        <InlineNameInput
          value={ctrl.draftName}
          onChange={ctrl.setDraftName}
          onSubmit={() => void ctrl.submitCreate(col.id)}
          onCancel={ctrl.cancelCreate}
          placeholder="하위 컬렉션 이름"
          ariaLabel="하위 컬렉션 이름"
          className="my-1 ml-6 w-[calc(100%-1.5rem)] rounded border border-border-default bg-bg-base px-1 text-sm"
        />
      )}
      {isOpen && kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <CollectionNode key={k.id} col={k} depth={depth + 1} ctrl={ctrl} />
          ))}
        </ul>
      )}
    </li>
  );
}
