import { describe, expect, it } from "vitest";
import { analyticsEnabled, capture, identify, initAnalytics } from "@/lib/analytics";

describe("analytics no-op without env/window", () => {
  it("analyticsEnabled is false in node env (no window/key)", () => {
    expect(analyticsEnabled()).toBe(false);
  });

  it("capture does not throw when uninitialized", () => {
    expect(() => capture("paper_opened", { paperId: "p1" })).not.toThrow();
  });

  it("identify does not throw when uninitialized", () => {
    expect(() => identify("user-1")).not.toThrow();
  });

  it("initAnalytics resolves to a no-op without keys", async () => {
    await expect(initAnalytics()).resolves.toBeUndefined();
  });
});
