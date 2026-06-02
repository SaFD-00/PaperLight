import type { Command } from "./buildCommands";

/** 필터된 명령 리스트(키보드 선택 하이라이트 + 마우스 hover/click). */
export function CommandList({
  items,
  active,
  onHover,
  onRun,
}: {
  items: Command[];
  active: number;
  onHover: (i: number) => void;
  onRun: (cmd: Command) => void;
}) {
  return (
    <ul className="max-h-[50vh] overflow-y-auto p-1.5">
      {items.length === 0 ? (
        <li className="px-3 py-6 text-center text-sm text-text-muted">결과가 없습니다.</li>
      ) : (
        items.map((c, i) => {
          const Icon = c.icon;
          const isActive = i === active;
          return (
            <li key={c.id}>
              <button
                type="button"
                onMouseEnter={() => onHover(i)}
                onClick={() => onRun(c)}
                className={
                  isActive
                    ? "flex w-full items-center gap-3 rounded-lg bg-brand-primary-soft px-3 py-2 text-left"
                    : "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-bg-muted"
                }
              >
                <Icon
                  size={15}
                  className={isActive ? "text-brand-primary" : "text-text-muted"}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{c.label}</span>
                {c.hint ? (
                  <span className="shrink-0 text-[11px] text-text-muted">{c.hint}</span>
                ) : null}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}
