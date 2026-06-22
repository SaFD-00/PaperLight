import { Tab } from "paperlight-frontend";

const noop = () => {};
const mk = (over: Record<string, unknown>) => ({
  id: "t",
  paperId: "p",
  title: "Untitled",
  position: 1,
  pinned: false,
  isLibrary: false,
  openedAt: 0,
  lastActiveAt: 0,
  ...over,
});

/** 탭바에 놓인 라이브러리 탭 + 논문 탭 (활성/비활성). */
export function InTabBar() {
  return (
    <div role="tablist" style={{ display: "flex", height: 36, background: "var(--bg-base)", borderBottom: "1px solid var(--border-subtle)" }}>
      <Tab tab={mk({ id: "library", isLibrary: true, paperId: null, title: "내 라이브러리", pinned: true })} active={false} onActivate={noop} onClose={noop} />
      <Tab tab={mk({ id: "a", title: "AlphaFold 3" })} active onActivate={noop} onClose={noop} />
      <Tab tab={mk({ id: "b", title: "How Mobile World Models Learn Physics" })} active={false} onActivate={noop} onClose={noop} />
    </div>
  );
}

/** 활성 탭 단독 — brand 점 표시. */
export function Active() {
  return (
    <div style={{ display: "flex", height: 36, background: "var(--bg-base)" }}>
      <Tab tab={mk({ title: "Attention Is All You Need" })} active onActivate={noop} onClose={noop} />
    </div>
  );
}
