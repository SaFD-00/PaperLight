import { create } from "zustand";

import { apiFetch, isBrowser } from "@/lib/api";
import { type ArxivMeta, extractArxivId, type Paper } from "@/lib/types";

interface PapersState {
  list: Paper[];
  meta: ArxivMeta | null;
  fetchingMeta: boolean;
  importing: boolean;
  error: string | null;
  refreshList: () => Promise<void>;
  fetchMeta: (input: string) => Promise<ArxivMeta | null>;
  importPaper: (input: string) => Promise<Paper | null>;
  reset: () => void;
}

export const usePapers = create<PapersState>((set) => ({
  list: [],
  meta: null,
  fetchingMeta: false,
  importing: false,
  error: null,
  refreshList: async () => {
    if (!isBrowser()) return;
    try {
      const res = await apiFetch("/api/papers");
      if (res.ok) set({ list: (await res.json()) as Paper[] });
    } catch {
      // BE 미기동 시 빈 목록 유지
    }
  },
  fetchMeta: async (input: string) => {
    const id = extractArxivId(input);
    if (!id) {
      set({ error: "유효한 arXiv ID 또는 URL이 아닙니다.", meta: null });
      return null;
    }
    set({ fetchingMeta: true, error: null });
    try {
      const res = await apiFetch(`/api/papers/arxiv/${id}`);
      if (!res.ok) {
        set({ fetchingMeta: false, error: "메타데이터 조회에 실패했습니다." });
        return null;
      }
      const meta = (await res.json()) as ArxivMeta;
      set({ meta, fetchingMeta: false });
      return meta;
    } catch {
      set({ fetchingMeta: false, error: "메타데이터 조회 중 오류가 발생했습니다." });
      return null;
    }
  },
  importPaper: async (input: string) => {
    set({ importing: true, error: null });
    try {
      const res = await apiFetch("/api/papers/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      if (!res.ok) {
        set({ importing: false, error: "가져오기에 실패했습니다." });
        return null;
      }
      const paper = (await res.json()) as Paper;
      set({ importing: false });
      return paper;
    } catch {
      set({ importing: false, error: "가져오기 중 오류가 발생했습니다." });
      return null;
    }
  },
  reset: () => set({ meta: null, error: null, fetchingMeta: false, importing: false }),
}));
