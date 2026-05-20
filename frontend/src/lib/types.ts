export type IngestionStatus = "pending" | "parsing" | "embedding" | "ready" | "failed";

export interface ArxivMeta {
  arxivId: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  doi: string | null;
  categories: string[];
  pdfUrl: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[] | null;
  year: number | null;
  venue: string | null;
  arxivId: string | null;
  doi: string | null;
  status: string;
  progressPct: number;
  ingestionStatus: IngestionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  position: number;
  isSpecial: boolean;
  specialKind: string | null;
  paperCount: number;
}

export interface LibraryTag {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

export interface PaperTagRef {
  id: string;
  name: string;
  color: string | null;
}

export interface LibraryPaper extends Paper {
  tags: PaperTagRef[];
  collectionIds: string[];
}

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HighlightBbox {
  rects: NormRect[];
}

export interface Highlight {
  id: string;
  paperId: string;
  page: number;
  bbox: HighlightBbox;
  text: string;
  color: string | null;
  category: string;
  source: string;
  createdAt: number;
}

export interface Note {
  id: string;
  paperId: string;
  markdownText: string;
  s3BackupKey: string | null;
  createdAt: number;
  updatedAt: number;
}

const ARXIV_ID_RE = /(\d{4}\.\d{4,5})/;

export function extractArxivId(input: string): string | null {
  return ARXIV_ID_RE.exec(input.trim())?.[1] ?? null;
}
