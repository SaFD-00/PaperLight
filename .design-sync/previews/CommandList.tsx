import { CommandList } from "paperlight-frontend";
import { BookOpen, FileDown, FileText, Home, Moon, Rows3 } from "lucide-react";

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
    label: "Denoising Diffusion Probabilistic Models",
    hint: "논문 · Ho",
    icon: FileText,
    run: noop,
  },
];

/** 명령 목록 — 두 번째 항목(PDF 추가)이 키보드 선택(active) 하이라이트. */
export function Default() {
  return (
    <div
      style={{
        width: 480,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <CommandList items={COMMANDS} active={1} onHover={noop} onRun={noop} />
    </div>
  );
}

/** 논문 결과만 필터된 상태 — 첫 항목 active. */
export function Filtered() {
  return (
    <div
      style={{
        width: 480,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <CommandList items={COMMANDS.slice(5)} active={0} onHover={noop} onRun={noop} />
    </div>
  );
}

/** 결과 없음 빈 상태 — "결과가 없습니다." 안내. */
export function Empty() {
  return (
    <div
      style={{
        width: 480,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <CommandList items={[]} active={0} onHover={noop} onRun={noop} />
    </div>
  );
}
