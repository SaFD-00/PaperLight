"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { TabBar } from "@/components/shell/TabBar";
import { TopToolbar } from "@/components/shell/TopToolbar";
import { ThemeProvider } from "@/components/shell/ThemeProvider";
import { useTabShortcuts } from "@/lib/shortcuts";
import { fetchTabs } from "@/lib/tab-sync";
import { useTabs } from "@/stores/tabs";

/** 랜딩은 앱 크롬(탭바·툴바) 없이 전체 화면으로 보여준다. */
const BARE_ROUTES = new Set(["/"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  useTabShortcuts();
  const pathname = usePathname();
  const hydrate = useTabs((s) => s.hydrate);
  const bare = BARE_ROUTES.has(pathname);

  useEffect(() => {
    // 단일 사용자: 서버에 저장된 탭을 무조건 복원한다.
    void fetchTabs().then((tabs) => {
      if (tabs) hydrate(tabs);
    });
  }, [hydrate]);

  return (
    <ThemeProvider>
      <CommandPalette />
      {bare ? (
        <main className="flex-1 overflow-y-auto">{children}</main>
      ) : (
        <>
          <TabBar />
          <TopToolbar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </>
      )}
    </ThemeProvider>
  );
}
