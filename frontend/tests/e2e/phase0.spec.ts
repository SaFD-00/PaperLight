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

  test("AC-S1-5 3-Column Reader Shell 렌더 (Sidebar 180 / PDF / AI 360)", async ({ page }) => {
    await openSamplePaper(page, 0);
    // 현재 셸은 inline grid 대신 flex + 고정폭(Sidebar w-180 / Center flex-1 / AI w-360).
    await expect(page.getByRole("region", { name: "PDF 본문 영역" })).toBeVisible();
    const panel = page.getByRole("complementary", { name: "AI 패널" });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(355);
    expect(box?.width).toBeLessThanOrEqual(365);
  });

  test("AC-S1-6 Top Toolbar 5-토글 [A G P K T] + 페이지/줌 컨트롤 표시", async ({ page }) => {
    await openSamplePaper(page, 0);
    for (const label of [/오토 하이라이트/, /이미지 설명/, /단락 설명/, /Quick Skim/, /자동 번역/]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
    // 샘플 PDF는 30p — 페이지 카운터는 "N / M" 형식.
    await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible();
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
  test("자동 번역 토글 → translationEnabled ON (aria-pressed)", async ({ page }) => {
    await openSamplePaper(page, 0);
    // 번역은 별도 패널 탭이 아니라 본문 인라인(컬럼)으로 이동 — 토글의 pressed 상태로 검증.
    const toggle = page.getByRole("button", { name: /자동 번역/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Phase 0 — Library shell (S6)", () => {
  test("Library에 파일럿 논문 2장 카드", async ({ page }) => {
    await gotoLibrary(page);
    // 탭바에도 같은 제목이 떠 있을 수 있어 논문 목록 영역으로 스코프.
    const list = page.getByRole("list", { name: "논문 목록" });
    await expect(list.getByText(/Code2World/i)).toBeVisible();
    await expect(list.getByText(/Mobile World Model/i)).toBeVisible();
    await expect(list.getByText(/arXiv:/i).first()).toBeVisible();
  });
});
