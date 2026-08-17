import createMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "@/i18n/locales.generated";

/**
 * `localePrefix: "always"` là cố ý: `/vi/apps/…`, `/en/apps/…`.
 *
 * Kiểu "locale mặc định không prefix" sẽ đẻ ra route mơ hồ giữa `/apps` và
 * `/[locale]`, đồng thời làm `hreflang` và URL do SSG sinh ra kém tường minh.
 *
 * Danh sách locale lấy từ file sinh sẵn chứ không truy vấn DB: middleware chạy ở
 * edge, mỗi request đều đi qua đây. Xem spec §9.3.
 */
export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  // Bỏ qua route API, tài nguyên nội bộ của Next và mọi đường dẫn có phần mở
  // rộng (ảnh, favicon, sitemap) — những thứ này không có biến thể ngôn ngữ.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
