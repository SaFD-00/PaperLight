import { Send } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

const MAX_TEXTAREA_PX = 132; // ≈6줄(leading-relaxed ~22px) 상한. 초과 시 내부 스크롤.

/** 하단 입력 폼(Enter=전송, Shift+Enter=줄바꿈, 내용에 따라 높이 자동 확장). */
export function ChatComposer({
  input,
  setInput,
  onSend,
  disabled,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: (q: string) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // input 변화마다 높이 재측정: auto 로 리셋 후 scrollHeight 로 늘림(상한 클램프).
  // 전송 시 useChat 가 input 을 "" 로 비우므로 이 효과가 다시 1줄로 축소한다.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXTAREA_PX)}px`;
    ta.style.overflowY = ta.scrollHeight > MAX_TEXTAREA_PX ? "auto" : "hidden";
  }, [input]);

  return (
    <footer className="border-t border-border-subtle p-2">
      <form
        className="flex items-end gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(input);
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter=전송, Shift+Enter=줄바꿈. IME(한글) 조합 중 Enter 는 무시(오전송 방지).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend(input);
            }
          }}
          placeholder="무엇이든 질문하세요…"
          className="min-h-[34px] flex-1 resize-none rounded bg-bg-muted px-2.5 py-1.5 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="전송"
          className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-primary text-white disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </footer>
  );
}
