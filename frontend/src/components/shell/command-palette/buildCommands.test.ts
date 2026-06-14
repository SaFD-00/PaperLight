import { describe, expect, it, vi } from "vitest";
import { buildCommands } from "./buildCommands";

function deps(papers = [{ id: "p1", title: "Attention Is All You Need", authors: ["Vaswani"] }]) {
  return {
    router: { push: vi.fn() },
    openTab: vi.fn(),
    theme: "auto" as const,
    density: "cozy" as const,
    setTheme: vi.fn(),
    setDensity: vi.fn(),
    papers,
  };
}

describe("buildCommands", () => {
  it("이동 3개 + 설정 2개 + 논문 수만큼 명령을 만든다", () => {
    const cmds = buildCommands(deps());
    expect(cmds).toHaveLength(6);
    expect(cmds.filter((c) => c.id.startsWith("paper-"))).toHaveLength(1);
    expect(cmds.find((c) => c.id === "nav-library")).toBeTruthy();
  });

  it("논문 명령 실행 시 탭을 열고 리더로 이동한다", () => {
    const d = deps();
    const cmds = buildCommands(d);
    cmds.find((c) => c.id === "paper-p1")?.run();
    expect(d.openTab).toHaveBeenCalledWith({ paperId: "p1", title: "Attention Is All You Need" });
    expect(d.router.push).toHaveBeenCalledWith("/r/p1");
  });

  it("테마 토글은 다음 테마로 전환한다 (auto→light)", () => {
    const d = deps();
    buildCommands(d).find((c) => c.id === "set-theme")?.run();
    expect(d.setTheme).toHaveBeenCalledWith("light");
  });
});
