import { create } from "zustand";
import type { NormRect } from "@/lib/types";

export interface SelectionInfo {
  text: string;
  page: number | null;
  /** host-document 좌표계의 rect (iframe offset 합산됨) */
  hostRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  /** S14: page-relative normalized rects for highlight anchoring. */
  rects: NormRect[];
}

export interface TranslateSelection {
  text: string;
  hostRect: SelectionInfo["hostRect"];
}

interface ReaderState {
  selection: SelectionInfo | null;
  explainText: string | null;
  askText: string | null;
  translateSelection: TranslateSelection | null;
  translationEnabled: boolean;
  currentPage: number;
  pageText: Record<number, string>;
  /** Citation jump signal — nonce forces re-fire even when page repeats. */
  jumpRequest: { page: number; nonce: number } | null;
  /** S14: request RightPanel to switch tabs (e.g. highlight click → notes). */
  panelRequest: { panel: string; nonce: number } | null;
  setSelection: (s: SelectionInfo | null) => void;
  triggerExplain: (text: string) => void;
  clearExplain: () => void;
  triggerAsk: (text: string) => void;
  clearAsk: () => void;
  triggerTranslateSelection: (sel: TranslateSelection) => void;
  clearTranslateSelection: () => void;
  toggleTranslation: () => void;
  setTranslation: (enabled: boolean) => void;
  setCurrentPage: (page: number) => void;
  setPageText: (page: number, text: string) => void;
  requestJump: (page: number) => void;
  requestPanel: (panel: string) => void;
}

export const useReader = create<ReaderState>((set) => ({
  selection: null,
  explainText: null,
  askText: null,
  translateSelection: null,
  translationEnabled: false,
  currentPage: 1,
  pageText: {},
  jumpRequest: null,
  panelRequest: null,
  setSelection: (s) => set({ selection: s }),
  triggerExplain: (text) => set({ explainText: text, selection: null }),
  clearExplain: () => set({ explainText: null }),
  triggerAsk: (text) => set({ askText: text, selection: null }),
  clearAsk: () => set({ askText: null }),
  triggerTranslateSelection: (sel) => set({ translateSelection: sel, selection: null }),
  clearTranslateSelection: () => set({ translateSelection: null }),
  toggleTranslation: () => set((state) => ({ translationEnabled: !state.translationEnabled })),
  setTranslation: (enabled) => set({ translationEnabled: enabled }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setPageText: (page, text) =>
    set((state) => ({ pageText: { ...state.pageText, [page]: text } })),
  requestJump: (page) => set({ jumpRequest: { page, nonce: Date.now() } }),
  requestPanel: (panel) => set({ panelRequest: { panel, nonce: Date.now() } }),
}));
