import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppCard } from "@/components/docs/AppCard";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { listApps } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * Danh sách toàn bộ ứng dụng — đích của mục "Ứng dụng" trên thanh trên cùng.
 *
 * Trang chủ đã có lưới thẻ, nhưng nó kể một câu chuyện (sơ đồ đấu nối trước,
 * vài thẻ mở đầu sau). Trang này chỉ làm một việc: liệt kê đủ, không bình luận.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("apps.title")} — ${t("brand.name")}`,
    description: t("apps.description"),
    alternates: {
      canonical: `/${locale}/apps`,
      languages: {
        ...Object.fromEntries(locales.map((code) => [code, `/${code}/apps`])),
        "x-default": `/${defaultLocale}/apps`,
      },
    },
  };
}

export default async function AppsPage({ params }: PageParams) {
  const { locale } = await params;
  // Thiếu dòng này trang rơi về kết xuất động (ghi chú bàn giao của Task 12).
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const apps = await listApps(locale);

  const statusLabels = {
    core: t("status.core"),
    connected: t("status.connected"),
    planned: t("status.planned"),
    standalone: t("status.standalone"),
    private: t("status.private"),
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{t("apps.eyebrow", { count: apps.length })}</p>
        <h1 className={styles.title}>{t("apps.title")}</h1>
        <p className={styles.lede}>{t("apps.lede")}</p>
      </header>

      {apps.length > 0 ? (
        <div className={styles.cards}>
          {apps.map((app) => (
            <AppCard
              key={app.slug}
              app={app}
              locale={locale}
              statusLabel={statusLabels[app.integration]}
              repoLabel={t("app.viewRepoOnGithub")}
            />
          ))}
        </div>
      ) : (
        // Màn hình trống là lời mời hành động, không phải chỗ than thở.
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t("apps.emptyTitle")}</p>
          <p className={styles.emptyBody}>{t("apps.emptyBody")}</p>
        </div>
      )}
    </div>
  );
}
