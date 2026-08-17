import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginForm } from "@/components/admin/LoginForm";
import { signInWithCredentials } from "./actions";

/**
 * `/[locale]/admin/login` — mockup màn 06.
 *
 * Trang này nằm **ngoài** nhóm `(protected)`, nên không có `requireAdmin()` nào
 * chạy trước nó. Đó là điều kiện để không có vòng lặp chuyển hướng.
 *
 * Cố ý **không** tự đá người đã đăng nhập sang `/admin`: kiểm được điều đó thì
 * phải biết tên vai trò admin, mà tên vai trò là chuyện riêng của
 * `src/server/auth/`. Đoán sai tên vai trò ở đây sẽ dựng đúng cái vòng lặp mà cả
 * bố cục route này sinh ra để tránh. Người đã đăng nhập gõ lại `/admin/login`
 * chỉ thấy form; bấm Đăng nhập là vào CMS.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.login.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLoginPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LoginForm locale={locale} action={signInWithCredentials} />;
}
