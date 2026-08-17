import { getRequestConfig } from "next-intl/server";

import { defaultLocale, locales } from "./locales.generated";
import en from "./messages/en.json";
import vi from "./messages/vi.json";

/**
 * Chuỗi giao diện nạp tĩnh, không `import()` động theo biến.
 *
 * Đây là tầng "sửa bằng deploy" của spec §9.1: bộ chuỗi đi cùng code nên bundler
 * phải thấy được cả hai file lúc build. Nạp động theo tên locale sẽ khiến chúng
 * rơi khỏi bundle edge và trang hiện ra trống chữ.
 */
const messagesByLocale: Record<string, typeof vi> = { vi, en };

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  // `requestLocale` có thể là `undefined` (trang ngoài `[locale]`) hoặc một giá
  // trị rác vì `[locale]` bắt luôn cả đường dẫn lạ. Cả hai đều lùi về mặc định.
  const locale =
    requested && locales.includes(requested) ? requested : defaultLocale;

  // Locale mới thêm vào bảng `Locale` mà chưa kịp có file chuỗi giao diện thì
  // dùng tạm bộ mặc định — nội dung vẫn ra đúng ngôn ngữ, chỉ nhãn nút là chưa.
  const messages = messagesByLocale[locale] ?? vi;

  return { locale, messages };
});
