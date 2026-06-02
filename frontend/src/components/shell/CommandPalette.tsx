"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileDown,
  FileText,
  Home,
  Moon,
  Rows3,
  Search,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cycle, DENSITY_CYCLE, THEME_CYCLE } from "@/lib/cycle";
import { useCommand } from "@/stores/command";
import { useSettings } from "@/stores/settings";
import { useTabs } from "@/stores/tabs";

interface PaperLite {
  id: string;
  title: string;
  authors?: string[];
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Home;
  run: () => void;
}

export function CommandPalette() {
  const open = useCommand((s) => s.open);
  const setOpen = useCommand((s) => s.setOpen);
  const router = useRouter();
  const openTab = useTabs((s) => s.openTab);
  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);
  const setTheme = useSettings((s) => s.setTheme);
  const setDensity = useSettings((s) => s.setDensity);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [papers, setPapers] = useState<PaperLite[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, [setOpen]);

  // 팔레트 열 때 포커스 + 논문 목록 1회 로드.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    let alive = true;
    apiFetch("/api/papers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PaperLite[]) => alive && setPapers(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "nav-library", label: "내 라이브러리", hint: "이동", icon: BookOpen, run: () => router.push("/library") },
      { id: "nav-import", label: "arXiv 논문 가져오기", hint: "이동", icon: FileDown, run: () => router.push("/import") },
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
  }, [router, openTab, theme, density, setTheme, setDensity, papers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [commands, query]);

  // query 변경 시 선택 인덱스 리셋.
  useEffect(() => setActive(0), [query]);

  // 전역 Esc 보장(인풋 외부 포커스 시에도).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[active];
      if (cmd) {
        cmd.run();
        close();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-overlay p-4 pt-[12vh]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="명령 팔레트"
        className="pl-rise w-full max-w-lg overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3">
          <Search size={16} className="text-text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="논문 검색, 이동, 설정…"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="rounded border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-muted">
            Esc
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-text-muted">결과가 없습니다.</li>
          ) : (
            filtered.map((c, i) => {
              const Icon = c.icon;
              const isActive = i === active;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      c.run();
                      close();
                    }}
                    className={
                      isActive
                        ? "flex w-full items-center gap-3 rounded-lg bg-brand-primary-soft px-3 py-2 text-left"
                        : "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-bg-muted"
                    }
                  >
                    <Icon
                      size={15}
                      className={isActive ? "text-brand-primary" : "text-text-muted"}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {c.label}
                    </span>
                    {c.hint ? (
                      <span className="shrink-0 text-[11px] text-text-muted">{c.hint}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex items-center gap-3 border-t border-border-subtle px-4 py-2 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <Sparkles size={11} /> PaperLight
          </span>
          <span className="ml-auto">↑↓ 이동 · ↵ 실행 · Esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
