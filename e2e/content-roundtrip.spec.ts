// e2e/content-roundtrip.spec.ts
import { test, expect } from "@playwright/test";

test.skip(!process.env.DATABASE_URL_TEST, "cần DATABASE_URL_TEST");

test("sửa nội dung trong CMS thì trang công khai đổi mà không cần deploy", async ({ page }) => {
  await page.goto("/vi/admin/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  // Phải đợi đăng nhập xong mới đi tiếp. Không có dòng này thì `goto` chạy trước khi
  // cookie phiên được đặt, trang quản trị đẩy về `/admin/login`, và test đổ ở
  // `page.fill` với "waiting for input[name=tagline]" — một thông báo không hé ra
  // rằng nguyên nhân là chưa đăng nhập.
  await page.waitForURL(/\/admin(?!\/login)/);

  await page.goto("/vi/admin/apps/web-store-apps");
  await page.fill('input[name="tagline"]', "Tagline vừa đổi lúc kiểm thử");
  await page.click('button:has-text("Lưu")');
  // Bắt đúng vùng thông báo, không bắt theo chữ: "Đã lưu" là tiền tố của "Đã lưu trữ"
  // trong ô Trạng thái, nên `getByText("Đã lưu")` khớp hai phần tử và đổ vì strict mode.
  await expect(page.getByRole("status")).toHaveText("Đã lưu");

  // `mutations.ts` gọi `revalidateTag(tag, "max")`, và tài liệu Next 16
  // (`node_modules/next/dist/docs/.../revalidateTag.md`) nói rõ hồ sơ `"max"` là
  // stale-while-revalidate: **lượt xem đầu tiên sau khi ghi vẫn nhận bản cũ**, bản
  // mới dựng ở nền và tới từ lượt sau. Vậy nên phải tải lại, không phải kiểm một lần.
  // Lời hứa của hệ thống là "đổi mà không cần deploy", không phải "đổi ngay ở lượt đầu".
  await page.goto("/vi/apps/web-store-apps");
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Tagline vừa đổi lúc kiểm thử")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
});

test("tên ứng dụng hiển thị dạng viết hoa đầu từ, không phải slug", async ({ page }) => {
  await page.goto("/vi");
  await expect(page.getByRole("heading", { name: "Web Store Apps" })).toBeVisible();
  // Slug **được phép** xuất hiện: design-rules §1 đòi nó hiện ở vai phụ, chữ mono
  // màu `--muted`, ngay dưới tên hiển thị. Điều bị cấm là slug leo vào chỗ của tên.
  // Bản đầu của test này kỳ vọng slug vắng mặt hoàn toàn — kỳ vọng viết theo một
  // quy tắc đã bị thay, và vì test chưa từng chạy nên không ai thấy nó sai.
  await expect(page.locator("h1, h2, h3, h4").filter({ hasText: "web-store-apps" })).toHaveCount(0);
  await expect(page.getByText("web-store-apps", { exact: true }).first()).toBeVisible();
});
