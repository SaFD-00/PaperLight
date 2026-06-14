"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-text-primary">문제가 발생했습니다</h2>
      <p className="text-sm text-text-secondary">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-bg-muted px-4 py-2 text-sm text-text-primary hover:bg-bg-surface"
      >
        다시 시도
      </button>
    </div>
  );
}
