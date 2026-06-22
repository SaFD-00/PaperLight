import { ThemeProvider } from "paperlight-frontend";

/**
 * ThemeProvider는 UI가 없는 래퍼다 — settings store의 theme/density를
 * document에 적용하고 children을 그대로 렌더한다. 아래는 테마가 입혀진
 * 실제 콘텐츠 스니펫을 감싼 모습.
 */
export function ThemedContent() {
  return (
    <ThemeProvider>
      <div
        style={{
          padding: 16,
          width: 320,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
        }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 14, color: "var(--text-primary)" }}>
          Attention Is All You Need
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
          테마와 밀도 토큰이 적용된 children 콘텐츠.
        </p>
      </div>
    </ThemeProvider>
  );
}
