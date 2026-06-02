import { expect, test } from "@playwright/test";

test.describe("S16 — Google 로그인 버튼", () => {
  test("authUrl 응답 → accounts.google.com 으로 리다이렉트", async ({ page }) => {
    await page.route("**/api/auth/login/google", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authUrl: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=s",
        }),
      }),
    );
    // 실제 google 페이지로는 나가지 않도록 가로채기
    await page.route("https://accounts.google.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>ok</html>" }),
    );

    await page.goto("/login");
    await page.getByRole("button", { name: /Google 계정으로 계속하기/ }).click();
    await page.waitForURL(/accounts\.google\.com/);
    expect(page.url()).toContain("accounts.google.com");
  });

  test("미구성(503) → 안내 메시지 노출", async ({ page }) => {
    await page.route("**/api/auth/login/google", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/login");
    await page.getByRole("button", { name: /Google 계정으로 계속하기/ }).click();
    await expect(page.getByText(/준비 중/)).toBeVisible();
  });
});
