"use client";

import { ImageIcon, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/common/Markdown";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function FigureExplainPopover({ paperId }: { paperId: string }) {
  const fig = useReader((s) => s.figureExplain);
  const clear = useReader((s) => s.clearFigureExplain);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const streamTurn = useCallback(
    (question: string, history: Msg[]) => {
      if (!fig) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setFollowups([]);
      setError(false);
      setStreaming(true);
      setMessages((prev) => [
        ...(question ? [...prev, { role: "user" as const, content: question }] : prev),
        { role: "assistant" as const, content: "" },
      ]);
      streamSse(
        "/api/explain/figure",
        {
          kind: fig.kind,
          image: fig.imageDataUrl,
          label: fig.label,
          captionText: fig.captionText,
          question,
          history,
          paperId,
          page: fig.page,
        },
        {
          onToken: (t) =>
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + t };
              return next;
            }),
          onMeta: (evt) => {
            if (Array.isArray(evt.followups)) setFollowups(evt.followups as string[]);
          },
          onDone: () => setStreaming(false),
          onError: () => {
            setError(true);
            setStreaming(false);
          },
        },
        ctrl.signal,
      );
    },
    [fig, paperId],
  );

  // fig가 바뀌면 대화를 초기화하고 첫 설명을 자동 스트리밍한다(질문 없는 턴).
  useEffect(() => {
    if (!fig) return;
    setMessages([]);
    setInput("");
    streamTurn("", []);
    return () => abortRef.current?.abort();
  }, [fig, streamTurn]);

  if (!fig) return null;

  function send(q: string) {
    const question = q.trim();
    if (!question || streaming) return;
    setInput("");
    streamTurn(question, messages);
  }

  const title = fig.kind === "table" ? "표 분석" : "그림 분석";
  const top = Math.min(fig.hostRect.bottom + 8, window.innerHeight - 480);
  const left = Math.min(
    Math.max(fig.hostRect.left + fig.hostRect.width / 2, 220),
    window.innerWidth - 220,
  );

  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed z-50 flex max-h-[34rem] w-[26rem] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border-default bg-bg-surface shadow-lg"
      style={{ top, left }}
    >
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-2.5 py-1.5 text-xs text-text-secondary">
        <ImageIcon className="size-3.5" aria-hidden />
        <span className="font-semibold">{title}</span>
        {fig.label && <span className="text-text-muted">· {fig.label}</span>}
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            clear();
          }}
          aria-label={`${title} 닫기`}
          className="ml-auto rounded p-0.5 hover:bg-bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- crop은 in-memory dataURL이라 next/image 부적합 */}
      <img
        src={fig.imageDataUrl}
        alt={fig.label || title}
        className="mx-3 mt-2 shrink-0 rounded border border-border-subtle bg-white object-contain"
        style={{ maxHeight: "9rem" }}
      />

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
        {messages.map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="text-text-primary">
              {m.content === "" && streaming ? (
                <p className="text-text-muted">분석 중…</p>
              ) : (
                <Markdown>{m.content}</Markdown>
              )}
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-brand-primary/15 px-2.5 py-1.5 leading-relaxed text-text-primary">
                {m.content}
              </p>
            </div>
          ),
        )}
        {streaming && messages[messages.length - 1]?.content !== "" && (
          <span className="inline-block h-3 w-0.5 animate-pulse bg-brand-primary align-middle" />
        )}
        {error && <p className="text-danger">설명 생성에 실패했습니다.</p>}
        {followups.length > 0 && !streaming && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {followups.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-full border border-border-subtle px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-muted hover:text-text-primary"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-border-subtle p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`이 ${fig.kind === "table" ? "표" : "그림"}에 대해 물어보세요…`}
          className="flex-1 rounded bg-bg-muted px-2.5 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="전송"
          className="grid size-8 place-items-center rounded-md bg-brand-primary text-white disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
