import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kiểu và lint chạy riêng bằng `npm run typecheck` / `npm run lint`,
  // nhưng vẫn để build tự kiểm để không lọt lỗi lên Vercel.
  typedRoutes: false,
};

/**
 * Gọi không tham số thì plugin tự tìm `./src/i18n/request.ts`.
 * Thiếu bước bọc này, alias `next-intl/config` không được đặt và
 * `useTranslations`/`getTranslations` sẽ nổ lúc chạy — build vẫn xanh,
 * nên lỗi chỉ lộ ra khi mở trang.
 */
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
