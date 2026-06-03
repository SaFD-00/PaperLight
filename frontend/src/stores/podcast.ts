import { create } from "zustand";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";

export interface Podcast {
  id: string;
  paperId: string;
  status: "pending" | "processing" | "ready" | "failed";
  durationSec: number | null;
  scriptMd: string | null;
  audioUrl: string | null;
}

interface PodcastState {
  /** paperId → 최신 팟캐스트(없으면 null, 미조회 undefined). */
  byPaper: Record<string, Podcast | null | undefined>;
  generating: Record<string, boolean>;
  fetchForPaper: (paperId: string) => Promise<void>;
  generate: (paperId: string) => Promise<void>;
}

const POLL_MS = 1500;
const POLL_MAX = 120; // ~3분
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const usePodcast = create<PodcastState>((set, get) => ({
  byPaper: {},
  generating: {},

  fetchForPaper: async (paperId) => {
    const res = await apiFetch(`/api/podcast/paper/${paperId}`);
    if (!res.ok) return;
    const pod = (await res.json()) as Podcast | null;
    set((s) => ({ byPaper: { ...s.byPaper, [paperId]: pod } }));
  },

  generate: async (paperId) => {
    if (get().generating[paperId]) return;
    set((s) => ({ generating: { ...s.generating, [paperId]: true } }));
    capture("podcast_generate", {});
    try {
      const res = await apiFetch("/api/podcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id: string };
      for (let i = 0; i < POLL_MAX; i++) {
        const poll = await apiFetch(`/api/podcast/${id}`);
        if (poll.ok) {
          const pod = (await poll.json()) as Podcast;
          set((s) => ({ byPaper: { ...s.byPaper, [paperId]: pod } }));
          if (pod.status === "ready" || pod.status === "failed") return;
        }
        await sleep(POLL_MS);
      }
    } finally {
      set((s) => ({ generating: { ...s.generating, [paperId]: false } }));
    }
  },
}));
