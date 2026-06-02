import { Markdown } from "@/components/common/Markdown";
import type { Message } from "./useChat";

/** 채팅 버블 1개(역할별 스타일 + 인용 페이지 점프 버튼). */
export function ChatMessage({
  message,
  onJump,
}: {
  message: Message;
  onJump: (page: number) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-md bg-brand-primary/15 px-2.5 py-1.5 text-text-primary"
            : "max-w-[85%] rounded-md bg-bg-muted px-2.5 py-1.5 text-text-primary"
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.citations.map((c) => (
              <button
                key={`${c.chunkId}-${c.page}`}
                type="button"
                onClick={() => onJump(c.page)}
                className="rounded bg-brand-primary/20 px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-brand-primary/40 hover:text-text-primary"
              >
                p.{c.page}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
