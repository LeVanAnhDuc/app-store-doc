"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { defaultLocale, locales } from "@/i18n/locales.generated";
import { signInWithPassword } from "@/server/auth";
import { checkRateLimit } from "@/server/auth/rate-limit";

/**
 * Server action của trang đăng nhập.
 *
 * Đây là action **duy nhất** trong CMS không mở đầu bằng `requireAdmin()`, vì
 * lý do hiển nhiên: nó là cửa để trở thành admin. Bù lại nó có hai lớp riêng —
 * giới hạn tần suất theo IP, và Zod kiểm hình dạng đầu vào.
 */

export type LoginState = { error: string | null };

const formSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * Khoá cho bộ đếm tần suất: IP của người gọi.
 *
 * `x-forwarded-for` là danh sách "client, proxy1, proxy2" nên chỉ phần tử đầu
 * mới là người gọi thật. Không đọc được IP thì dồn hết vào một khoá chung: thà
 * chặn chặt hơn mức cần còn hơn tắt hẳn giới hạn, vì đây là tuyến phòng thủ duy
 * nhất trước việc dò mật khẩu.
 */
async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerList.get("x-real-ip")?.trim() || "unknown";
}

export async function signInWithCredentials(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const requested = String(formData.get("locale") ?? "");
  // Ngôn ngữ đến từ form nên không tin được; giá trị lạ lùi về mặc định.
  const locale = locales.includes(requested) ? requested : defaultLocale;
  const t = await getTranslations({ locale });

  const parsed = formSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // Thiếu ô chưa phải một lần thử xác thực, nên không tính vào quota: gõ trượt
  // Enter trên form trống không được phép đốt một trong năm lần thử.
  if (!parsed.success) return { error: t("admin.login.errorMissing") };

  // Giới hạn tần suất chạy **trước** khi so mật khẩu. Đảo thứ tự là mở cửa cho
  // việc dò mật khẩu: kẻ tấn công vẫn được thử, chỉ là bị báo lỗi sau đó.
  const limit = checkRateLimit(await clientKey());
  if (!limit.allowed) {
    return {
      error: t("admin.login.errorRateLimited", {
        minutes: Math.max(1, Math.ceil(limit.retryAfterSec / 60)),
      }),
    };
  }

  const signedIn = await signInWithPassword(parsed.data.email, parsed.data.password);
  // Một câu lỗi cho cả hai trường hợp sai email và sai mật khẩu: nói rõ cái nào
  // sai là chỉ cho kẻ tấn công biết email nào tồn tại.
  if (!signedIn) return { error: t("admin.login.errorWrong") };

  redirect(`/${locale}/admin`);
}
