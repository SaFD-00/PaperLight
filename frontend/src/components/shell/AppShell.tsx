"use client";

import { useEffect } from "react";
import { TabBar } from "@/components/shell/TabBar";
import { TopToolbar } from "@/components/shell/TopToolbar";
import { ThemeProvider } from "@/components/shell/ThemeProvider";
import { useTabShortcuts } from "@/lib/shortcuts";
import { fetchTabs } from "@/lib/tab-sync";
import { useAuth } from "@/stores/auth";
import { useTabs } from "@/stores/tabs";

export function AppShell({ children }: { children: React.ReactNode }) {
  useTabShortcuts();
  const hydrate = useTabs((s) => s.hydrate);
  const refreshMe = useAuth((s) => s.refreshMe);

  useEffect(() => {
    void refreshMe();
    void fetchTabs().then((tabs) => {
      if (tabs) hydrate(tabs);
    });
  }, [hydrate, refreshMe]);

  return (
    <ThemeProvider>
      <TabBar />
      <TopToolbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </ThemeProvider>
  );
}
