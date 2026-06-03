"use client";

import clsx from "clsx";
import { useEffect } from "react";
import { useReader } from "@/stores/reader";
import { ResizeHandle } from "./ResizeHandle";

export function Sidebar() {
  const mode = useReader((s) => s.sidebarMode);
  const setMode = useReader((s) => s.setSidebarMode);
  const width = useReader((s) => s.sidebarWidth);
  const setWidth = useReader((s) => s.setSidebarWidth);
  const outline = useReader((s) => s.outline);
  const thumbnails = useReader((s) => s.thumbnails);
  const totalPages = useReader((s) => s.totalPages);
  const currentPage = useReader((s) => s.currentPage);
  const requestThumbnails = useReader((s) => s.requestThumbnails);
  const requestJump = useReader((s) => s.requestJump);

  // 페이지 모드 진입 시 썸네일이 아직 없으면 1회 요청.
  useEffect(() => {
    if (mode === "pages" && Object.keys(thumbnails).length === 0) requestThumbnails();
  }, [mode, thumbnails, requestThumbnails]);

  return (
    <aside
      aria-label="목차/페이지 사이드바"
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-r border-border-subtle bg-bg-base text-text-secondary"
    >
      <div className="flex shrink-0 gap-0.5 border-b border-border-subtle p-1.5">
        {(["toc", "pages"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              mode === m
                ? "bg-bg-muted text-text-primary"
                : "text-text-secondary hover:bg-bg-muted hover:text-text-primary",
            )}
          >
            {m === "toc" ? "TOC" : "페이지"}
          </button>
        ))}
      </div>

      {mode === "toc" ? (
        <nav aria-label="목차" className="flex-1 overflow-y-auto p-1.5 text-sm">
          {outline.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-text-muted">목차를 찾지 못했습니다.</p>
          ) : (
            <ul className="space-y-0.5">
              {outline.map((item, i) => (
                <li key={`${item.page}-${i}`}>
                  <button
                    type="button"
                    onClick={() => requestJump(item.page)}
                    style={{ paddingLeft: 8 + item.level * 12 }}
                    className="flex w-full items-baseline gap-1 rounded-sm py-1 pr-2 text-left hover:bg-bg-muted hover:text-text-primary"
                    title={item.title}
                  >
                    <span className="flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-[10px] text-text-muted">{item.page}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      ) : (
        <div aria-label="페이지 썸네일" className="flex-1 overflow-y-auto p-2">
          {totalPages === 0 ? (
            <p className="px-1 py-2 text-[11px] text-text-muted">페이지 없음</p>
          ) : (
            <ul className="space-y-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <li key={page}>
                  <button
                    type="button"
                    onClick={() => requestJump(page)}
                    className={clsx(
                      "block w-full rounded-sm border bg-bg-surface p-1 transition-colors",
                      page === currentPage
                        ? "border-brand-primary"
                        : "border-border-subtle hover:border-border-default",
                    )}
                  >
                    {thumbnails[page] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnails[page]}
                        alt={`${page} 페이지`}
                        className="w-full"
                        draggable={false}
                      />
                    ) : (
                      <div className="grid aspect-[3/4] w-full place-items-center bg-bg-muted text-[10px] text-text-muted">
                        {page}
                      </div>
                    )}
                    <span className="mt-0.5 block text-center text-[10px] text-text-muted">
                      {page}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ResizeHandle side="right" width={width} onChange={setWidth} />
    </aside>
  );
}
