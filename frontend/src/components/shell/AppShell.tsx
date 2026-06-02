"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AnalyticsProvider } from "@/components/shell/AnalyticsProvider";
import { TabBar } from "@/components/shell/TabBar";
import { TopToolbar } from "@/components/shell/TopToolbar";
import { ThemeProvider } from "@/components/shell/ThemeProvider";
import { useTabShortcuts } from "@/lib/shortcuts";
import { fetchTabs } from "@/lib/tab-sync";
import { useAuth } from "@/stores/auth";
import { useTabs } from "@/stores/tabs";

/** 랜딩·로그인은 앱 크롬(탭바·툴바) 없이 전체 화면으로 보여준다. */
const BARE_ROUTES = new Set(["/", "/login"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  useTabShortcuts();
  const pathname = usePathname();
  const hydrate = useTabs((s) => s.hydrate);
  const refreshMe = useAuth((s) => s.refreshMe);
  const bare = BARE_ROUTES.has(pathname);

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
        {bare ? (
          <main className="flex-1 overflow-y-auto">{children}</main>
        ) : (
          <>
            <TabBar />
            <TopToolbar />
            <main className="flex-1 overflow-hidden">{children}</main>
          </>
        )}
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
