import { create } from "zustand";

import { apiFetch, isBrowser } from "@/lib/api";
import type { Collection, LibraryPaper, LibraryTag } from "@/lib/types";

export type SearchScope = "title" | "author" | "tag" | "content";

interface LibraryState {
  collections: Collection[];
  papers: LibraryPaper[];
  tags: LibraryTag[];
  activeCollectionId: string | null;
  selectedPaperId: string | null;
  selectedPaperIds: string[];
  query: string;
  scope: SearchScope[];
  filterTagIds: string[];
  sort: string;
  order: "asc" | "desc";
  loading: boolean;

  refreshAll: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  fetchTags: () => Promise<void>;
  fetchPapers: () => Promise<void>;

  setActiveCollection: (id: string | null) => void;
  setSearch: (query: string, scope?: SearchScope[]) => void;
  toggleFilterTag: (id: string) => void;
  setSort: (sort: string, order: "asc" | "desc") => void;

  selectPaper: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setSelection: (ids: string[]) => void;

  createCollection: (name: string, parentId?: string | null) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;

  addTag: (paperId: string, name: string) => Promise<void>;
  removeTag: (paperId: string, tagId: string) => Promise<void>;
  patchPaper: (
    paperId: string,
    body: { status?: string; starred?: boolean; trashed?: boolean },
  ) => Promise<void>;
  bulk: (action: string, value?: string) => Promise<void>;

  importRefs: (format: string, content: string) => Promise<number>;
  exportRefs: (paperIds: string[], format: string) => Promise<string>;
}

function buildQuery(state: LibraryState): string {
  const p = new URLSearchParams();
  if (state.activeCollectionId) p.set("collectionId", state.activeCollectionId);
  if (state.filterTagIds.length) p.set("tagIds", state.filterTagIds.join(","));
  if (state.query) {
    p.set("q", state.query);
    p.set("scope", state.scope.join(","));
  }
  p.set("sort", state.sort);
  p.set("order", state.order);
  return p.toString();
}

export const useLibrary = create<LibraryState>((set, get) => ({
  collections: [],
  papers: [],
  tags: [],
  activeCollectionId: null,
  selectedPaperId: null,
  selectedPaperIds: [],
  query: "",
  scope: ["title", "author"],
  filterTagIds: [],
  sort: "created",
  order: "desc",
  loading: false,

  refreshAll: async () => {
    await Promise.all([get().fetchCollections(), get().fetchTags(), get().fetchPapers()]);
  },

  fetchCollections: async () => {
    if (!isBrowser()) return;
    try {
      const res = await apiFetch("/api/library/collections");
      if (res.ok) set({ collections: (await res.json()) as Collection[] });
    } catch {
      // BE 미기동 시 빈 트리 유지
    }
  },

  fetchTags: async () => {
    if (!isBrowser()) return;
    try {
      const res = await apiFetch("/api/library/tags");
      if (res.ok) set({ tags: (await res.json()) as LibraryTag[] });
    } catch {
      // noop
    }
  },

  fetchPapers: async () => {
    if (!isBrowser()) return;
    set({ loading: true });
    try {
      const res = await apiFetch(`/api/library/papers?${buildQuery(get())}`);
      if (res.ok) set({ papers: (await res.json()) as LibraryPaper[] });
    } catch {
      // noop
    } finally {
      set({ loading: false });
    }
  },

  setActiveCollection: (id) => {
    set({ activeCollectionId: id, selectedPaperIds: [] });
    void get().fetchPapers();
  },
  setSearch: (query, scope) => {
    set((s) => ({ query, scope: scope ?? s.scope }));
    void get().fetchPapers();
  },
  toggleFilterTag: (id) => {
    set((s) => ({
      filterTagIds: s.filterTagIds.includes(id)
        ? s.filterTagIds.filter((t) => t !== id)
        : [...s.filterTagIds, id],
    }));
    void get().fetchPapers();
  },
  setSort: (sort, order) => {
    set({ sort, order });
    void get().fetchPapers();
  },

  selectPaper: (id) => set({ selectedPaperId: id }),
  toggleSelect: (id) =>
    set((s) => ({
      selectedPaperIds: s.selectedPaperIds.includes(id)
        ? s.selectedPaperIds.filter((p) => p !== id)
        : [...s.selectedPaperIds, id],
    })),
  clearSelection: () => set({ selectedPaperIds: [] }),
  setSelection: (ids) => set({ selectedPaperIds: ids }),

  createCollection: async (name, parentId = null) => {
    await apiFetch("/api/library/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
    await get().fetchCollections();
  },
  renameCollection: async (id, name) => {
    await apiFetch(`/api/library/collections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await get().fetchCollections();
  },
  deleteCollection: async (id) => {
    await apiFetch(`/api/library/collections/${id}`, { method: "DELETE" });
    set((s) => ({ activeCollectionId: s.activeCollectionId === id ? null : s.activeCollectionId }));
    await Promise.all([get().fetchCollections(), get().fetchPapers()]);
  },

  addTag: async (paperId, name) => {
    await apiFetch(`/api/library/papers/${paperId}/tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await Promise.all([get().fetchPapers(), get().fetchTags()]);
  },
  removeTag: async (paperId, tagId) => {
    await apiFetch(`/api/library/papers/${paperId}/tags/${tagId}`, { method: "DELETE" });
    await Promise.all([get().fetchPapers(), get().fetchTags()]);
  },
  patchPaper: async (paperId, body) => {
    await apiFetch(`/api/library/papers/${paperId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await get().fetchPapers();
  },
  bulk: async (action, value) => {
    const ids = get().selectedPaperIds;
    if (ids.length === 0) return;
    await apiFetch("/api/library/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paperIds: ids, action, value }),
    });
    set({ selectedPaperIds: [] });
    await Promise.all([get().fetchPapers(), get().fetchTags(), get().fetchCollections()]);
  },

  importRefs: async (format, content) => {
    const res = await apiFetch("/api/library/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format, content }),
    });
    let imported = 0;
    if (res.ok) imported = ((await res.json()) as { imported: number }).imported;
    await get().fetchPapers();
    return imported;
  },
  exportRefs: async (paperIds, format) => {
    const res = await apiFetch("/api/library/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paperIds, format }),
    });
    return res.ok ? await res.text() : "";
  },
}));
