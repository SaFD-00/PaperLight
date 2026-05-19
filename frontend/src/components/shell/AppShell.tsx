"use client";

import { TabBar } from "@/components/shell/TabBar";
import { TopToolbar } from "@/components/shell/TopToolbar";
import { ThemeProvider } from "@/components/shell/ThemeProvider";
import { useTabShortcuts } from "@/lib/shortcuts";

export function AppShell({ children }: { children: React.ReactNode }) {
  useTabShortcuts();
  return (
    <ThemeProvider>
      <TabBar />
      <TopToolbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </ThemeProvider>
  );
}
