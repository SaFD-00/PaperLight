"use client";

import { ExternalLink, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ReferenceCard {
  marker: number;
  raw: string;
  title: string | null;
  authors: string[];
  year: number | null;
  abstract: string | null;
  url: string | null;
  source: string;
}

type Status = "loading" | "empty" | "ready" | "error";

export function ReferencesPanel({ paperId }: { paperId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [refs, setRefs] = useState<ReferenceCard[]>([]);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    apiFetch(`/api/papers/${paperId}/references`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const body = (await res.json()) as ReferenceCard[];
        if (!alive) return;
        if (Array.isArray(body) && body.length > 0) {
          setRefs(body);
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
        <Quote className="size-4 text-text-secondary" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          References
        </h2>
      </header>
      <section className="flex-1 overflow-y-auto p-3 text-sm">
        {status === "loading" && <p className="text-text-muted">참고문헌 불러오는 중…</p>}
        {status === "error" && (
          <p className="rounded bg-danger/10 p-2 text-danger">참고문헌을 불러오지 못했습니다.</p>
        )}
        {status === "empty" && (
          <p className="text-text-muted">
            참고문헌을 찾지 못했습니다. 본문에 참고문헌 섹션이 없을 수 있습니다.
          </p>
        )}
        {status === "ready" && (
          <ul className="space-y-2">
            {refs.map((r) => (
              <li key={r.marker} className="rounded border border-border-subtle p-2">
                <p className="text-text-primary">
                  <span className="mr-1 text-text-muted">[{r.marker}]</span>
                  {r.title ?? r.raw}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
                  {r.authors.length > 0 && <span>{r.authors.join(", ")}</span>}
                  {r.year != null && <span>· {r.year}</span>}
                  <span className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px]">{r.source}</span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-brand-primary hover:underline"
                    >
                      열기 <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
