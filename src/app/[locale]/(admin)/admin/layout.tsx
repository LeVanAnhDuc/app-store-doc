import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { ThemeScript } from "@/components/ui/ThemeScript";
import { locales } from "@/i18n/locales.generated";

/**
 * Layout gốc của nhóm quản trị: `<html lang>` + `<body>` + chuỗi giao diện.
 *
 * **Cố ý không gọi `requireAdmin()` ở đây.** `/admin/login` là trang con của
 * layout này, và trang đăng nhập nằm dưới một layout đòi đăng nhập thì
 * `requireAdmin()` đá về `/admin/login`, layout chạy lại, đá về lần nữa — vòng
 * lặp chuyển hướng vô hạn. Lớp kiểm quyền vì vậy nằm ở
 * `(protected)/layout.tsx`, còn `login/` ở ngoài nhóm đó.
 *
 * Chọn route group `(protected)` thay vì đưa `login/` ra khỏi `admin/` vì URL
 * phải là `/admin/login` — người dùng gõ tay đường dẫn này, và Auth.js cũng trỏ
 * `pages.signIn` vào đó. Dùng hai route group song song cùng dựng `/admin/…`
 * cũng chạy, nhưng khi đó `<html>`/`<body>` phải chép ra hai chỗ.
 *
 * `<html>`/`<body>` nằm ở đây chứ không ở `src/app/layout.tsx` vì thẻ `lang`
 * phải theo locale của đường dẫn — cùng lý do như `(public)/layout.tsx`, xem
 * ghi chú bàn giao của Task 12.
 */

export const metadata: Metadata = {
  // CMS không bao giờ được lập chỉ mục, kể cả trang đăng nhập.
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // `[locale]` bắt cả đường dẫn lạ; ngôn ngữ không có trong danh sách là 404.
  if (!locales.includes(locale)) notFound();

  setRequestLocale(locale);

  return (
    // `suppressHydrationWarning`: `ThemeScript` đặt `data-theme` lên chính thẻ
    // này trước khi hydrate — cùng lý do như `(public)/layout.tsx`.
    <html lang={locale} suppressHydrationWarning>
      <body>
        {/* Đầu body, trước mọi thứ khác: chạy trước khung hình đầu tiên. */}
        <ThemeScript />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
