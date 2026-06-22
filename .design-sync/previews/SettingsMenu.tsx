import { SettingsMenu } from "paperlight-frontend";
import { useEffect, useRef } from "react";

/**
 * SettingsMenu 는 로컬 state 로 열리는 오버레이라 정적 캡처에서 열린 상태를 보이도록
 * 마운트 후 트리거 버튼(aria-label="설정")을 1회 클릭한다.
 */
function AutoOpen({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button[aria-label="설정"]');
    btn?.click();
  }, []);
  return <div ref={ref}>{children}</div>;
}

/** 설정 메뉴 열린 상태 — Theme · Density · 번역 글꼴 · 리더 글꼴 크기 섹션. */
export function Open() {
  return (
    <div
      style={{
        width: 320,
        height: 380,
        position: "relative",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <AutoOpen>
        <SettingsMenu />
      </AutoOpen>
    </div>
  );
}

/** 트리거 버튼만(닫힘) — 툴바에 놓인 기본 상태. */
export function Trigger() {
  return (
    <div
      style={{
        width: 80,
        height: 56,
        display: "grid",
        placeItems: "center",
        background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
      }}
    >
      <SettingsMenu />
    </div>
  );
}
