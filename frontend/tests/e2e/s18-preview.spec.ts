import { expect, type Page, test } from "@playwright/test";

const PID = "test-paper";

// 1x1 투명 PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function mockPreview(page: Page) {
  await page.route(`**/api/papers/${PID}/summary`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ text: "핵심 결과는 Figure 1 에 나타나 있다." }),
    });
  });
  await page.route(`**/api/papers/${PID}/figures`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        figures: [
          {
            page: 1,
            kind: "figure",
            label: "Figure 1",
            bbox: { x: 0.1, y: 0.1, w: 0.5, h: 0.3 },
            captionText: "성능 비교 그래프",
          },
        ],
      }),
    });
  });
  await page.route(`**/api/papers/${PID}/figures/0/image`, async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: PNG_1PX });
  });
}

test.describe("Phase 2 F-07 — cross-ref 도표 프리뷰", () => {
  test("Summary 본문의 'Figure 1' 호버 시 도표 미니 프리뷰가 뜬다", async ({ page }) => {
    await mockPreview(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Summary" }).click();
    const ref = page.locator('[data-crossref="Figure 1"]');
    await expect(ref).toBeVisible();

    await ref.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await expect(page.getByText("성능 비교 그래프")).toBeVisible();
  });
});
