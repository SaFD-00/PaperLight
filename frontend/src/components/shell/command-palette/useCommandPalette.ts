"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCommand } from "@/stores/command";
import { useSettings } from "@/stores/settings";
import { useTabs } from "@/stores/tabs";
import { buildCommands, type Command, type PaperLite } from "./buildCommands";

/** 명령 팔레트의 열림/검색/선택 상태와 키보드 핸들러. */
export function useCommandPalette() {
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

  const commands = useMemo<Command[]>(
    () => buildCommands({ router, openTab, theme, density, setTheme, setDensity, papers }),
    [router, openTab, theme, density, setTheme, setDensity, papers],
  );

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

  return {
    open,
    query,
    setQuery,
    active,
    setActive,
    filtered,
    inputRef,
    close,
    onInputKey,
  };
}
