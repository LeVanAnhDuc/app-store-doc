import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kiểu và lint chạy riêng bằng `npm run typecheck` / `npm run lint`,
  // nhưng vẫn để build tự kiểm để không lọt lỗi lên Vercel.
  typedRoutes: false,
  // Huy hiệu dev của Next nằm đè lên nút Đăng xuất ở góc dưới trái trang quản trị,
  // che mất chữ khi soát giao diện. Chỉ ảnh hưởng `next dev`.
  devIndicators: false,
};

/**
 * Gọi không tham số thì plugin tự tìm `./src/i18n/request.ts`.
 * Thiếu bước bọc này, alias `next-intl/config` không được đặt và
 * `useTranslations`/`getTranslations` sẽ nổ lúc chạy — build vẫn xanh,
 * nên lỗi chỉ lộ ra khi mở trang.
 */
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
