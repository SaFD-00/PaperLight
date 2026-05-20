import { test, expect, type Page } from "@playwright/test";

const PILOT = {
  arxivId: "2602.09856",
  title: "Code2World: A GUI World Model via Renderable Code Generation",
  authors: ["Zheng, Yuhao", "Lin, Kevin Qinghong"],
  year: 2026,
  abstract: "Code2World is a vision-language coder that predicts the next visual state.",
  doi: null,
  categories: ["cs.CV"],
  pdfUrl: "https://arxiv.org/pdf/2602.09856.pdf",
};

async function mockArxivMeta(page: Page) {
  await page.route("**/api/papers/arxiv/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PILOT),
    });
  });
}

async function mockImport(page: Page) {
  await page.route("**/api/papers/import", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "imported-1",
        title: PILOT.title,
        authors: PILOT.authors,
        year: PILOT.year,
        venue: null,
        arxivId: PILOT.arxivId,
        doi: null,
        status: "to_read",
        progressPct: 0,
        ingestionStatus: "pending",
        createdAt: 0,
        updatedAt: 0,
      }),
    });
  });
}

test.describe("Phase 1 S8 — arXiv import", () => {
  test("미리보기 → 가져오기 → reader 이동", async ({ page }) => {
    await mockArxivMeta(page);
    await mockImport(page);

    await page.goto("/import");
    await page.getByPlaceholder("2602.09856").fill("2602.09856");
    await page.getByRole("button", { name: "미리보기" }).click();

    await expect(page.getByRole("heading", { name: /Code2World/ })).toBeVisible();
    await expect(page.getByText(/arXiv:2602\.09856/)).toBeVisible();

    await page.getByRole("button", { name: "가져오기" }).click();
    await expect(page).toHaveURL(/\/r\/imported-1$/);
  });

  test("Library 헤더 '+ 논문 추가' → /import 이동", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: /논문 추가/ }).click();
    await expect(page).toHaveURL(/\/import$/);
  });

  test("잘못된 ID 입력 시 에러 표시", async ({ page }) => {
    await page.goto("/import");
    await page.getByPlaceholder("2602.09856").fill("not-an-id");
    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(page.getByText(/유효한 arXiv ID/)).toBeVisible();
  });
});
