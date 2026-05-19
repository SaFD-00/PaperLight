import { create } from "zustand";

export type Theme = "auto" | "light" | "dark";
export type Density = "compact" | "cozy" | "spacious";

interface SettingsState {
  theme: Theme;
  density: Density;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  theme: "auto",
  density: "cozy",
  setTheme: (theme) => set({ theme }),
  setDensity: (density) => set({ density }),
}));
