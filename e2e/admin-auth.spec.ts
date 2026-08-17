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
