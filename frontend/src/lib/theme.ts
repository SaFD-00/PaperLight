import type { Density, Theme } from "@/stores/settings";

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "auto") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}

export function applyDensity(density: Density): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", density);
}
