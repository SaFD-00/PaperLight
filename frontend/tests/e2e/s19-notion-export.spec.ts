import { expect, type Page, test } from "@playwright/test";

const PID = "test-paper";

async function mockNotes(page: Page) {
  await page.route(`**/api/annotations/papers/${PID}/note`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "n1", paperId: PID, markdownText: "메모", s3BackupKey: null }),
    });
  });
  await page.route(`**/api/annotations/papers/${PID}/highlights`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route(`**/api/annotations/papers/${PID}/export/notion`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "stub", url: null, markdown: "# T\n\n메모" }),
    });
  });
}

test.describe("Phase 2 Export-Notion", () => {
  test("Notion 버튼: 미연동 시 마크다운 fallback 안내를 표시한다", async ({ page }) => {
    await mockNotes(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Notes" }).click();
    await page.getByRole("button", { name: "Notion 내보내기" }).click();

    await expect(page.getByText(/Notion 미연동/)).toBeVisible();
  });
});
