"use client";

import { useEffect, useRef, useState } from "react";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";
import { streamSse } from "@/lib/sse";
import { useReader } from "@/stores/reader";

export interface Citation {
  chunkId: string;
  page: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
}

/** 논문별 채팅 상태/전송 로직. 히스토리 로드 + SSE 스트리밍 + askText 연동. */
export function useChat(paperId: string) {
  const askText = useReader((s) => s.askText);
  const clearAsk = useReader((s) => s.clearAsk);
  const [messages, setMessages] = useState<Message[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 본문에서 "AI에게 묻기"로 넘어온 텍스트를 입력창에 채운다.
  useEffect(() => {
    if (!askText) return;
    setInput(askText);
    clearAsk();
  }, [askText, clearAsk]);

  // 논문 전환 시 기존 대화 히스토리 로드.
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

  return { messages, followups, input, setInput, streaming, reasoning, error, send };
}
