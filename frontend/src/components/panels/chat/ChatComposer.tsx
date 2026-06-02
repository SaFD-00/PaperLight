import { Send } from "lucide-react";

/** 하단 입력 폼(엔터/버튼으로 전송). */
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
  return (
    <footer className="border-t border-border-subtle p-2">
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(input);
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
          disabled={disabled}
          aria-label="전송"
          className="grid size-8 place-items-center rounded-md bg-brand-primary text-white disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </footer>
  );
}
