import { expect, test } from "@playwright/test";

test.describe("S15 — 명령 팔레트(⌘K)", () => {
  test("⌘K 열기 → 논문 검색 → Enter 로 열기", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("button", { name: /arXiv/i }).first()).toBeVisible();

    // ⌘K (Chromium 은 Meta) 로 팔레트 토글
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog", { name: "명령 팔레트" });
    await expect(dialog).toBeVisible();

    // 검색 → 논문 항목 필터
    await dialog.getByPlaceholder("논문 검색, 이동, 설정…").fill("Code2World");
    const item = dialog.getByRole("button", { name: /Code2World/ });
    await expect(item.first()).toBeVisible();

    // Enter → 리더로 이동 + 팔레트 닫힘
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/r\/sample-/);
    await expect(dialog).toBeHidden();
  });

  test("Esc 로 닫기", async ({ page }) => {
    await page.goto("/library");
    await page.keyboard.press("Meta+k");
    const dialog = page.getByRole("dialog", { name: "명령 팔레트" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
