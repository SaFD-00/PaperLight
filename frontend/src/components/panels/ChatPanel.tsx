"use client";

import { MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/common/Markdown";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

interface Citation {
  chunkId: string;
  page: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
}

const QUICK_QUESTIONS = ["이 논문의 핵심이 뭐야?", "기존 연구랑 뭐가 달라?", "한계점이 뭐야?"];

export function ChatPanel({ paperId }: { paperId: string }) {
  const requestJump = useReader((s) => s.requestJump);
  const askText = useReader((s) => s.askText);
  const clearAsk = useReader((s) => s.clearAsk);
  const [messages, setMessages] = useState<Message[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!askText) return;
    setInput(askText);
    clearAsk();
  }, [askText, clearAsk]);

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/chat/${paperId}`)
      .then(async (res) => {
        if (!alive || !res.ok) return;
        const body = (await res.json()) as { messages: Message[] };
        if (alive && Array.isArray(body.messages)) setMessages(body.messages);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [paperId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function patchLastAssistant(patch: (m: Message) => Message) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") next[next.length - 1] = patch(last);
      return next;
    });
  }

  function send(question: string) {
    const q = question.trim();
    if (!q || streaming) return;
    capture("chat_message_sent", { paperId });
    setInput("");
    setFollowups([]);
    setError(null);
    setReasoning("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    streamSse(
      "/api/chat",
      { paperId, question: q },
      {
        onToken: (t) => patchLastAssistant((m) => ({ ...m, content: m.content + t })),
        onMeta: (evt) => {
          if (Array.isArray(evt.citations)) {
            const cites = evt.citations as Citation[];
            patchLastAssistant((m) => ({ ...m, citations: cites }));
          }
          if (Array.isArray(evt.followups)) setFollowups(evt.followups as string[]);
          if (typeof evt.reasoning === "string") setReasoning((r) => r + evt.reasoning);
        },
        onDone: () => setStreaming(false),
        onError: (err) => {
          setError(err);
          setStreaming(false);
        },
      },
      ctrl.signal,
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <MessageSquare className="size-4 text-text-secondary" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Chat</h2>
        {streaming && (
          <span className="ml-auto animate-pulse text-brand-primary" aria-label="응답 생성 중">
            ●
          </span>
        )}
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && !streaming ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-xs text-text-muted">
            <MessageSquare className="size-5 opacity-60" aria-hidden />
            <p>논문에 대해 무엇이든 물어보세요. 본문 근거와 함께 답합니다.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-border-subtle px-2.5 py-1 text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-md bg-brand-primary/15 px-2.5 py-1.5 text-text-primary"
                      : "max-w-[85%] rounded-md bg-bg-muted px-2.5 py-1.5 text-text-primary"
                  }
                >
                  {m.role === "assistant" ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.citations.map((c) => (
                        <button
                          key={`${c.chunkId}-${c.page}`}
                          type="button"
                          onClick={() => requestJump(c.page)}
                          className="rounded bg-brand-primary/20 px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-brand-primary/40 hover:text-text-primary"
                        >
                          p.{c.page}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {streaming &&
            reasoning &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.content === "" ? (
              <div className="rounded-md border border-border-subtle bg-bg-muted/50 px-2.5 py-1.5 text-xs text-text-muted">
                <span className="animate-pulse font-medium text-text-secondary">생각 중…</span>
                <p className="mt-1 max-h-16 overflow-y-auto whitespace-pre-wrap leading-relaxed opacity-80">
                  {reasoning}
                </p>
              </div>
            ) : (
              streaming && (
                <span className="inline-block h-3 w-0.5 animate-pulse bg-brand-primary align-middle" />
              )
            )}
            {followups.length > 0 && (
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
          </>
        )}
        {error && <p className="rounded bg-danger/10 p-2 text-danger">에러: {error}</p>}
      </section>

      <footer className="border-t border-border-subtle p-2">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="무엇이든 질문하세요…"
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
      </footer>
    </div>
  );
}
