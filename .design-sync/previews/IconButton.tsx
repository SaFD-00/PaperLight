import { IconButton } from "paperlight-frontend";
import { Search, Settings2, Bookmark, PanelLeft, MoreHorizontal } from "lucide-react";

/** 툴바 공용 아이콘 버튼 — 32×32, hover 시 muted 배경. */
export function Default() {
  return (
    <div style={{ display: "flex", gap: 2, padding: 16, background: "var(--bg-surface)" }}>
      <IconButton label="검색"><Search size={16} /></IconButton>
      <IconButton label="설정"><Settings2 size={16} /></IconButton>
      <IconButton label="북마크"><Bookmark size={16} /></IconButton>
      <IconButton label="더보기"><MoreHorizontal size={16} /></IconButton>
    </div>
  );
}

/** 패널 헤더에서 한 개만 단독으로 쓰일 때. */
export function Single() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)", width: 240 }}>
      <PanelLeft size={15} style={{ color: "var(--text-secondary)" }} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>목차</span>
      <IconButton label="사이드바 접기"><PanelLeft size={16} /></IconButton>
    </div>
  );
}
