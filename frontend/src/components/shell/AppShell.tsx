"use client";

import { useEffect } from "react";
import { AnalyticsProvider } from "@/components/shell/AnalyticsProvider";
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
    // 탭 복원은 로그인 사용자 전용. 익명(게스트)은 공유 anonymous 유저로 동기화하면
    // 게스트끼리 서로의 탭을 보게 되므로 in-memory(세션 한정)로만 둔다.
    void refreshMe().then(() => {
      const u = useAuth.getState().user;
      if (u && !u.anonymous) {
        void fetchTabs().then((tabs) => {
          if (tabs) hydrate(tabs);
        });
      }
    });
  }, [hydrate, refreshMe]);

  return (
    <ThemeProvider>
      <AnalyticsProvider>
        <TabBar />
        <TopToolbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
