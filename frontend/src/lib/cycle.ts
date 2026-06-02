import type { Density, Theme } from "@/stores/settings";

// 테마/밀도 토글 순환 순서 (toolbar·command palette 공용)
export const THEME_CYCLE: Theme[] = ["auto", "light", "dark"];
export const DENSITY_CYCLE: Density[] = ["compact", "cozy", "spacious"];

/** 배열에서 current 다음 요소로 순환(끝이면 처음으로). */
export function cycle<T>(arr: T[], current: T): T {
  return arr[(arr.indexOf(current) + 1) % arr.length];
}
