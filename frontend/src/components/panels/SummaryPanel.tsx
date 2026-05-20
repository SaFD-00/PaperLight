"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status = "loading" | "empty" | "ready" | "error";

export function SummaryPanel({ paperId }: { paperId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [text, setText] = useState("");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    apiFetch(`/api/papers/${paperId}/summary`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const body = (await res.json()) as { text: string | null };
        if (!alive) return;
        if (body.text) {
          setText(body.text);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [paperId]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <BookOpen className="size-4 text-text-secondary" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Summary
        </h2>
      </header>
      <section className="flex-1 overflow-y-auto p-3 text-sm">
        {status === "loading" && <p className="text-text-muted">요약 불러오는 중…</p>}
        {status === "error" && (
          <p className="rounded bg-danger/10 p-2 text-danger">요약을 불러오지 못했습니다.</p>
        )}
        {status === "empty" && (
          <p className="text-text-muted">아직 요약이 생성되지 않았습니다. 인제스트 직후 자동 생성됩니다.</p>
        )}
        {status === "ready" && (
          <article className="whitespace-pre-wrap leading-relaxed text-text-primary">{text}</article>
        )}
      </section>
    </div>
  );
}
