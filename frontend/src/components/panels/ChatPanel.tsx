"use client";

import { MessageSquare } from "lucide-react";
import { useReader } from "@/stores/reader";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatEmptyState } from "./chat/ChatEmptyState";
import { ChatMessage } from "./chat/ChatMessage";
import { useChat } from "./chat/useChat";

export function ChatPanel({ paperId }: { paperId: string }) {
  const requestJump = useReader((s) => s.requestJump);
  const { messages, followups, input, setInput, streaming, reasoning, error, send } =
    useChat(paperId);

  const lastMsg = messages[messages.length - 1];
  const showReasoning =
    streaming && reasoning && lastMsg?.role === "assistant" && lastMsg?.content === "";

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
          <ChatEmptyState onPick={send} />
        ) : (
          <>
            {messages.map((m, i) => (
              <ChatMessage key={i} message={m} onJump={requestJump} />
            ))}
            {showReasoning ? (
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

      <ChatComposer
        input={input}
        setInput={setInput}
        onSend={send}
        disabled={streaming || !input.trim()}
      />
    </div>
  );
}
