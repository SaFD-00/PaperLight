"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTabs, LIBRARY_TAB_ID } from "@/stores/tabs";
import { Tab } from "@/components/shell/Tab";

let mockCounter = 0;
function nextMockPaper() {
  mockCounter += 1;
  return {
    paperId: `sample-${mockCounter}`,
    title: `Sample Paper ${mockCounter}`,
  };
}

export function TabBar() {
  const router = useRouter();
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activateTab = useTabs((s) => s.activateTab);
  const openTab = useTabs((s) => s.openTab);
  const closeTab = useTabs((s) => s.closeTab);

  const ordered = [...tabs].sort((a, b) => a.position - b.position);

  const navigateTo = (tabId: string) => {
    const t = tabs.find((x) => x.id === tabId);
    if (!t) return;
    if (t.isLibrary || !t.paperId) router.push("/library");
    else router.push(`/r/${t.paperId}`);
  };

  return (
    <div
      role="tablist"
      aria-label="열린 탭"
      className="flex h-9 shrink-0 items-stretch border-b border-border-subtle bg-bg-base"
    >
      {ordered.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          active={tab.id === activeId}
          onActivate={() => {
            activateTab(tab.id);
            navigateTo(tab.id);
          }}
          onClose={() => {
            const wasActive = tab.id === activeId;
            closeTab(tab.id);
            if (wasActive) {
              const nextActive = useTabs.getState().activeId;
              navigateTo(nextActive);
            }
          }}
        />
      ))}
      <button
        type="button"
        aria-label="새 탭 열기"
        onClick={() => {
          const mock = nextMockPaper();
          const id = openTab(mock);
          if (id) router.push(`/r/${mock.paperId}`);
        }}
        className="grid h-9 w-9 place-items-center text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
      >
        <Plus size={14} />
      </button>
      <div className="flex-1 border-b border-border-subtle bg-bg-base" aria-hidden />
    </div>
  );
}

export { LIBRARY_TAB_ID };
