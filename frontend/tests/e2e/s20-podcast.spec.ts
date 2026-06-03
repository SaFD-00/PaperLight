import { expect, type Page, test } from "@playwright/test";

const PID = "test-paper";

async function mockPodcast(page: Page) {
  let created = false;
  await page.route(`**/api/podcast/paper/${PID}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  await page.route("**/api/podcast", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    created = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "pod1", status: "pending" }),
    });
  });
  await page.route("**/api/podcast/pod1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "pod1",
        paperId: PID,
        status: created ? "ready" : "pending",
        durationSec: 42,
        scriptMd: "진행자: 안녕하세요\n전문가: 핵심은 X 입니다",
        audioUrl: "http://localhost:8000/api/podcast/pod1/audio?exp=1&sig=x",
      }),
    });
  });
  await page.route("**/api/podcast/pod1/audio**", async (route) => {
    await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.from([0xff, 0xfb]) });
  });
}

test.describe("Phase 2 F-13 — Podcast", () => {
  test("Podcast 탭: 생성 버튼 → 오디오 플레이어 + 대본", async ({ page }) => {
    await mockPodcast(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Podcast" }).click();
    await page.getByRole("button", { name: "팟캐스트 생성" }).click();

    await expect(page.getByTestId("podcast-audio")).toBeVisible();
    await page.getByRole("button", { name: "대본 보기" }).click();
    await expect(page.getByText("핵심은 X 입니다")).toBeVisible();
  });
});
