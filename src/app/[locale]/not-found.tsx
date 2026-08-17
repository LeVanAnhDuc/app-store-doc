import { getLocale, getTranslations } from "next-intl/server";

import styles from "./status.module.css";

/**
 * Trang 404 cho mọi đường dẫn dưới `[locale]`.
 *
 * **Tự dựng `<html>`/`<body>`.** File này nằm ở tầng `[locale]`, còn
 * `<html>`/`<body>` lại nằm trong `(public)/layout.tsx` — layout đó không phải
 * tổ tiên của ranh giới not-found, nên khi `notFound()` được gọi thì nó không
 * chạy. Không tự dựng thì trang này ra HTML không có phần thân.
 *
 * `notFound()` không truyền tham số đường dẫn, nên ngôn ngữ lấy từ next-intl.
 * `[locale]/layout.tsx` đã gọi `setRequestLocale(locale)` nên `getLocale()` đọc
 * từ cache, không chạm header — chạm header thì `/vi` và `/vi/apps` rơi về kết
 * xuất động, vì trang 404 dựng cùng lúc với chúng. Locale không có trong danh
 * sách thì next-intl lùi về mặc định: vẫn đọc được, chỉ là không đúng ngôn ngữ
 * người gõ.
 */
export default async function LocaleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  return (
    <html lang={locale}>
      <body>
        <main className={styles.wrap}>
          <p className={styles.code}>404</p>
          <h1 className={styles.title}>{t("notFound.title")}</h1>
          <p className={styles.body}>{t("notFound.body")}</p>
          <a className={styles.action} href={`/${locale}`}>
            {t("notFound.backHome")}
          </a>
        </main>
      </body>
    </html>
  );
}
