export function Sidebar() {
  return (
    <aside
      aria-label="목차 사이드바"
      className="flex h-full w-[180px] flex-col border-r border-border-subtle bg-bg-base p-3 text-text-secondary"
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">TOC</p>
      <ul className="space-y-1 text-sm">
        <li className="rounded-sm px-2 py-1 hover:bg-bg-muted">Introduction</li>
        <li className="rounded-sm px-2 py-1 hover:bg-bg-muted">Method</li>
        <li className="rounded-sm px-2 py-1 hover:bg-bg-muted">Result</li>
        <li className="rounded-sm px-2 py-1 hover:bg-bg-muted">Discussion</li>
      </ul>
      <p className="mt-auto text-[11px] text-text-muted">placeholder · S2에서 채워짐</p>
    </aside>
  );
}
