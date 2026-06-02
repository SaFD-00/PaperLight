"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCommand } from "@/stores/command";
import { useReader } from "@/stores/reader";
import { LIBRARY_TAB_ID, useTabs } from "@/stores/tabs";

function isMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export function useTabShortcuts(): void {
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!isMod(e)) return;

      // ⌘K → 명령 팔레트 토글(입력 중에도 동작).
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        useCommand.getState().toggle();
        return;
      }

      // ⌘F → 페이지 내 검색(리더 라우트에서만 브라우저 찾기 대체).
      if (e.key.toLowerCase() === "f" && window.location.pathname.startsWith("/r/")) {
        e.preventDefault();
        useReader.getState().openSearch();
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const ordered = [...useTabs.getState().tabs].sort((a, b) => a.position - b.position);

      // ⌘1~⌘9 → 해당 position 탭 활성화
      if (/^Digit[1-9]$/.test(e.code) || /^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (Number.isNaN(n)) return;
        const target = ordered[n - 1];
        if (!target) return;
        e.preventDefault();
        useTabs.getState().activateTab(target.id);
        if (target.isLibrary || !target.paperId) router.push("/library");
        else router.push(`/r/${target.paperId}`);
        return;
      }

      // ⌘W → 활성 탭 닫기
      if (e.key.toLowerCase() === "w" && !e.shiftKey) {
        const { activeId } = useTabs.getState();
        if (activeId === LIBRARY_TAB_ID) return;
        e.preventDefault();
        useTabs.getState().closeTab(activeId);
        const nextActive = useTabs.getState().activeId;
        const nextTab = useTabs.getState().tabs.find((t) => t.id === nextActive);
        if (!nextTab || nextTab.isLibrary || !nextTab.paperId) router.push("/library");
        else router.push(`/r/${nextTab.paperId}`);
        return;
      }

      // ⌘⇧← / ⌘⇧→ → 좌/우 탭으로 이동
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const { activeId } = useTabs.getState();
        const idx = ordered.findIndex((t) => t.id === activeId);
        if (idx === -1) return;
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const next = ordered[idx + delta];
        if (!next) return;
        e.preventDefault();
        useTabs.getState().activateTab(next.id);
        if (next.isLibrary || !next.paperId) router.push("/library");
        else router.push(`/r/${next.paperId}`);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}
