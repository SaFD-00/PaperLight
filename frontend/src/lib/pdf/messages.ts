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
  | { source: typeof HOST_SOURCE; type: "TOGGLE_TRANSLATION"; enabled: boolean };

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
      page: number | null;
    };
