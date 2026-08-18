import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { TopBar } from "@/components/docs/TopBar";
import { locales } from "@/i18n/locales.generated";
import { getNavTree } from "@/server/content/queries";
import styles from "./layout.module.css";

/**
 * Khung của mọi trang công khai: thanh trên cùng (thương hiệu, ô tìm kiếm, dải
 * tab) và vùng nội dung.
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

  /**
   * Điều hướng đến từ **một** nguồn duy nhất: cây `NavNode` do CMS quản.
   *
   * Nút gốc là dải tab trên cùng (spec §3.2). Không còn mục nào viết cứng ở đây:
   * bản trước ghép một truy vấn nhóm trang tài liệu với hai mục cố định, nên thứ tự
   * tab không ai sửa được từ CMS. `getNavTree` trả mảng rỗng khi chưa có DB, và khi
   * đó `TopBar` đơn giản không dựng dải tab.
   */
  const tree = await getNavTree(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <div className={styles.shell}>
            <TopBar locale={locale} tree={tree} />
            <main className={styles.main}>{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
