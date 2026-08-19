// e2e/admin-auth.spec.ts
import { test, expect } from "@playwright/test";

test("chưa đăng nhập thì /admin chuyển sang trang đăng nhập", async ({ page }) => {
  await page.goto("/vi/admin/apps");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("server action từ chối người chưa đăng nhập — bảo vệ layout không bảo vệ action", async ({ request }) => {
  const res = await request.post("/vi/admin/apps", {
    headers: { "Next-Action": "saveApp", "Content-Type": "text/plain;charset=UTF-8" },
    data: '[{"slug":"hacked","kind":"CORE","status":"PUBLISHED"}]',
  });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(await res.text()).not.toContain("hacked");
});

/**
 * Chuyển hướng của `requireAdmin()` phải giữ nguyên ngôn ngữ.
 *
 * Đây là test cấp request chứ không phải cấp trình duyệt, và đó là điểm mấu
 * chốt: với một lần điều hướng thật (`Sec-Fetch-Dest: document`) middleware
 * next-intl kịp gắn cookie `NEXT_LOCALE` lên chính cái 307 nên đoán ra đúng
 * ngôn ngữ, che mất lỗi. Lỗi chỉ lộ ra ở **request nền** — soft navigation của
 * router, server action, revalidate — vì `syncCookie` cố ý bỏ qua chúng.
 *
 * Nên: không cookie, `Accept-Language` **ngược** với ngôn ngữ trong URL, và
 * `Sec-Fetch-Dest: empty`. Không tự đi theo chuyển hướng — ta muốn xem đúng cái
 * `Location` do tầng auth phát ra, chứ không phải nơi middleware dắt tới sau đó.
 */
for (const { locale, other } of [
  { locale: "en", other: "vi-VN,vi;q=0.9" },
  { locale: "vi", other: "en-US,en;q=0.9" },
]) {
  test(`requireAdmin giữ ngôn ngữ ${locale} khi đá về trang đăng nhập`, async ({ playwright }) => {
    // Context riêng, không chia sẻ cookie với các test khác.
    const api = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
      extraHTTPHeaders: { "Accept-Language": other, "Sec-Fetch-Dest": "empty" },
    });

    try {
      const res = await api.get(`/${locale}/admin/apps`, { maxRedirects: 0 });

      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe(`/${locale}/admin/login`);
    } finally {
      await api.dispose();
    }
  });
}
