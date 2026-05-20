import { expect, type Page, test } from "@playwright/test";

const PID = "test-paper";

async function mockInsights(
  page: Page,
  insights: object | null,
  summary: { text: string | null },
) {
  await page.route(`**/api/papers/${PID}/summary`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(summary),
    });
  });
  await page.route(`**/api/papers/${PID}/insights`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        insights ?? { paragraphs: [], figures: [], highlights: null },
      ),
    });
  });
}

test.describe("Phase 1 S11 — pre-gen right panel", () => {
  test("Summary + Insights 탭이 생성본을 렌더한다", async ({ page }) => {
    await mockInsights(
      page,
      {
        paragraphs: [
          { chunkId: "c1", page: 3, description: "단락 핵심 요약입니다.", importance: "Critical" },
        ],
        figures: [
          { chunkId: "c1", page: 5, kind: "figure", description: "그림 설명입니다." },
        ],
        highlights: "## 기여\n- 핵심 기여 문장",
      },
      { text: "## TL;DR\n한 줄 요약입니다." },
    );

    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Summary" }).click();
    await expect(page.getByText("TL;DR")).toBeVisible();

    await page.getByRole("button", { name: "Insights" }).click();
    await expect(page.getByText("단락 핵심 요약입니다.")).toBeVisible();
    await expect(page.getByText("Critical")).toBeVisible();
    await expect(page.getByText("그림 설명입니다.")).toBeVisible();
  });

  test("미생성 시 empty-state를 표시한다", async ({ page }) => {
    await mockInsights(page, null, { text: null });

    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Summary" }).click();
    await expect(page.getByText(/아직 요약이 생성되지 않았습니다/)).toBeVisible();

    await page.getByRole("button", { name: "Insights" }).click();
    await expect(page.getByText(/아직 통찰이 생성되지 않았습니다/)).toBeVisible();
  });
});
