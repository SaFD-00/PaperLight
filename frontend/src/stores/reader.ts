import { create } from "zustand";
import { capture } from "@/lib/analytics";
import type { OutlineItem } from "@/lib/pdf/messages";
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

export interface ExplainSelection {
  text: string;
  hostRect: SelectionInfo["hostRect"];
}

interface ReaderState {
  selection: SelectionInfo | null;
  /** 인라인 설명 팝오버 대상(선택 텍스트 + 호스트 좌표). */
  explainSelection: ExplainSelection | null;
  askText: string | null;
  translateSelection: TranslateSelection | null;
  /** 해석 패널(우측, AI 패널과 별개) 열림 여부. 상단 [T] 토글과 연동. */
  translationEnabled: boolean;
  /** AI 탭 패널(우측) 열림 여부. */
  aiPanelOpen: boolean;
  /** 좌측 사이드바(TOC/페이지) 열림 여부. */
  sidebarOpen: boolean;
  /** 좌측 사이드바 표시 모드. */
  sidebarMode: "toc" | "pages";
  /** PDF에서 추출한 목차(TOC). */
  outline: OutlineItem[];
  /** 페이지별 썸네일 dataURL. */
  thumbnails: Record<number, string>;
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
  /** Sidebar → PdfViewer: request outline / thumbnails (nonce re-fires). */
  outlineRequest: { nonce: number } | null;
  thumbnailsRequest: { nonce: number } | null;
  setSelection: (s: SelectionInfo | null) => void;
  triggerExplain: (sel: ExplainSelection) => void;
  clearExplain: () => void;
  triggerAsk: (text: string) => void;
  clearAsk: () => void;
  triggerTranslateSelection: (sel: TranslateSelection) => void;
  clearTranslateSelection: () => void;
  toggleTranslation: () => void;
  setTranslation: (enabled: boolean) => void;
  toggleAiPanel: () => void;
  toggleSidebar: () => void;
  setSidebarMode: (mode: "toc" | "pages") => void;
  setOutline: (items: OutlineItem[]) => void;
  setThumbnail: (page: number, dataUrl: string) => void;
  requestOutline: () => void;
  requestThumbnails: () => void;
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
  explainSelection: null,
  askText: null,
  translateSelection: null,
  translationEnabled: false,
  aiPanelOpen: true,
  sidebarOpen: true,
  sidebarMode: "toc",
  outline: [],
  thumbnails: {},
  zoom: 100,
  currentPage: 1,
  totalPages: 0,
  pageText: {},
  jumpRequest: null,
  panelRequest: null,
  outlineRequest: null,
  thumbnailsRequest: null,
  setSelection: (s) => set({ selection: s }),
  triggerExplain: (sel) => {
    capture("explain_requested", { length: sel.text.length });
    set({ explainSelection: sel, selection: null });
  },
  clearExplain: () => set({ explainSelection: null }),
  triggerAsk: (text) => set({ askText: text, selection: null }),
  clearAsk: () => set({ askText: null }),
  triggerTranslateSelection: (sel) => {
    capture("translate_requested", { length: sel.text.length });
    set({ translateSelection: sel, selection: null });
  },
  clearTranslateSelection: () => set({ translateSelection: null }),
  toggleTranslation: () => set((state) => ({ translationEnabled: !state.translationEnabled })),
  setTranslation: (enabled) => set({ translationEnabled: enabled }),
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  setOutline: (items) => set({ outline: items }),
  setThumbnail: (page, dataUrl) =>
    set((state) => ({ thumbnails: { ...state.thumbnails, [page]: dataUrl } })),
  requestOutline: () => set({ outlineRequest: { nonce: Date.now() } }),
  requestThumbnails: () => set({ thumbnailsRequest: { nonce: Date.now() } }),
  zoomIn: () => set((state) => ({ zoom: Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP) })),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setPageText: (page, text) =>
    set((state) => ({ pageText: { ...state.pageText, [page]: text } })),
  requestJump: (page) => set({ jumpRequest: { page, nonce: Date.now() } }),
  requestPanel: (panel) => set({ panelRequest: { panel, nonce: Date.now() } }),
}));
