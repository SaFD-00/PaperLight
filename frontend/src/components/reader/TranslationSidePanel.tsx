import { TranslationPane } from "@/components/panels/TranslationPane";

/** AI 탭 패널과 별개로 항상 우측에 두는 독립 해석(번역) 패널. */
export function TranslationSidePanel({ paperId }: { paperId: string }) {
  return (
    <aside
      aria-label="해석 패널"
      className="flex h-full w-[360px] shrink-0 flex-col border-l border-border-subtle bg-bg-surface"
    >
      <TranslationPane paperId={paperId} />
    </aside>
  );
}
