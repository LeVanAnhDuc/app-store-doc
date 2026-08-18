import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

/**
 * Playwright **không** nạp `.env` — chỉ Next nạp (cùng cái bẫy với Prisma CLI, vitest
 * và tsx, xem CLAUDE.md). Không có dòng dưới đây thì `process.env.ADMIN_EMAIL` trong
 * `e2e/content-roundtrip.spec.ts` là `undefined`, và `page.fill(..., undefined!)` ném
 * một lỗi không nhắc gì tới biến môi trường.
 *
 * `@next/env` là cùng bộ nạp mà chính Next dùng, nên nó xử lý đúng quy tắc expand
 * biến (`$` phải escape thành `\$`) thay vì đoán lại một lần nữa.
 */
loadEnvConfig(process.cwd());

/**
 * E2E chạy trên **cổng riêng**, không dùng 3000.
 *
 * Trước đây config này lấy `NEXT_PUBLIC_SITE_URL` (= `http://localhost:3000`) làm
 * `baseURL` và bật `reuseExistingServer: !process.env.CI`. Hai thứ đó cộng lại nghĩa
 * là **bất kỳ** tiến trình nào đang chiếm cổng 3000 cũng được nhận làm "server của
 * dự án này" — kể cả app của một dự án khác. Đã xảy ra thật: cổng 3000 do
 * `app-AI-workflow-automation-platform` chiếm, và cả bộ e2e báo xanh trong khi
 * không một request nào chạm vào Ducker.
 *
 * Vì sao chọn cổng riêng + `reuseExistingServer: false` chứ không phải một bước
 * "kiểm danh tính app trước khi chạy": kiểm danh tính vẫn phải đoán xem dấu hiệu nào
 * là đủ để nhận ra Ducker, và mỗi lần đổi giao diện là một lần phải sửa lại dấu hiệu
 * đó. Cổng riêng thì không có gì để đoán — Playwright luôn tự dựng server từ chính
 * mã trong thư mục này, và nếu cổng bị chiếm nó **dừng với lỗi** thay vì âm thầm
 * test sai app. Cái giá phải trả: `npm run build` phải chạy trước `npm run e2e`, vì
 * không còn dev server nào để mượn.
 */
const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Máy Windows này chạy song song hay flaky — giữ một worker.
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${port} --hostname 127.0.0.1`,
    url: baseURL,
    // Không bao giờ mượn server có sẵn: xem khối chú thích trên.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
