// e2e/a11y-tap-target.spec.ts
//
// Quét mọi phần tử bấm được và fail nếu còn cái nào nhỏ hơn 24×24 (WCAG 2.2 SC
// 2.5.8), cộng kiểm thân trang không cuộn ngang ở 375px.
//
// Đây là hai lỗi giao diện duy nhất trong bộ này **đo được bằng máy**. Phần còn lại
// — tiêu đề có đúng serif không, dấu tiếng Việt có vỡ không, khối mã có màu không —
// CSS không khớp thì trình duyệt im lặng, nên chỉ mắt người bắt được. Xem
// `docs/status.md` mục 1.
import { test, expect } from "@playwright/test";

const PAGES = [
  "/vi",
  "/vi/apps",
  "/vi/apps/web-store-apps",
  // Slug thật của trang hướng dẫn tích hợp OAuth. Kế hoạch viết
  // `/vi/docs/tich-hop-oauth` — slug đó không tồn tại, và một trang 404 vẫn đạt mọi
  // assertion dưới đây, nên sai chỗ này là bộ test tự báo xanh mà không kiểm gì.
  "/vi/docs/oauth-integration-guide",
];

for (const path of PAGES) {
  test(`vùng bấm ở ${path} đạt 24x24 (WCAG 2.2 SC 2.5.8)`, async ({ page }) => {
    const response = await page.goto(path);
    // Chốt chống tự lừa: trang không tồn tại thì không có gì để đo.
    expect(response?.status(), `${path} phải trả 200`).toBe(200);

    const small = await page.evaluate(() => {
      const sel = "a, button, input, select, [role=button]";
      return [...document.querySelectorAll(sel)]
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return {
            t: e.tagName,
            txt: (e.textContent || "").trim().slice(0, 24),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter((x) => x.h > 0 && (x.h < 24 || x.w < 24));
    });
    expect(small, JSON.stringify(small, null, 2)).toEqual([]);
  });

  test(`thân trang không cuộn ngang ở 375px — ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const response = await page.goto(path);
    expect(response?.status(), `${path} phải trả 200`).toBe(200);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
