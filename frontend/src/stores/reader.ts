import { create } from "zustand";

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
}

interface ReaderState {
  selection: SelectionInfo | null;
  explainText: string | null;
  setSelection: (s: SelectionInfo | null) => void;
  triggerExplain: (text: string) => void;
  clearExplain: () => void;
}

export const useReader = create<ReaderState>((set) => ({
  selection: null,
  explainText: null,
  setSelection: (s) => set({ selection: s }),
  triggerExplain: (text) => set({ explainText: text, selection: null }),
  clearExplain: () => set({ explainText: null }),
}));
