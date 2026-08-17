import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { TopBar } from "@/components/docs/TopBar";
import { locales } from "@/i18n/locales.generated";
import styles from "./layout.module.css";

/**
 * Khung của mọi trang công khai: thanh trên cùng (kèm ô tìm kiếm) và vùng nội dung.
 * Task 13 dùng lại nguyên khung này cho trang ứng dụng và trang hướng dẫn.
 *
 * Đây là chỗ đặt `<html>`/`<body>` chứ không phải `src/app/layout.tsx`: thẻ
 * `lang` phải theo locale của đường dẫn, mà layout gốc nằm ngoài `[locale]` nên
 * không đọc được tham số đó. Layout gốc vì vậy chỉ truyền `children` đi tiếp —
 * đúng khuôn mẫu "nhiều layout gốc" của App Router.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // `[locale]` bắt cả đường dẫn lạ (`/foo/bar`); ngôn ngữ không có trong danh
  // sách thì đây là trang không tồn tại, không phải trang tiếng Việt.
  if (!locales.includes(locale)) notFound();

  // Bật kết xuất tĩnh cho next-intl: thiếu dòng này mọi trang con rơi về động.
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <div className={styles.shell}>
            <TopBar locale={locale} />
            <main className={styles.main}>{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
