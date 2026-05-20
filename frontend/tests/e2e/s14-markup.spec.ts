import { expect, type Page, test } from "@playwright/test";

const PID = "test-paper";

const HIGHLIGHTS = [
  {
    id: "h1",
    paperId: PID,
    page: 3,
    bbox: { rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }] },
    text: "key idea",
    color: "yellow",
    category: "user_custom",
    source: "user",
    createdAt: Date.now(),
  },
];

async function mockMarkup(page: Page) {
  let noteMd = "";
  await page.route(`**/api/annotations/papers/${PID}/highlights`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(HIGHLIGHTS),
    });
  });
  await page.route(`**/api/annotations/papers/${PID}/note`, async (route) => {
    if (route.request().method() === "PUT") {
      noteMd = (route.request().postDataJSON() as { markdownText: string }).markdownText;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "n1",
        paperId: PID,
        markdownText: noteMd,
        s3BackupKey: "notes/n1.md",
        createdAt: 1,
        updatedAt: 2,
      }),
    });
  });
  await page.route(`**/api/annotations/papers/${PID}/export**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/markdown",
      body: "# Notes\n\nexported",
    });
  });
  await page.route("**/api/annotations/highlights/*", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

async function mockChat(page: Page) {
  await page.route("**/api/chat", async (route) => {
    const body =
      `data: ${JSON.stringify({ token: "논문의 핵심은 X 입니다." })}\n\n` + "data: [DONE]\n\n";
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
      body,
    });
  });
}

test.describe("Phase 1 S14 — markup", () => {
  test("Notes 탭: 하이라이트 목록 + 삭제", async ({ page }) => {
    await mockMarkup(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Notes" }).click();
    await expect(page.getByText("key idea")).toBeVisible();
    await expect(page.getByText("p.3")).toBeVisible();

    await page.getByRole("button", { name: "하이라이트 삭제" }).click();
    await expect(page.getByText("key idea")).toHaveCount(0);
  });

  test("노트 편집 → 자동 저장", async ({ page }) => {
    await mockMarkup(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Notes" }).click();
    const putReq = page.waitForRequest(
      (r) =>
        r.url().includes(`/api/annotations/papers/${PID}/note`) && r.method() === "PUT",
    );
    await page.getByLabel("노트 편집").fill("내 메모 본문");
    await putReq;
    await expect(page.getByText("저장됨")).toBeVisible();
  });

  test("Export 메뉴 — Obsidian 내보내기", async ({ page }) => {
    await mockMarkup(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Notes" }).click();
    const req = page.waitForRequest((r) => r.url().includes("/export?format=obsidian"));
    await page.getByRole("button", { name: "Obsidian 내보내기" }).click();
    await req;
  });

  test("노트 /ai 슬래시 커맨드 → 인라인 답변", async ({ page }) => {
    await mockMarkup(page);
    await mockChat(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Notes" }).click();
    const editor = page.getByLabel("노트 편집");
    await editor.fill("/ai 핵심이 뭐야?");
    await editor.press("Control+Enter");
    await expect(editor).toHaveValue(/\*\*AI:\*\*/);
    await expect(editor).toHaveValue(/논문의 핵심은 X 입니다\./);
  });
});
