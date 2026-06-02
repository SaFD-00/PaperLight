import type { LibraryPaper } from "@/lib/types";

// 빈 라이브러리에서 보여줄 파일럿 샘플 논문. 백엔드가 시드하면 id 기준 디듀프되어 중복 표시되지 않음.
export const PILOTS: LibraryPaper[] = [
  {
    id: "sample-1",
    title: "Code2World: A GUI World Model via Renderable Code Generation",
    authors: ["Zheng et al., 2026"],
    year: 2026,
    venue: null,
    arxivId: "2602.09856",
    doi: null,
    status: "to_read",
    progressPct: 0,
    ingestionStatus: "ready",
    createdAt: 0,
    updatedAt: 0,
    tags: [],
    collectionIds: [],
  },
  {
    id: "sample-2",
    title: "How Mobile World Model Guides GUI Agents?",
    authors: ["Xu et al., 2026"],
    year: 2026,
    venue: null,
    arxivId: "2605.10347",
    doi: null,
    status: "to_read",
    progressPct: 0,
    ingestionStatus: "ready",
    createdAt: 0,
    updatedAt: 0,
    tags: [],
    collectionIds: [],
  },
];
