import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import type { Highlight, HighlightBbox, Note } from "@/lib/types";

interface NewHighlight {
  page: number;
  bbox: HighlightBbox;
  text: string;
  color: string;
  category?: string;
}

interface MarkupState {
  highlights: Highlight[];
  note: Note | null;
  loading: boolean;
  fetchHighlights: (paperId: string) => Promise<void>;
  fetchNote: (paperId: string) => Promise<void>;
  addHighlight: (paperId: string, input: NewHighlight) => Promise<Highlight | null>;
  removeHighlight: (highlightId: string) => Promise<void>;
  saveNote: (paperId: string, markdownText: string) => Promise<void>;
  exportNotes: (paperId: string, format: "markdown" | "obsidian") => Promise<string>;
  reset: () => void;
}

export const useMarkup = create<MarkupState>((set, get) => ({
  highlights: [],
  note: null,
  loading: false,

  fetchHighlights: async (paperId) => {
    const res = await apiFetch(`/api/annotations/papers/${paperId}/highlights`);
    if (!res.ok) return;
    set({ highlights: (await res.json()) as Highlight[] });
  },

  fetchNote: async (paperId) => {
    const res = await apiFetch(`/api/annotations/papers/${paperId}/note`);
    if (!res.ok) return;
    set({ note: (await res.json()) as Note });
  },

  addHighlight: async (paperId, input) => {
    const res = await apiFetch(`/api/annotations/papers/${paperId}/highlights`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "user_custom", ...input }),
    });
    if (!res.ok) return null;
    const created = (await res.json()) as Highlight;
    set({ highlights: [...get().highlights, created] });
    return created;
  },

  removeHighlight: async (highlightId) => {
    const res = await apiFetch(`/api/annotations/highlights/${highlightId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    set({ highlights: get().highlights.filter((h) => h.id !== highlightId) });
  },

  saveNote: async (paperId, markdownText) => {
    const res = await apiFetch(`/api/annotations/papers/${paperId}/note`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdownText }),
    });
    if (!res.ok) return;
    set({ note: (await res.json()) as Note });
  },

  exportNotes: async (paperId, format) => {
    const res = await apiFetch(`/api/annotations/papers/${paperId}/export?format=${format}`);
    if (!res.ok) return "";
    return res.text();
  },

  reset: () => set({ highlights: [], note: null, loading: false }),
}));
