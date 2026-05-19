"use client";

import { useEffect } from "react";
import { LIBRARY_TAB_ID, useTabs } from "@/stores/tabs";

export default function LibraryPage() {
  const activateTab = useTabs((s) => s.activateTab);
  useEffect(() => {
    activateTab(LIBRARY_TAB_ID);
  }, [activateTab]);

  return (
    <div className="grid h-full place-items-center text-text-muted">
      <div className="text-center">
        <p className="text-base font-medium">📚 라이브러리</p>
        <p className="mt-1 text-sm">4-pane (Tree / List / Detail / Tag Cloud) — Phase 1에서 본격 구현</p>
      </div>
    </div>
  );
}
