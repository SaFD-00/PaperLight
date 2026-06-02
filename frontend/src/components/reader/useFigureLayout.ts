"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { type FigureLayout, HOST_SOURCE, type HostToIframeMessage } from "@/lib/pdf/messages";

/**
 * 백엔드 figure bbox를 논문당 1회 fetch(marker 모드에서만 채워짐). 늦게 도착하면
 * 이미 REQUEST_FIGURES를 보낸 페이지에 push해 휴리스틱 버튼을 정밀 bbox로 교체한다.
 * 반환된 ref들은 iframe 메시지 디스패처의 REQUEST_FIGURES 처리에서 사용한다.
 */
export function useFigureLayout(paperId: string, postToIframe: (msg: HostToIframeMessage) => void) {
  const figuresByPageRef = useRef<Map<number, FigureLayout[]>>(new Map());
  const figuresLoadedRef = useRef(false);
  const requestedFiguresRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    figuresByPageRef.current = new Map();
    figuresLoadedRef.current = false;
    requestedFiguresRef.current.clear();
    let alive = true;
    apiFetch(`/api/papers/${paperId}/figures`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          figuresLoadedRef.current = true;
          return;
        }
        const body = (await res.json()) as { figures: FigureLayout[] };
        const map = new Map<number, FigureLayout[]>();
        for (const f of body.figures ?? []) {
          const arr = map.get(f.page) ?? [];
          arr.push(f);
          map.set(f.page, arr);
        }
        if (!alive) return;
        figuresByPageRef.current = map;
        figuresLoadedRef.current = true;
        for (const page of requestedFiguresRef.current) {
          postToIframe({
            source: HOST_SOURCE,
            type: "RENDER_FIGURES",
            page,
            figures: map.get(page) ?? [],
          });
        }
      })
      .catch(() => {
        if (alive) figuresLoadedRef.current = true;
      });
    return () => {
      alive = false;
    };
    // postToIframe은 handleRef만 읽어 안정적 — 원본과 동일하게 deps에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  return { figuresByPageRef, figuresLoadedRef, requestedFiguresRef };
}
