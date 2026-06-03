import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import type { FigureLayout } from "@/lib/pdf/messages";

interface FiguresState {
  /** paperId → 도표 layout(없으면 빈 배열). undefined = 아직 미조회. */
  byPaper: Record<string, FigureLayout[] | undefined>;
  fetchFigures: (paperId: string) => Promise<FigureLayout[]>;
}

/** 논문당 1회 figure layout fetch + 메모이즈(F-07 cross-ref 프리뷰 공용). */
export const useFigures = create<FiguresState>((set, get) => ({
  byPaper: {},
  fetchFigures: async (paperId) => {
    const cached = get().byPaper[paperId];
    if (cached !== undefined) return cached;
    let figures: FigureLayout[] = [];
    try {
      const res = await apiFetch(`/api/papers/${paperId}/figures`);
      if (res.ok) {
        const body = (await res.json()) as { figures?: FigureLayout[] };
        figures = body.figures ?? [];
      }
    } catch {
      figures = [];
    }
    set((s) => ({ byPaper: { ...s.byPaper, [paperId]: figures } }));
    return figures;
  },
}));
