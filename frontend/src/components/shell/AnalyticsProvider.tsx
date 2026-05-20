"use client";

import { useEffect } from "react";
import { identify, initAnalytics } from "@/lib/analytics";
import { useAuth } from "@/stores/auth";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuth((s) => s.user?.id);

  useEffect(() => {
    void initAnalytics();
  }, []);

  useEffect(() => {
    if (userId) identify(userId);
  }, [userId]);

  return <>{children}</>;
}
