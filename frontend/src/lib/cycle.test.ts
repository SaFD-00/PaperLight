import { describe, expect, it } from "vitest";
import { cycle, DENSITY_CYCLE, THEME_CYCLE } from "./cycle";

describe("cycle", () => {
  it("현재 값의 다음 요소를 반환한다", () => {
    expect(cycle(THEME_CYCLE, "auto")).toBe("light");
    expect(cycle(THEME_CYCLE, "light")).toBe("dark");
  });

  it("마지막 요소면 처음으로 순환한다", () => {
    expect(cycle(THEME_CYCLE, "dark")).toBe("auto");
    expect(cycle(DENSITY_CYCLE, "spacious")).toBe("compact");
  });

  it("배열에 없는 값이면 첫 요소를 반환한다", () => {
    // indexOf=-1 → (-1+1)%len = 0
    expect(cycle(THEME_CYCLE, "missing" as (typeof THEME_CYCLE)[number])).toBe("auto");
  });
});
