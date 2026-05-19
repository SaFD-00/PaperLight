import { create } from "zustand";

export const LIBRARY_TAB_ID = "library";
export const MAX_TABS = 10;

export type Tab = {
  id: string;
  paperId: string | null;
  title: string;
  position: number;
  pinned: boolean;
  isLibrary: boolean;
  openedAt: number;
  lastActiveAt: number;
};

interface TabsState {
  tabs: Tab[];
  activeId: string;
  openTab: (input: { paperId: string; title: string }) => string;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  reorderTab: (id: string, newPosition: number) => void;
  __resetForTests: () => void;
}

function seed(): Pick<TabsState, "tabs" | "activeId"> {
  const now = Date.now();
  return {
    tabs: [
      {
        id: LIBRARY_TAB_ID,
        paperId: null,
        title: "내 라이브러리",
        position: 0,
        pinned: true,
        isLibrary: true,
        openedAt: now,
        lastActiveAt: now,
      },
    ],
    activeId: LIBRARY_TAB_ID,
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function reflowPositions(tabs: Tab[]): Tab[] {
  const library = tabs.find((t) => t.isLibrary);
  const rest = tabs
    .filter((t) => !t.isLibrary)
    .sort((a, b) => a.position - b.position)
    .map((t, i) => ({ ...t, position: i + 1 }));
  return library ? [{ ...library, position: 0 }, ...rest] : rest;
}

export const useTabs = create<TabsState>((set, get) => ({
  ...seed(),

  openTab: ({ paperId, title }) => {
    const id = newId();
    const now = Date.now();
    const state = get();

    let workingTabs = state.tabs;
    if (workingTabs.length >= MAX_TABS) {
      const evictable = workingTabs
        .filter((t) => !t.pinned && !t.isLibrary)
        .sort((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
      if (evictable) {
        workingTabs = workingTabs.filter((t) => t.id !== evictable.id);
      }
    }

    const maxPos = workingTabs.reduce((m, t) => Math.max(m, t.position), 0);
    const next: Tab = {
      id,
      paperId,
      title,
      position: maxPos + 1,
      pinned: false,
      isLibrary: false,
      openedAt: now,
      lastActiveAt: now,
    };
    set({ tabs: [...workingTabs, next], activeId: id });
    return id;
  },

  closeTab: (id) => {
    if (id === LIBRARY_TAB_ID) return;
    const state = get();
    const remaining = state.tabs.filter((t) => t.id !== id);
    if (remaining.length === state.tabs.length) return;
    let activeId = state.activeId;
    if (activeId === id) {
      const next = remaining
        .filter((t) => !t.isLibrary)
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
      activeId = next?.id ?? LIBRARY_TAB_ID;
    }
    set({ tabs: reflowPositions(remaining), activeId });
  },

  activateTab: (id) => {
    const state = get();
    if (!state.tabs.some((t) => t.id === id)) return;
    const now = Date.now();
    set({
      activeId: id,
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, lastActiveAt: now } : t)),
    });
  },

  reorderTab: (id, newPosition) => {
    const state = get();
    const target = state.tabs.find((t) => t.id === id);
    if (!target || target.isLibrary) return;
    const clamped = Math.max(1, newPosition);
    const others = state.tabs
      .filter((t) => t.id !== id && !t.isLibrary)
      .sort((a, b) => a.position - b.position);
    const insertIndex = Math.min(others.length, clamped - 1);
    others.splice(insertIndex, 0, target);
    const library = state.tabs.find((t) => t.isLibrary);
    const reflowed: Tab[] = [];
    if (library) reflowed.push({ ...library, position: 0 });
    others.forEach((t, i) => reflowed.push({ ...t, position: i + 1 }));
    set({ tabs: reflowed });
  },

  __resetForTests: () => set(seed()),
}));
