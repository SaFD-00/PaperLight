"use client";

import { Download, FileText, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamSse } from "@/lib/sse";
import { useMarkup } from "@/stores/markup";
import { useReader } from "@/stores/reader";

const SWATCH: Record<string, string> = {
  yellow: "#ffe066",
  blue: "#7db0ff",
  green: "#8cdea0",
  red: "#ff9191",
  purple: "#c39bff",
};

export function NotesPanel({ paperId }: { paperId: string }) {
  const note = useMarkup((s) => s.note);
  const highlights = useMarkup((s) => s.highlights);
  const fetchNote = useMarkup((s) => s.fetchNote);
  const fetchHighlights = useMarkup((s) => s.fetchHighlights);
  const saveNote = useMarkup((s) => s.saveNote);
  const removeHighlight = useMarkup((s) => s.removeHighlight);
  const exportNotes = useMarkup((s) => s.exportNotes);
  const exportToNotion = useMarkup((s) => s.exportToNotion);
  const requestJump = useReader((s) => s.requestJump);

  const [md, setMd] = useState("");
  const [saved, setSaved] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [notionMsg, setNotionMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    fetchNote(paperId);
    fetchHighlights(paperId);
  }, [paperId, fetchNote, fetchHighlights]);

  useEffect(() => {
    if (note && loadedFor.current !== note.id) {
      setMd(note.markdownText);
      loadedFor.current = note.id;
      setSaved(true);
    }
  }, [note]);

  function scheduleSave(next: string) {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveNote(paperId, next).then(() => setSaved(true));
    }, 400);
  }

  function onChange(next: string) {
    setMd(next);
    scheduleSave(next);
  }

  function runAi() {
    if (aiBusy) return;
    const lines = md.split("\n");
    let realIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trimStart().startsWith("/ai ")) {
        realIdx = i;
        break;
      }
    }
    if (realIdx === -1) return;
    const question = lines[realIdx].trimStart().slice(4).trim();
    if (!question) return;
    lines[realIdx] = `**Q:** ${question}\n\n**AI:** `;
    let base = lines.join("\n");
    setMd(base);
    setAiBusy(true);
    streamSse(
      "/api/chat",
      { paperId, question },
      {
        onToken: (t) => {
          base += t;
          setMd(base);
        },
        onDone: () => {
          setAiBusy(false);
          scheduleSave(base);
        },
        onError: () => setAiBusy(false),
      },
    );
  }

  async function doExport(format: "markdown" | "obsidian") {
    const text = await exportNotes(paperId, format);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${paperId}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doNotion() {
    const result = await exportToNotion(paperId);
    if (result.mode === "created" && result.url) {
      window.open(result.url, "_blank", "noreferrer");
      setNotionMsg("Notion에 저장됨");
    } else {
      if (result.markdown) await navigator.clipboard?.writeText(result.markdown).catch(() => {});
      setNotionMsg("Notion 미연동 — 마크다운을 클립보드에 복사했습니다");
    }
    setTimeout(() => setNotionMsg(null), 4000);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <FileText className="size-4 text-text-secondary" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</h2>
        <span className="ml-auto text-[10px] text-text-muted">{saved ? "저장됨" : "저장 중…"}</span>
        <button
          type="button"
          onClick={() => doExport("markdown")}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-bg-muted"
          aria-label="Markdown 내보내기"
        >
          <Download className="size-3" aria-hidden /> Markdown
        </button>
        <button
          type="button"
          onClick={() => doExport("obsidian")}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-bg-muted"
          aria-label="Obsidian 내보내기"
        >
          <Download className="size-3" aria-hidden /> Obsidian
        </button>
        <button
          type="button"
          onClick={doNotion}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-bg-muted"
          aria-label="Notion 내보내기"
        >
          <Download className="size-3" aria-hidden /> Notion
        </button>
      </header>

      {notionMsg && (
        <div className="border-b border-border-subtle bg-bg-muted px-3 py-1 text-[11px] text-text-secondary">
          {notionMsg}
        </div>
      )}

      <section aria-label="하이라이트 목록" className="border-b border-border-subtle">
        {highlights.length === 0 ? (
          <p className="px-3 py-2 text-xs text-text-muted">하이라이트가 없습니다.</p>
        ) : (
          <ul className="max-h-40 overflow-y-auto py-1">
            {highlights.map((h) => (
              <li key={h.id} className="group flex items-center gap-2 px-3 py-1 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full border border-border-default"
                  style={{ backgroundColor: SWATCH[h.color ?? "yellow"] ?? "#ffe066" }}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => requestJump(h.page)}
                  className="flex-1 truncate text-left text-text-primary hover:text-brand-primary"
                  title={h.text}
                >
                  {h.text || "(빈 하이라이트)"}
                </button>
                <span className="shrink-0 text-[10px] text-text-muted">p.{h.page}</span>
                <button
                  type="button"
                  onClick={() => removeHighlight(h.id)}
                  aria-label="하이라이트 삭제"
                  className="shrink-0 rounded p-0.5 text-text-muted opacity-0 hover:bg-bg-muted hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <textarea
        aria-label="노트 편집"
        value={md}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            runAi();
          }
        }}
        placeholder="Markdown으로 메모를 작성하세요. 줄 맨 앞에 /ai 질문 후 Cmd+Enter로 AI에게 물어보세요."
        className="flex-1 resize-none bg-transparent px-3 py-2 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
      />
      {aiBusy && (
        <div className="border-t border-border-subtle px-3 py-1 text-[10px] text-brand-primary">
          AI 응답 생성 중…
        </div>
      )}
    </div>
  );
}
