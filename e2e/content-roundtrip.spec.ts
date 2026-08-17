// e2e/content-roundtrip.spec.ts
import { test, expect } from "@playwright/test";

test.skip(!process.env.DATABASE_URL_TEST, "cần DATABASE_URL_TEST");

test("sửa nội dung trong CMS thì trang công khai đổi mà không cần deploy", async ({ page }) => {
  await page.goto("/vi/admin/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');

  await page.goto("/vi/admin/apps/web-store-apps");
  await page.fill('input[name="tagline"]', "Tagline vừa đổi lúc kiểm thử");
  await page.click('button:has-text("Lưu")');
  await expect(page.getByText("Đã lưu")).toBeVisible();

  await page.goto("/vi/apps/web-store-apps");
  await expect(page.getByText("Tagline vừa đổi lúc kiểm thử")).toBeVisible();
});

test("tên ứng dụng hiển thị dạng viết hoa đầu từ, không phải slug", async ({ page }) => {
  await page.goto("/vi");
  await expect(page.getByRole("heading", { name: "Web Store Apps" })).toBeVisible();
  await expect(page.getByText("web-store-apps", { exact: true })).toHaveCount(0);
});
