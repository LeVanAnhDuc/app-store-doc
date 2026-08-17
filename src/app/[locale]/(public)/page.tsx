import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppCard } from "@/components/docs/AppCard";
import { WireDiagram, type WireItem } from "@/components/ui";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { listApps } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * Trang chủ dựng tĩnh cho từng ngôn ngữ (mockup màn 01).
 *
 * Danh sách ứng dụng lấy từ DB; chưa cấu hình `DATABASE_URL` thì `listApps` trả
 * mảng rỗng và trang hiện trạng thái trống — lời mời thêm ứng dụng, không phải
 * lỗi. Trang tuyệt đối không được đổ vỡ vì chuyện đó.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateStaticParams() {
  const { locales } = await import("@/i18n/locales.generated");
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("brand.name")} — ${t("home.title")}`,
    description: t("home.description"),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(locales.map((code) => [code, `/${code}`])),
        "x-default": `/${defaultLocale}`,
      },
    },
  };
}

export default async function HomePage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const apps = await listApps(locale);

  // Nhãn trạng thái dịch một lần rồi truyền xuống: `WireDiagram` và `AppCard`
  // không được tự bịa chữ, chúng chỉ biết `integration` là khoá kỹ thuật nào.
  const statusLabels = {
    core: t("status.core"),
    connected: t("status.connected"),
    planned: t("status.planned"),
    standalone: t("status.standalone"),
    private: t("status.private"),
  };

  const wireItems: WireItem[] = apps.map((app) => ({
    name: app.name,
    desc: app.tagline ?? undefined,
    integration: app.integration,
  }));

  return (
    <>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("home.eyebrow", { count: apps.length })}</p>
        <h1 className={styles.title}>{t("home.title")}</h1>
        <p className={styles.lede}>{t("home.lede")}</p>

        {apps.length > 0 ? (
          <div className={styles.wire}>
            <WireDiagram
              items={wireItems}
              coreLabel={t("home.core")}
              labels={statusLabels}
              legendLabels={{
                connected: t("legend.connected"),
                planned: t("legend.planned"),
                private: t("legend.private"),
                standalone: t("legend.standalone"),
              }}
              legendTitle={t("legend.title")}
              itemsTitle={t("legend.items")}
            />
          </div>
        ) : (
          // Chưa có ứng dụng nào thì không vẽ sơ đồ rỗng kèm chú giải cho một
          // thứ không tồn tại — nói thẳng còn thiếu gì và thêm ở đâu.
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{t("home.emptyTitle")}</p>
            <p className={styles.emptyBody}>{t("home.emptyBody")}</p>
          </div>
        )}
      </section>

      {apps.length > 0 ? (
        <section className={styles.apps}>
          <p className={styles.sectionLabel}>{t("home.appsLabel")}</p>
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
        </section>
      ) : null}
    </>
  );
}
