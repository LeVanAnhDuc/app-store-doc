"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { NextIntlClientProvider, useTranslations } from "next-intl";

import { defaultLocale, locales } from "@/i18n/locales.generated";
import en from "@/i18n/messages/en.json";
import vi from "@/i18n/messages/vi.json";
import styles from "./status.module.css";

/**
 * Ranh giới lỗi cho mọi đường dẫn dưới `[locale]`.
 *
 * Hai chuyện phải tự làm ở đây, cùng một lý do: ranh giới lỗi nằm **ngoài**
 * `(public)/layout.tsx`, nên khi nó chạy thì layout đó không chạy.
 *
 * 1. **Tự dựng `<html>`/`<body>`** — không có ai dựng hộ.
 * 2. **Tự dựng `NextIntlClientProvider`** với bộ chuỗi nạp tĩnh. Không dùng
 *    được `getTranslations` vì file này buộc phải là client component, mà
 *    provider của layout thì không bao trùm tới đây. Nạp tĩnh cũng là điều
 *    đúng cho một trang lỗi: nó phải hiện được cả khi phần lấy dữ liệu của máy
 *    chủ đang hỏng.
 */

const messagesByLocale: Record<string, typeof vi> = { vi, en };

function ErrorBody({ reset }: { reset: () => void }) {
  const t = useTranslations("error");

  return (
    <main className={styles.wrap}>
      <p className={styles.code}>500</p>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.body}>{t("body")}</p>
      {/* Nút nói đúng việc nó làm: dựng lại đúng nhánh vừa lỗi. */}
      <button className={styles.action} type="button" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Trang lỗi không hiện chi tiết kỹ thuật cho người đọc; chỗ để lần là log.
  useEffect(() => {
    console.error(error);
  }, [error]);

  const pathname = usePathname() ?? `/${defaultLocale}`;
  const segment = pathname.split("/")[1] ?? "";
  const locale = locales.includes(segment) ? segment : defaultLocale;

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale] ?? vi}>
          <ErrorBody reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
