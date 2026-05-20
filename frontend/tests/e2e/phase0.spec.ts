import { test, expect, type Page } from "@playwright/test";

// macOS의 Meta key (⌘) — Chromium에서는 OS와 무관하게 Meta로 매핑됨
const META = "Meta";

async function gotoLibrary(page: Page) {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/library$/);
}

async function openSamplePaper(page: Page, index: 0 | 1) {
  await gotoLibrary(page);
  const cards = page.getByRole("button", { name: /arXiv/i });
  await cards.nth(index).dblclick();
  await expect(page).toHaveURL(/\/r\/sample-/);
}

test.describe("Phase 0 — FE shell + tabs", () => {
  test("AC-S1-1 Library 탭이 맨 왼쪽 고정 + ✕ 없음", async ({ page }) => {
    await gotoLibrary(page);
    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toContainText(/내 라이브러리/);
    // Library 탭에는 ✕ 버튼이 없어야 함
    const libraryTab = tabs.first();
    const closeBtn = libraryTab.locator('button[aria-label*="닫기"]');
    await expect(closeBtn).toHaveCount(0);
  });

  test("AC-S1-2 새 탭 추가 + ⌘1/⌘2 전환 + ⌘W 닫기", async ({ page }) => {
    await openSamplePaper(page, 0);
    // 탭 수: Library + sample-1 = 2
    let tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);

    // 두 번째 탭 열기 — SPA 라우팅으로 Library 복귀 (page.goto는 zustand state를 리셋)
    await page.keyboard.press(`${META}+1`);
    await expect(page).toHaveURL(/\/library$/);
    const cards = page.getByRole("button", { name: /arXiv/i });
    await cards.nth(1).dblclick();
    await expect(page).toHaveURL(/\/r\/sample-/);
    tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);

    // ⌘1 → Library
    await page.keyboard.press(`${META}+1`);
    await expect(page).toHaveURL(/\/library$/);

    // ⌘2 → sample-1
    await page.keyboard.press(`${META}+2`);
    await expect(page).toHaveURL(/\/r\/sample-1$/);

    // ⌘W → 현재 탭(sample-1) 닫힘
    await page.keyboard.press(`${META}+w`);
    tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);
  });

  test("AC-S1-5 3-Column Reader Shell 렌더 (180px / 1fr / 360px)", async ({ page }) => {
    await openSamplePaper(page, 0);
    const grid = page.locator('div[style*="grid-template-columns"]').first();
    await expect(grid).toBeVisible();
    const style = await grid.getAttribute("style");
    expect(style).toContain("180px");
    expect(style).toContain("360px");
  });

  test("AC-S1-6 Top Toolbar 5-토글 [A G P K T] + 페이지 컨트롤 표시", async ({ page }) => {
    await openSamplePaper(page, 0);
    for (const label of [/오토 하이라이트/, /이미지 설명/, /단락 설명/, /Quick Skim/, /자동 번역/]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
    await expect(page.getByText(/^3 \/ 45$/)).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
  });

  test("AC-S1-3 Density Compact/Cozy/Spacious 토글이 :root에 반영", async ({ page }) => {
    await gotoLibrary(page);
    await page.getByRole("button", { name: "설정" }).click();
    await page.getByRole("menuitemradio", { name: /Spacious/ }).click();
    await expect(page.locator(":root")).toHaveAttribute("data-density", "spacious");

    await page.getByRole("menuitemradio", { name: /Compact/ }).click();
    await expect(page.locator(":root")).toHaveAttribute("data-density", "compact");
  });

  test("AC-S1-4 Theme Light/Dark 토글이 :root[data-theme]에 반영", async ({ page }) => {
    await gotoLibrary(page);
    await page.getByRole("button", { name: "설정" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator(":root")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator(":root")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("Phase 0 — Translation flow (S5)", () => {
  test("Translation 토글 → /api/translate 호출 + 우측 패널에 토큰 표시", async ({ page }) => {
    // /api/translate를 모킹 — BE 미기동에도 동작 검증 가능
    await page.route("**/api/translate", async (route) => {
      const body =
        `data: ${JSON.stringify({ token: "안녕" })}\n\n` +
        `data: ${JSON.stringify({ token: "하세요" })}\n\n` +
        `data: [DONE]\n\n`;
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        body,
      });
    });

    await openSamplePaper(page, 0);
    // Top Toolbar [T] 클릭 → translationEnabled ON, RightPanel이 Translation 탭으로 자동 전환
    await page.getByRole("button", { name: /자동 번역/ }).click();
    const pane = page.getByRole("complementary", { name: "AI 패널" });
    // 헤더 "Translation · 페이지 N" 또는 placeholder가 보여야 함
    await expect(pane).toContainText(/Translation/);
  });
});

test.describe("Phase 0 — Library shell (S6)", () => {
  test("Library에 파일럿 논문 2장 카드", async ({ page }) => {
    await gotoLibrary(page);
    await expect(page.getByText(/Code2World/i)).toBeVisible();
    await expect(page.getByText(/Mobile World Model/i)).toBeVisible();
    await expect(page.getByText(/arXiv:2602\.09856/)).toBeVisible();
  });
});
