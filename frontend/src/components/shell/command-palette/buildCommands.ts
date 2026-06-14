import { BookOpen, FileDown, FileText, Home, Moon, Rows3 } from "lucide-react";
import { cycle, DENSITY_CYCLE, THEME_CYCLE } from "@/lib/cycle";
import type { Density, Theme } from "@/stores/settings";

export interface PaperLite {
  id: string;
  title: string;
  authors?: string[];
}

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Home;
  run: () => void;
}

interface BuildDeps {
  router: { push: (href: string) => void };
  openTab: (input: { paperId: string; title: string }) => void;
  theme: Theme;
  density: Density;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  papers: PaperLite[];
}

/** 팔레트 명령 목록 구성 — 페이지 이동 + 테마/밀도 토글 + 논문 열기. */
export function buildCommands({
  router,
  openTab,
  theme,
  density,
  setTheme,
  setDensity,
  papers,
}: BuildDeps): Command[] {
  const nav: Command[] = [
    {
      id: "nav-library",
      label: "내 라이브러리",
      hint: "이동",
      icon: BookOpen,
      run: () => router.push("/library"),
    },
    {
      id: "nav-import",
      label: "PDF 추가 (업로드 · arXiv)",
      hint: "이동",
      icon: FileDown,
      run: () => router.push("/import"),
    },
    { id: "nav-home", label: "홈(랜딩)", hint: "이동", icon: Home, run: () => router.push("/") },
  ];
  const settings: Command[] = [
    {
      id: "set-theme",
      label: `테마 전환 (현재: ${theme})`,
      hint: "설정",
      icon: Moon,
      run: () => setTheme(cycle(THEME_CYCLE, theme)),
    },
    {
      id: "set-density",
      label: `밀도 전환 (현재: ${density})`,
      hint: "설정",
      icon: Rows3,
      run: () => setDensity(cycle(DENSITY_CYCLE, density)),
    },
  ];
  const paperCmds: Command[] = papers.map((p) => ({
    id: `paper-${p.id}`,
    label: p.title,
    hint: p.authors?.[0] ? `논문 · ${p.authors[0]}` : "논문 열기",
    icon: FileText,
    run: () => {
      openTab({ paperId: p.id, title: p.title });
      router.push(`/r/${p.id}`);
    },
  }));
  return [...nav, ...settings, ...paperCmds];
}
