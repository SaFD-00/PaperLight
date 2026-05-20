import { expect, type Page, test } from "@playwright/test";

const COLLECTIONS = [
  {
    id: "c1",
    name: "GUI Agents",
    parentId: null,
    color: null,
    position: 1,
    isSpecial: false,
    specialKind: null,
    paperCount: 1,
  },
];

const TAGS = [
  { id: "t1", name: "AI", color: null, count: 3 },
  { id: "t2", name: "RLHF", color: null, count: 1 },
];

const PAPER_A = {
  id: "p-a",
  title: "Diffusion Models",
  authors: ["Ho, Jonathan"],
  year: 2020,
  venue: "NeurIPS",
  arxivId: null,
  doi: null,
  status: "to_read",
  progressPct: 0,
  ingestionStatus: "ready",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tags: [{ id: "t1", name: "AI", color: null }],
  collectionIds: [],
};

const PAPER_B = { ...PAPER_A, id: "p-b", title: "GUI World Model", authors: ["Xu, Wei"] };

async function mockLibrary(page: Page) {
  await page.route("**/api/library/collections", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(COLLECTIONS),
    });
  });
  await page.route("**/api/library/tags", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TAGS),
    });
  });
  await page.route("**/api/library/papers**", async (route) => {
    const url = new URL(route.request().url());
    const data = url.searchParams.get("collectionId") === "c1" ? [PAPER_B] : [PAPER_A];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

test.describe("Phase 1 S13 — library 4-pane", () => {
  test("4-pane 렌더 + 컬렉션 필터", async ({ page }) => {
    await mockLibrary(page);
    await page.goto("/library");

    // 컬렉션 트리 (특수 폴더 + 사용자 컬렉션)
    const tree = page.getByRole("navigation", { name: "컬렉션" });
    await expect(tree.getByRole("button", { name: "Starred" })).toBeVisible();
    await expect(tree.getByRole("button", { name: /GUI Agents/ })).toBeVisible();

    // 기본 리스트(My Library) — 파일럿 + mocked paper
    await expect(page.getByText("Diffusion Models")).toBeVisible();

    // 컬렉션 클릭 → 리스트 갱신
    await tree.getByRole("button", { name: /GUI Agents/ }).click();
    await expect(page.getByText("GUI World Model")).toBeVisible();
  });

  test("논문 선택 → 디테일 패널 + 멀티선택 Bulk", async ({ page }) => {
    await mockLibrary(page);
    await page.goto("/library");

    await page.getByRole("button", { name: /Diffusion Models/ }).first().click();
    await expect(page.getByRole("button", { name: "리더 열기" })).toBeVisible();
    await expect(page.getByLabel("읽기 상태")).toBeVisible();

    // 멀티선택 → BulkToolbar
    await page.getByRole("checkbox", { name: "Diffusion Models 선택" }).check();
    await expect(page.getByText("1개 선택")).toBeVisible();
  });

  test("Tag Cloud AND 필터 + scope 검색", async ({ page }) => {
    await mockLibrary(page);
    await page.goto("/library");

    const cloud = page.getByLabel("태그 클라우드");
    await expect(cloud.getByRole("button", { name: /AI/ })).toBeVisible();
    await cloud.getByRole("button", { name: /AI/ }).click();
    await expect(page.getByText("Diffusion Models")).toBeVisible();

    // 본문 scope 토글
    await page.getByRole("button", { name: "본문" }).click();
    await page.getByLabel("라이브러리 검색").fill("denoising");
    await expect(page.getByText("Diffusion Models")).toBeVisible();
  });

  test("Import/Export 메뉴", async ({ page }) => {
    await mockLibrary(page);
    await page.goto("/library");

    await page.getByRole("button", { name: "가져오기/내보내기" }).click();
    await expect(page.getByText("가져오기", { exact: true })).toBeVisible();
    await expect(page.getByText("내보내기", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "BibTeX" }).first()).toBeVisible();
  });
});
