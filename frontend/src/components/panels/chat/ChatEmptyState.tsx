import { MessageSquare } from "lucide-react";

const QUICK_QUESTIONS = ["이 논문의 핵심이 뭐야?", "기존 연구랑 뭐가 달라?", "한계점이 뭐야?"];

/** 대화가 비었을 때의 안내 + 빠른 질문 칩. */
export function ChatEmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-xs text-text-muted">
      <MessageSquare className="size-5 opacity-60" aria-hidden />
      <p>논문에 대해 무엇이든 물어보세요. 본문 근거와 함께 답합니다.</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-border-subtle px-2.5 py-1 text-text-secondary hover:bg-bg-muted hover:text-text-primary"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
