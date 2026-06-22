import { CommandList } from "paperlight-frontend";
import { BookOpen, FileDown, FileText, Home, Moon, Rows3, Search, Sparkles } from "lucide-react";

const noop = () => {};

const COMMANDS = [
  { id: "nav-library", label: "내 라이브러리", hint: "이동", icon: BookOpen, run: noop },
  { id: "nav-import", label: "PDF 추가 (업로드 · arXiv)", hint: "이동", icon: FileDown, run: noop },
  { id: "nav-home", label: "홈(랜딩)", hint: "이동", icon: Home, run: noop },
  { id: "set-theme", label: "테마 전환 (현재: auto)", hint: "설정", icon: Moon, run: noop },
  { id: "set-density", label: "밀도 전환 (현재: cozy)", hint: "설정", icon: Rows3, run: noop },
  {
    id: "paper-1",
    label: "Attention Is All You Need",
    hint: "논문 · Vaswani",
    icon: FileText,
    run: noop,
  },
  {
    id: "paper-2",
    label: "Segment Anything",
    hint: "논문 · Kirillov",
    icon: FileText,
    run: noop,
  },
];

/**
 * CommandPalette 본체는 useCommand 스토어(open)에 묶여 정적 캡처에서 자체적으로 열 수 없으므로,
 * 실제 팔레트 chrome(검색 입력 + 푸터)에 실 컴포넌트 CommandList 본문을 합성해 열린 팔레트를 보인다.
 */
export function Open() {
  return (
    <div
      style={{
        width: 560,
        padding: 24,
        background: "var(--bg-overlay)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-label="명령 팔레트"
        style={{
          width: "100%",
          maxWidth: 512,
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid var(--border-subtle)",
            padding: "12px 16px",
          }}
        >
          <Search size={16} style={{ color: "var(--text-muted)" }} aria-hidden />
          <span style={{ flex: 1, fontSize: 14, color: "var(--text-muted)" }}>
            논문 검색, 이동, 설정…
          </span>
          <kbd
            style={{
              borderRadius: 4,
              border: "1px solid var(--border-subtle)",
              padding: "2px 6px",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            Esc
          </kbd>
        </div>
        <CommandList items={COMMANDS} active={0} onHover={noop} onRun={noop} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderTop: "1px solid var(--border-subtle)",
            padding: "8px 16px",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Sparkles size={11} /> PaperLight
          </span>
          <span style={{ marginLeft: "auto" }}>↑↓ 이동 · ↵ 실행 · Esc 닫기</span>
        </div>
      </div>
    </div>
  );
}

/** 검색어로 논문만 필터된 팔레트 결과 본문. */
export function Filtered() {
  return (
    <div
      style={{
        width: 512,
        padding: 16,
        background: "var(--bg-overlay)",
      }}
    >
      <div
        role="dialog"
        aria-label="명령 팔레트"
        style={{
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid var(--border-subtle)",
            padding: "12px 16px",
          }}
        >
          <Search size={16} style={{ color: "var(--text-muted)" }} aria-hidden />
          <span style={{ flex: 1, fontSize: 14, color: "var(--text-primary)" }}>attention</span>
        </div>
        <CommandList items={COMMANDS.slice(5, 6)} active={0} onHover={noop} onRun={noop} />
      </div>
    </div>
  );
}
