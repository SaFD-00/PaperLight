import { NotesPanel } from "paperlight-frontend";

/**
 * 노트 패널(헤더의 Markdown/Obsidian/Notion 내보내기 + 하이라이트 목록 +
 * Markdown 편집기). 정적 프리뷰에선 빈 하이라이트/노트 상태로 렌더된다.
 */
export function Panel() {
  return (
    <div style={{ width: 340, height: 520, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
      <NotesPanel paperId="demo-paper" />
    </div>
  );
}
