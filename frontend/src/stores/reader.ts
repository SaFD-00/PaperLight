import { create } from "zustand";
import { capture } from "@/lib/analytics";
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
  /** 본문 확대율(%) — 100 = 기본 배율. */
  zoom: number;
  currentPage: number;
  /** PDF 전체 페이지 수 (미로드 시 0). */
  totalPages: number;
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
  zoomIn: () => void;
  zoomOut: () => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setPageText: (page: number, text: string) => void;
  requestJump: (page: number) => void;
  requestPanel: (panel: string) => void;
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 250;
const ZOOM_STEP = 10;

export const useReader = create<ReaderState>((set) => ({
  selection: null,
  explainText: null,
  askText: null,
  translateSelection: null,
  translationEnabled: false,
  zoom: 100,
  currentPage: 1,
  totalPages: 0,
  pageText: {},
  jumpRequest: null,
  panelRequest: null,
  setSelection: (s) => set({ selection: s }),
  triggerExplain: (text) => {
    capture("explain_requested", { length: text.length });
    set({ explainText: text, selection: null });
  },
  clearExplain: () => set({ explainText: null }),
  triggerAsk: (text) => set({ askText: text, selection: null }),
  clearAsk: () => set({ askText: null }),
  triggerTranslateSelection: (sel) => {
    capture("translate_requested", { length: sel.text.length });
    set({ translateSelection: sel, selection: null });
  },
  clearTranslateSelection: () => set({ translateSelection: null }),
  toggleTranslation: () => set((state) => ({ translationEnabled: !state.translationEnabled })),
  setTranslation: (enabled) => set({ translationEnabled: enabled }),
  zoomIn: () => set((state) => ({ zoom: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setPageText: (page, text) =>
    set((state) => ({ pageText: { ...state.pageText, [page]: text } })),
  requestJump: (page) => set({ jumpRequest: { page, nonce: Date.now() } }),
  requestPanel: (panel) => set({ panelRequest: { panel, nonce: Date.now() } }),
}));
