"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/common/Markdown";
import { apiFetch } from "@/lib/api";

interface Paragraph {
  chunkId: string;
  page: number;
  description: string | null;
  importance: string | null;
}

interface Figure {
  chunkId: string;
  page: number;
  kind: "figure" | "table";
  description: string;
}

interface Insights {
  paragraphs: Paragraph[];
  figures: Figure[];
  highlights: string | null;
}

type Status = "loading" | "empty" | "ready" | "error";

function importanceClass(value: string | null): string {
  if (!value) return "bg-bg-muted text-text-muted";
  if (value.includes("Critical")) return "bg-danger/10 text-danger";
  if (value.includes("Important")) return "bg-warning/10 text-warning";
  return "bg-bg-muted text-text-muted";
}

export function InsightsPanel({ paperId }: { paperId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    apiFetch(`/api/papers/${paperId}/insights`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const body = (await res.json()) as Insights;
        if (!alive) return;
        setData(body);
        const empty =
          body.paragraphs.length === 0 && body.figures.length === 0 && !body.highlights;
        setStatus(empty ? "empty" : "ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [paperId]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <Sparkles className="size-4 text-text-secondary" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Insights
        </h2>
      </header>
      <section className="flex-1 space-y-4 overflow-y-auto p-3 text-sm">
        {status === "loading" && <p className="text-text-muted">통찰 불러오는 중…</p>}
        {status === "error" && (
          <p className="rounded bg-danger/10 p-2 text-danger">통찰을 불러오지 못했습니다.</p>
        )}
        {status === "empty" && (
          <p className="text-text-muted">
            아직 통찰이 생성되지 않았습니다. 인제스트 직후 자동 생성됩니다.
          </p>
        )}
        {status === "ready" && data && (
          <>
            {data.highlights && (
              <div>
                <h3 className="mb-1 text-xs font-semibold text-text-secondary">Auto Highlights</h3>
                <Markdown>{data.highlights}</Markdown>
              </div>
            )}
            {data.figures.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold text-text-secondary">Figures & Tables</h3>
                <ul className="space-y-2">
                  {data.figures.map((f) => (
                    <li key={`${f.kind}-${f.chunkId}`} className="rounded bg-bg-muted p-2">
                      <div className="mb-0.5 text-[11px] uppercase tracking-wide text-text-muted">
                        {f.kind} · p.{f.page}
                      </div>
                      <Markdown>{f.description}</Markdown>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.paragraphs.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold text-text-secondary">
                  Paragraph Insights
                </h3>
                <ul className="space-y-2">
                  {data.paragraphs.map((p) => (
                    <li key={p.chunkId} className="rounded border border-border-subtle p-2">
                      <div className="mb-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                        <span>p.{p.page}</span>
                        {p.importance && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] ${importanceClass(p.importance)}`}
                          >
                            {p.importance}
                          </span>
                        )}
                      </div>
                      {p.description && <Markdown>{p.description}</Markdown>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
