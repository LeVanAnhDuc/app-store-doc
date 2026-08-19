import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { TopBar } from "@/components/docs/TopBar";
import { ThemeScript } from "@/components/ui/ThemeScript";
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
    /**
     * `suppressHydrationWarning` chỉ cho MỘT việc: `ThemeScript` sửa thuộc tính
     * `data-theme` của chính thẻ này trước khi React hydrate, nên HTML máy chủ
     * in ra và DOM lúc hydrate cố ý khác nhau. Không có nó thì console đỏ một
     * cảnh báo mà nguyên nhân nằm cách đó hai file.
     */
    <html lang={locale} suppressHydrationWarning>
      <body>
        {/* Phải là phần tử ĐẦU TIÊN của body: script đồng bộ ở đây chạy trước
            khung hình đầu tiên, nên không có nháy màu sai. */}
        <ThemeScript />
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
