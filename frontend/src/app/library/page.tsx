"use client";

import { useEffect } from "react";
import { LibraryShell } from "@/components/library/LibraryShell";
import { LIBRARY_TAB_ID, useTabs } from "@/stores/tabs";

export default function LibraryPage() {
  const activateTab = useTabs((s) => s.activateTab);
  useEffect(() => {
    activateTab(LIBRARY_TAB_ID);
  }, [activateTab]);

  return <LibraryShell />;
}
