import { expect, type Page, test } from "@playwright/test";

const PID = "test-paper";

async function mockChat(page: Page) {
  await page.route(`**/api/chat/${PID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: null, messages: [] }),
    });
  });
  await page.route("**/api/chat", async (route) => {
    const body =
      `data: ${JSON.stringify({ token: "논문의 핵심은 " })}\n\n` +
      `data: ${JSON.stringify({ token: "X 입니다." })}\n\n` +
      `data: ${JSON.stringify({ citations: [{ chunkId: "c1", page: 3 }] })}\n\n` +
      `data: ${JSON.stringify({ followups: ["한계점은 무엇인가요?"] })}\n\n` +
      `data: [DONE]\n\n`;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
      body,
    });
  });
}

async function mockReferences(page: Page, cards: object[]) {
  await page.route(`**/api/papers/${PID}/references`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(cards),
    });
  });
}

test.describe("Phase 1 S12 — chat + citation", () => {
  test("Chat 탭: 질문 전송 → 스트리밍 답변 + 인용 칩 + 후속 질문", async ({ page }) => {
    await mockChat(page);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByRole("button", { name: "이 논문의 핵심이 뭐야?" })).toBeVisible();

    await page.getByPlaceholder(/무엇이든 질문하세요/).fill("핵심이 뭐야?");
    await page.getByPlaceholder(/무엇이든 질문하세요/).press("Enter");

    await expect(page.getByText("논문의 핵심은 X 입니다.")).toBeVisible();
    await expect(page.getByRole("button", { name: "p.3" })).toBeVisible();
    await page.getByRole("button", { name: "p.3" }).click();
    await expect(page.getByRole("button", { name: "한계점은 무엇인가요?" })).toBeVisible();
  });

  test("References 탭: 보강된 참고문헌 카드와 외부 링크를 렌더한다", async ({ page }) => {
    await mockChat(page);
    await mockReferences(page, [
      {
        marker: 1,
        raw: "[1] Vaswani et al. 2017.",
        title: "Attention Is All You Need",
        authors: ["Vaswani"],
        year: 2017,
        abstract: null,
        url: "https://arxiv.org/abs/1706.03762",
        source: "arxiv",
      },
    ]);
    await page.goto(`/r/${PID}`);

    await page.getByRole("button", { name: "References" }).click();
    await expect(page.getByText("Attention Is All You Need")).toBeVisible();
    await expect(page.getByRole("link", { name: /열기/ })).toBeVisible();
  });
});
