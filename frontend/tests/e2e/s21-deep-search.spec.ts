import { expect, type Page, test } from "@playwright/test";

async function mockDeepSearch(page: Page) {
  await page.route("**/api/deep-search", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            title: "Diffusion Models Survey",
            authors: ["Kim, J."],
            year: 2023,
            url: "https://example.org/a",
            abstract: "확산 모델 개요.",
            score: 0.9,
            why: "회원님 라이브러리의 관심사와 가깝습니다.",
          },
        ],
      }),
    });
  });
}

test.describe("Phase 2 F-09 — Deep Search", () => {
  test("쿼리 검색 → 추천 카드 + '왜 추천' 토글", async ({ page }) => {
    await mockDeepSearch(page);
    await page.goto("/discover");

    await page.getByPlaceholder(/관심 주제/).fill("diffusion");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    await expect(page.getByText("Diffusion Models Survey")).toBeVisible();
    await page.getByRole("button", { name: "왜 추천?" }).click();
    await expect(page.getByText(/관심사와 가깝습니다/)).toBeVisible();
  });
});
