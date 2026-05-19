import { beforeEach, describe, expect, it } from "vitest";
import { LIBRARY_TAB_ID, MAX_TABS, useTabs } from "@/stores/tabs";

function reset() {
  useTabs.getState().__resetForTests();
}

describe("tabsStore", () => {
  beforeEach(reset);

  it("seeds Library tab and activates it by default", () => {
    const s = useTabs.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0].id).toBe(LIBRARY_TAB_ID);
    expect(s.tabs[0].isLibrary).toBe(true);
    expect(s.tabs[0].pinned).toBe(true);
    expect(s.tabs[0].position).toBe(0);
    expect(s.activeId).toBe(LIBRARY_TAB_ID);
  });

  it("openTab appends a tab, activates it, and assigns next position", () => {
    const id = useTabs.getState().openTab({ paperId: "p1", title: "Paper 1" });
    const s = useTabs.getState();
    expect(s.tabs).toHaveLength(2);
    expect(s.activeId).toBe(id);
    const opened = s.tabs.find((t) => t.id === id);
    expect(opened?.paperId).toBe("p1");
    expect(opened?.position).toBe(1);
    expect(opened?.pinned).toBe(false);
    expect(opened?.isLibrary).toBe(false);
  });

  it("closeTab on active tab activates the most-recently-active remaining tab", () => {
    const idA = useTabs.getState().openTab({ paperId: "a", title: "A" });
    const idB = useTabs.getState().openTab({ paperId: "b", title: "B" });
    // Touch A to make it most recently active before B's close.
    useTabs.getState().activateTab(idA);
    useTabs.getState().activateTab(idB);
    useTabs.getState().closeTab(idB);
    expect(useTabs.getState().activeId).toBe(idA);
    expect(useTabs.getState().tabs.find((t) => t.id === idB)).toBeUndefined();
  });

  it("closeTab is a no-op for the Library tab", () => {
    useTabs.getState().closeTab(LIBRARY_TAB_ID);
    const s = useTabs.getState();
    expect(s.tabs.find((t) => t.id === LIBRARY_TAB_ID)).toBeDefined();
    expect(s.activeId).toBe(LIBRARY_TAB_ID);
  });

  it("11th openTab evicts the least-recently-active non-pinned tab", () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_TABS - 1; i++) {
      ids.push(useTabs.getState().openTab({ paperId: `p${i}`, title: `P${i}` }));
    }
    // Now we have Library + (MAX_TABS - 1) = MAX_TABS. ids[0] is the oldest.
    expect(useTabs.getState().tabs).toHaveLength(MAX_TABS);
    // Touch every tab except the first one to push ids[0] to the bottom of LRU.
    for (let i = 1; i < ids.length; i++) {
      useTabs.getState().activateTab(ids[i]);
    }
    const overflow = useTabs.getState().openTab({ paperId: "overflow", title: "Overflow" });
    const s = useTabs.getState();
    expect(s.tabs).toHaveLength(MAX_TABS);
    expect(s.tabs.find((t) => t.id === ids[0])).toBeUndefined();
    expect(s.tabs.find((t) => t.id === overflow)).toBeDefined();
    expect(s.activeId).toBe(overflow);
  });

  it("reorderTab keeps Library at position 0 and reflows non-library positions", () => {
    const idA = useTabs.getState().openTab({ paperId: "a", title: "A" });
    const idB = useTabs.getState().openTab({ paperId: "b", title: "B" });
    const idC = useTabs.getState().openTab({ paperId: "c", title: "C" });
    // Move B to the end.
    useTabs.getState().reorderTab(idB, 3);
    const s = useTabs.getState();
    const byId = (id: string) => s.tabs.find((t) => t.id === id)!;
    expect(byId(LIBRARY_TAB_ID).position).toBe(0);
    expect(byId(idA).position).toBe(1);
    expect(byId(idC).position).toBe(2);
    expect(byId(idB).position).toBe(3);
  });
});
