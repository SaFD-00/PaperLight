"use client";

import { Headphones } from "lucide-react";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/common/Markdown";
import { usePodcast } from "@/stores/podcast";

export function PodcastPanel({ paperId }: { paperId: string }) {
  const pod = usePodcast((s) => s.byPaper[paperId]);
  const generating = usePodcast((s) => s.generating[paperId] ?? false);
  const fetchForPaper = usePodcast((s) => s.fetchForPaper);
  const generate = usePodcast((s) => s.generate);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    void fetchForPaper(paperId);
  }, [paperId, fetchForPaper]);

  const busy = generating || pod?.status === "pending" || pod?.status === "processing";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <Headphones className="size-4 text-text-secondary" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Podcast
        </h2>
      </header>

      <section className="flex-1 overflow-y-auto p-3 text-sm">
        {pod === undefined && <p className="text-text-muted">불러오는 중…</p>}

        {pod !== undefined && pod?.status !== "ready" && (
          <div className="space-y-3">
            <p className="text-text-muted">
              논문을 두 사람의 한국어 대담 팟캐스트로 만듭니다. 생성에는 시간이 걸립니다.
            </p>
            <button
              type="button"
              onClick={() => generate(paperId)}
              disabled={busy}
              className="rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy ? "생성 중…" : pod?.status === "failed" ? "다시 생성" : "팟캐스트 생성"}
            </button>
            {pod?.status === "failed" && (
              <p className="rounded bg-danger/10 p-2 text-xs text-danger">
                생성에 실패했습니다. 다시 시도해 주세요.
              </p>
            )}
          </div>
        )}

        {pod?.status === "ready" && (
          <div className="space-y-3">
            <audio
              controls
              src={pod.audioUrl ?? undefined}
              className="w-full"
              data-testid="podcast-audio"
            >
              <track kind="captions" />
            </audio>
            {pod.durationSec ? (
              <p className="text-xs text-text-muted">약 {pod.durationSec}초</p>
            ) : null}
            {pod.scriptMd && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowScript((v) => !v)}
                  className="text-xs text-brand-primary underline underline-offset-2"
                >
                  {showScript ? "대본 숨기기" : "대본 보기"}
                </button>
                {showScript && (
                  <div className="mt-2 border-t border-border-subtle pt-2">
                    <Markdown>{pod.scriptMd}</Markdown>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
