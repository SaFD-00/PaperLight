"use client";

import { useEffect } from "react";
import { TabBar } from "@/components/shell/TabBar";
import { TopToolbar } from "@/components/shell/TopToolbar";
import { ThemeProvider } from "@/components/shell/ThemeProvider";
import { useTabShortcuts } from "@/lib/shortcuts";
import { fetchTabs } from "@/lib/tab-sync";
import { useTabs } from "@/stores/tabs";

export function AppShell({ children }: { children: React.ReactNode }) {
  useTabShortcuts();
  const hydrate = useTabs((s) => s.hydrate);

  useEffect(() => {
    void fetchTabs().then((tabs) => {
      if (tabs) hydrate(tabs);
    });
  }, [hydrate]);

  return (
    <ThemeProvider>
      <TabBar />
      <TopToolbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </ThemeProvider>
  );
}
