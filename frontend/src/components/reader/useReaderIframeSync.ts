"use client";

import { type RefObject, useEffect, useRef } from "react";
import { HOST_SOURCE, type HostToIframeMessage } from "@/lib/pdf/messages";
import { useMarkup } from "@/stores/markup";
import { useReader } from "@/stores/reader";
import { useSettings } from "@/stores/settings";

/** zoom 100% 가 대응하는 iframe(viewer.js)의 기본 배율. */
const BASE_SCALE = 1.25;

type Status = "idle" | "loading" | "ready" | "error";

/**
 * 스토어 상태 변화를 iframe(viewer.js)으로 push 하는 outbound 동기화 모음.
 * 줌·점프·검색·아웃라인·썸네일·하이라이트·번역 토글/글꼴/지연 본문요청.
 * 각 effect는 원본과 동일한 deps로 동작을 보존한다.
 */
export function useReaderIframeSync(args: {
  postToIframe: (msg: HostToIframeMessage) => void;
  iframeReadyRef: RefObject<boolean>;
  requestedRef: RefObject<Set<number>>;
  status: Status;
}) {
  const { postToIframe, iframeReadyRef, requestedRef, status } = args;

  const translationEnabled = useReader((s) => s.translationEnabled);
  const currentPage = useReader((s) => s.currentPage);
  const zoom = useReader((s) => s.zoom);
  const jumpRequest = useReader((s) => s.jumpRequest);
  const findRequest = useReader((s) => s.findRequest);
  const findStepRequest = useReader((s) => s.findStepRequest);
  const outlineRequest = useReader((s) => s.outlineRequest);
  const thumbnailsRequest = useReader((s) => s.thumbnailsRequest);
  const highlights = useMarkup((s) => s.highlights);
  const translationFontFamily = useSettings((s) => s.translationFontFamily);
  const readerFontScale = useSettings((s) => s.readerFontScale);

  const prevZoomRef = useRef(zoom);

  // 번역 ON & 보이는 페이지가 미요청이면 본문 텍스트 요청(스크롤 따라 lazy).
  useEffect(() => {
    if (!translationEnabled) return;
    if (status !== "ready") return;
    if (!iframeReadyRef.current) return;
    if (requestedRef.current.has(currentPage)) return;
    requestedRef.current.add(currentPage);
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_PAGE_TEXT", page: currentPage });
  }, [translationEnabled, currentPage, status]);

  // 토글 상태를 iframe에 알려 번역 컬럼 표시/숨김 + 본문 hover를 켜고 끈다.
  useEffect(() => {
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "TOGGLE_TRANSLATION", enabled: translationEnabled });
  }, [translationEnabled, status]);

  // 번역 컬럼 글꼴(종류·크기)을 iframe에 전달 (iframe은 host CSS 변수를 못 봄).
  useEffect(() => {
    if (!iframeReadyRef.current) return;
    postToIframe({
      source: HOST_SOURCE,
      type: "SET_TRANSLATION_FONT",
      family: translationFontFamily,
      scale: readerFontScale,
    });
  }, [translationFontFamily, readerFontScale, status]);

  // 줌 변경 시 iframe 재렌더 요청 (초기 ready 시점에는 기본 배율이라 생략).
  useEffect(() => {
    if (status !== "ready") return;
    if (prevZoomRef.current === zoom) return;
    prevZoomRef.current = zoom;
    postToIframe({ source: HOST_SOURCE, type: "SET_ZOOM", scale: (zoom / 100) * BASE_SCALE });
  }, [zoom, status]);

  // Citation 클릭 → 해당 페이지로 점프 (F-03).
  useEffect(() => {
    if (!jumpRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "JUMP_TO", page: jumpRequest.page });
  }, [jumpRequest]);

  // 페이지 내 검색: 검색어 변경 → iframe FIND, 이전·다음 → FIND_STEP.
  useEffect(() => {
    if (!findRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "FIND", query: findRequest.query });
  }, [findRequest]);

  useEffect(() => {
    if (!findStepRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "FIND_STEP", dir: findStepRequest.dir });
  }, [findStepRequest]);

  // Sidebar 요청 → iframe에 outline/thumbnail 요청 전달.
  useEffect(() => {
    if (!outlineRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_OUTLINE" });
  }, [outlineRequest]);

  useEffect(() => {
    if (!thumbnailsRequest) return;
    if (!iframeReadyRef.current) return;
    postToIframe({ source: HOST_SOURCE, type: "REQUEST_THUMBNAILS" });
  }, [thumbnailsRequest]);

  // S14: PDF ready 또는 하이라이트 변경 시 overlay 재렌더 요청.
  useEffect(() => {
    if (status !== "ready") return;
    postToIframe({
      source: HOST_SOURCE,
      type: "RENDER_HIGHLIGHTS",
      highlights: highlights.map((h) => ({
        id: h.id,
        page: h.page,
        color: h.color,
        rects: h.bbox.rects,
      })),
    });
  }, [status, highlights]);
}
