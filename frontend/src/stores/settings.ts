import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "auto" | "light" | "dark";
export type Density = "compact" | "cozy" | "spacious";
export type TranslationFontFamily = "sans" | "serif";

export const READER_FONT_SCALE_MIN = 0.8;
export const READER_FONT_SCALE_MAX = 1.4;
export const READER_FONT_SCALE_STEP = 0.05;

function clampScale(scale: number): number {
  return Math.min(READER_FONT_SCALE_MAX, Math.max(READER_FONT_SCALE_MIN, Math.round(scale * 100) / 100));
}

interface SettingsState {
  theme: Theme;
  density: Density;
  translationFontFamily: TranslationFontFamily;
  readerFontScale: number;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setTranslationFontFamily: (family: TranslationFontFamily) => void;
  setReaderFontScale: (scale: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "auto",
      density: "cozy",
      translationFontFamily: "serif",
      readerFontScale: 1,
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setTranslationFontFamily: (translationFontFamily) => set({ translationFontFamily }),
      setReaderFontScale: (scale) => set({ readerFontScale: clampScale(scale) }),
    }),
    {
      name: "paperlight-settings",
      partialize: (s) => ({
        theme: s.theme,
        density: s.density,
        translationFontFamily: s.translationFontFamily,
        readerFontScale: s.readerFontScale,
      }),
    },
  ),
);
