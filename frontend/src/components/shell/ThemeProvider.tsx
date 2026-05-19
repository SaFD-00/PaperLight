"use client";

import { useEffect } from "react";
import { useSettings } from "@/stores/settings";
import { applyDensity, applyTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  return <>{children}</>;
}
