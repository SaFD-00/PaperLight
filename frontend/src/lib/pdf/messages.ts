import type { NormRect } from "@/lib/types";

export const HOST_SOURCE = "paperlight-pdf-host" as const;
export const IFRAME_SOURCE = "paperlight-pdf-iframe" as const;

export type SelectionRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

/** S14: a saved highlight to (re)render as overlays inside the iframe. */
export type HighlightOverlay = {
  id: string;
  page: number;
  color: string | null;
  rects: NormRect[];
};

/** A flattened TOC entry resolved to a 1-based page number. */
export type OutlineItem = {
  title: string;
  page: number;
  level: number;
};

/** Backend(marker) figure/table bbox — 정규화 top-left. 프론트 휴리스틱 대체. */
export type FigureLayout = {
  page: number;
  kind: "figure" | "table";
  label: string;
  bbox: { x: number; y: number; w: number; h: number };
  captionText: string;
};

export type HostToIframeMessage =
  | { source: typeof HOST_SOURCE; type: "LOAD_PDF"; url: string }
  | { source: typeof HOST_SOURCE; type: "JUMP_TO"; page: number }
  | { source: typeof HOST_SOURCE; type: "SET_ZOOM"; scale: number }
  | {
      source: typeof HOST_SOURCE;
      type: "HIGHLIGHT_REGION";
      page: number;
      rect: { x: number; y: number; w: number; h: number };
    }
  | { source: typeof HOST_SOURCE; type: "RENDER_HIGHLIGHTS"; highlights: HighlightOverlay[] }
  | { source: typeof HOST_SOURCE; type: "REMOVE_HIGHLIGHT"; id: string }
  | { source: typeof HOST_SOURCE; type: "TOGGLE_TRANSLATION"; enabled: boolean }
  | { source: typeof HOST_SOURCE; type: "REQUEST_PAGE_TEXT"; page: number }
  | { source: typeof HOST_SOURCE; type: "REQUEST_OUTLINE" }
  | { source: typeof HOST_SOURCE; type: "REQUEST_THUMBNAILS" }
  | { source: typeof HOST_SOURCE; type: "RENDER_FIGURES"; page: number; figures: FigureLayout[] }
  | {
      source: typeof HOST_SOURCE;
      type: "RENDER_TRANSLATION";
      page: number;
      pairs: TranslationPair[];
      /** true면 컬럼을 비우고 다시 채움(캐시 재푸시·재시작). */
      replace?: boolean;
    }
  | { source: typeof HOST_SOURCE; type: "CLEAR_TRANSLATION"; page?: number }
  | {
      source: typeof HOST_SOURCE;
      type: "SET_TRANSLATION_FONT";
      family: "sans" | "serif";
      scale: number;
    };

/** 페이지별 정렬 번역 한 문장. offset 은 body(필터된 본문) 공간 기준. */
export type TranslationPair = {
  i: number;
  tgt: string;
  bodyStart: number;
  bodyEnd: number;
};

export type IframeToHostMessage =
  | {
      source: typeof IFRAME_SOURCE;
      type: "READY";
      ready?: boolean;
      numPages?: number;
      error?: string;
    }
  | { source: typeof IFRAME_SOURCE; type: "PAGE_VISIBLE"; page: number }
  | {
      source: typeof IFRAME_SOURCE;
      type: "SELECTION_CHANGE";
      text: string;
      rect: SelectionRect | null;
      rects: NormRect[];
      page: number | null;
    }
  | { source: typeof IFRAME_SOURCE; type: "HIGHLIGHT_CLICK"; id: string }
  | { source: typeof IFRAME_SOURCE; type: "PAGE_TEXT"; page: number; text: string }
  | { source: typeof IFRAME_SOURCE; type: "REQUEST_FIGURES"; page: number }
  | { source: typeof IFRAME_SOURCE; type: "OUTLINE"; items: OutlineItem[] }
  | { source: typeof IFRAME_SOURCE; type: "THUMBNAIL"; page: number; dataUrl: string }
  | {
      source: typeof IFRAME_SOURCE;
      type: "FIGURE_EXPLAIN";
      page: number;
      kind: "figure" | "table";
      label: string;
      captionText: string;
      /** 캡션 영역을 잘라낸 PNG dataURL(비전 입력). */
      imageDataUrl: string;
      /** 설명 버튼의 iframe-viewport rect(호스트가 offset 보정해 팝오버 배치). */
      rect: SelectionRect;
    };
