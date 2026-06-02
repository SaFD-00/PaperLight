import { test, expect, type Page } from "@playwright/test";

const META = "Meta";

async function openSamplePaper(page: Page) {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/library$/);
  const cards = page.getByRole("button", { name: /arXiv/i });
  await cards.nth(0).dblclick();
  await expect(page).toHaveURL(/\/r\/sample-/);
  // PDF 로드 완료(페이지 카운터 N / M, M>0) 대기 → 텍스트 레이어 준비.
  await expect(page.getByText(/^\d+ \/ [1-9]\d*$/)).toBeVisible({ timeout: 30_000 });
}

test.describe("S17 — 페이지 내 검색", () => {
  test("툴바 버튼으로 검색 바 열고 일치 탐색", async ({ page }) => {
    await openSamplePaper(page);

    // 검색 바 열기.
    await page.getByRole("button", { name: "페이지 내 검색" }).click();
    const input = page.getByRole("textbox", { name: "페이지 내 검색어" });
    await expect(input).toBeVisible();

    const nextBtn = page.getByRole("button", { name: "다음 일치" });
    // 빈 쿼리: 이동 비활성.
    await expect(nextBtn).toBeDisabled();

    // 샘플 PDF 본문에 흔한 단어 → 일치 발생.
    await input.fill("the");
    await expect(nextBtn).toBeEnabled({ timeout: 10_000 });

    // 카운터 "n / N" 노출.
    const bar = input.locator("xpath=ancestor::div[1]");
    await expect(bar.getByText(/^\d+ \/ \d+$/)).toBeVisible();

    // 다음 일치로 이동해도 활성 유지.
    await nextBtn.click();
    await expect(nextBtn).toBeEnabled();
  });

  test("⌘F로 열고 Esc로 닫기", async ({ page }) => {
    await openSamplePaper(page);

    await page.keyboard.press(`${META}+f`);
    const input = page.getByRole("textbox", { name: "페이지 내 검색어" });
    await expect(input).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
  });

  test("일치 없는 검색어는 '결과 없음'", async ({ page }) => {
    await openSamplePaper(page);

    await page.getByRole("button", { name: "페이지 내 검색" }).click();
    const input = page.getByRole("textbox", { name: "페이지 내 검색어" });
    await input.fill("zzqqxxnotfound123");

    const bar = input.locator("xpath=ancestor::div[1]");
    await expect(bar.getByText("결과 없음")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "다음 일치" })).toBeDisabled();
  });
});
