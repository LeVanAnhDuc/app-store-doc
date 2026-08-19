/**
 * Đường dẫn trang đăng nhập — **có tiền tố ngôn ngữ**.
 *
 * ĐÂY LÀ FILE DUY NHẤT TRONG `src/server/auth/` BIẾT TỚI i18n. Có một test canh
 * điều đó trong `boundary.test.ts`; đừng `import` next-intl ở chỗ khác của tầng
 * auth, hãy gọi `loginRedirectPath()`.
 *
 * ## Vì sao phải dạy tầng auth biết về ngôn ngữ
 *
 * `requireAdmin()` trước đây đá về `/admin/login` trần. Middleware của next-intl
 * sau đó tự đoán ngôn ngữ bằng cookie `NEXT_LOCALE`, rồi tới `Accept-Language`.
 * Với một lần điều hướng thật (`Sec-Fetch-Dest: document`) cách đoán đó **may mà
 * đúng**, vì `syncCookie` của next-intl kịp gắn `NEXT_LOCALE` lên chính cái 307
 * mà `requireAdmin()` sinh ra. Nhưng `syncCookie` **bỏ qua request nền** — soft
 * navigation của router, server action, revalidate — nên trong những trường hợp
 * đó không có cookie nào được đặt, và người đang ở `/en/admin/...` rơi xuống
 * `/vi/admin/login`. Đã đo thật: xem báo cáo kèm commit.
 *
 * ## Đánh đổi
 *
 * Trả giá: tầng auth không còn "mù" i18n tuyệt đối — nó phụ thuộc `next-intl` và
 * `@/i18n/locales.generated`. Đổi lại **không** phải đổi chữ ký `requireAdmin()`,
 * hàm đang được gọi ở hơn hai mươi chỗ; và không phải nhét một tham số `locale`
 * mà hai mươi chỗ đó đều có thể quên truyền — quên thì lỗi im lặng, đúng bằng
 * cái lỗi ta đang sửa. Ngày đổi sang IDMS OAuth, provider mới chỉ việc gọi
 * `loginRedirectPath()`; nó không phải biết vì sao đường dẫn lại có tiền tố.
 */
import { getLocale } from "next-intl/server";

import { defaultLocale, locales } from "@/i18n/locales.generated";

/** Đường dẫn trần, không tiền tố. Chỉ dùng cho `pages.signIn` của Auth.js. */
export const LOGIN_PATH = "/admin/login";

/**
 * Ghép tiền tố ngôn ngữ vào đường dẫn đăng nhập. Hàm thuần, không đọc request.
 *
 * Ngôn ngữ lạ hoặc thiếu thì lùi về mặc định — **không bao giờ** trả ra đường
 * dẫn trần, vì đường dẫn trần chính là thứ đẩy việc đoán ngôn ngữ ngược lại cho
 * middleware.
 */
export function localizedLoginPath(locale: string | null | undefined): string {
  const safe = locale && locales.includes(locale) ? locale : defaultLocale;
  return `/${safe}${LOGIN_PATH}`;
}

/**
 * Đường dẫn đăng nhập cho **request hiện tại**.
 *
 * `getLocale()` của next-intl chạy được cả trong server component lẫn server
 * action: nó đọc header `X-NEXT-INTL-LOCALE` do middleware đặt vào, hoặc bộ nhớ
 * đệm theo request mà `setRequestLocale()` ở layout đã ghi.
 *
 * Nuốt lỗi là cố ý. Nếu `getLocale()` ném (gọi ngoài phạm vi một request, hoặc
 * next-intl cấu hình sai) thì hỏng ở đây sẽ biến một lệnh chuyển hướng thành
 * trang 500 — tức là **mất luôn lớp bảo vệ nhìn thấy được**. Lùi về ngôn ngữ mặc
 * định chỉ tệ đúng bằng hành vi cũ, và người dùng vẫn bị đá ra khỏi CMS.
 */
export async function loginRedirectPath(): Promise<string> {
  try {
    return localizedLoginPath(await getLocale());
  } catch {
    return localizedLoginPath(defaultLocale);
  }
}
