import { create } from "zustand";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";

export interface DeepSearchResult {
  title: string;
  authors: string[];
  year: number | null;
  url: string;
  abstract: string | null;
  score: number;
  why: string;
}

interface DeepSearchState {
  results: DeepSearchResult[];
  loading: boolean;
  searched: boolean;
  search: (query: string) => Promise<void>;
}

export const useDeepSearch = create<DeepSearchState>((set) => ({
  results: [],
  loading: false,
  searched: false,
  search: async (query) => {
    if (!query.trim()) return;
    set({ loading: true });
    capture("deep_search", {});
    try {
      const res = await apiFetch("/api/deep-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) {
        set({ results: [], searched: true });
        return;
      }
      const body = (await res.json()) as { results: DeepSearchResult[] };
      set({ results: body.results, searched: true });
    } finally {
      set({ loading: false });
    }
  },
}));
