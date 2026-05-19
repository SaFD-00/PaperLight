export interface ShadowIframeHandle {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  iframe: HTMLIFrameElement;
  destroy: () => void;
}

/**
 * Moonlight 차용 — pdf.js viewer를 Shadow DOM 안 iframe으로 격리.
 * 호스트 CSS·키 이벤트 충돌 방지. (ARCHITECTURE §4)
 */
export function createShadowIframe(mount: HTMLElement, src: string): ShadowIframeHandle {
  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:100%;height:100%;display:block;";
  mount.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = "PaperLight PDF Viewer";
  iframe.referrerPolicy = "no-referrer";
  iframe.style.cssText =
    "width:100%;height:100%;border:0;background:var(--bg-base,#2a2a2e);display:block;";
  shadow.appendChild(iframe);

  return {
    host,
    shadow,
    iframe,
    destroy: () => host.remove(),
  };
}
