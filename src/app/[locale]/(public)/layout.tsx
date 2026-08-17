import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TopBar, type TopBarNavItem } from "@/components/docs/TopBar";
import { locales } from "@/i18n/locales.generated";
import { listNav } from "@/server/content/queries";
import styles from "./layout.module.css";

/**
 * Số mục tài liệu tối đa trên thanh trên cùng. Mockup có bốn mục cả thảy; thêm
 * bao nhiêu nhóm cũng nhồi lên đây thì thanh vỡ, mà cột trái của trang tài liệu
 * và ô tìm kiếm đã dẫn được tới mọi trang.
 */
const MAX_DOC_NAV_ITEMS = 3;

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

  const [t, nav] = await Promise.all([getTranslations({ locale }), listNav(locale)]);

  /**
   * Điều hướng chính dựng từ nội dung thật.
   *
   * Hai mục cố định `/…` và `/…/apps` luôn tồn tại vì đó là hai trang code dựng.
   * Phần tài liệu thì lấy từ `listNav`: mỗi nhóm trỏ tới trang đầu của nhóm,
   * trang không nhóm thì tự nó là một mục. Trước đây hai mục "Hướng dẫn" và
   * "API" trỏ cứng vào `/docs` và `/docs/api` — không route nào như vậy, nên cả
   * hai đều ra 404.
   */
  const navItems: TopBarNavItem[] = [
    { key: "ecosystem", href: `/${locale}`, label: t("nav.ecosystem"), exact: true },
    { key: "apps", href: `/${locale}/apps`, label: t("nav.apps") },
    ...nav
      .flatMap((group, index) => {
        if (group.items.length === 0) return [];

        // Nhóm có tên: một mục mang tên nhóm, trỏ tới trang đầu tiên trong đó.
        if (group.group) {
          return [{ key: `group-${index}`, href: group.items[0].href, label: group.group }];
        }

        // Nhóm không tên: từng trang tự đứng thành một mục.
        return group.items.map((item) => ({
          key: `page-${item.slug}`,
          href: item.href,
          label: item.title,
        }));
      })
      .slice(0, MAX_DOC_NAV_ITEMS),
  ];

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <div className={styles.shell}>
            <TopBar locale={locale} items={navItems} />
            <main className={styles.main}>{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
