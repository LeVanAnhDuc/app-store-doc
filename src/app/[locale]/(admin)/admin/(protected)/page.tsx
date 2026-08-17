import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AdminBar,
  AdminBlock,
  AdminBody,
  AdminScope,
  AdminTitle,
} from "@/components/admin/AdminShell";
import { listAppsForAdmin } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * `/[locale]/admin` — Tổng quan.
 *
 * Trang này trả lời đúng hai câu hỏi mà người quản lý nội dung mở CMS ra để hỏi:
 * cái gì chưa công khai, và cái gì thiếu bản dịch. Không có ô số liệu trang trí:
 * số đếm đã nằm cạnh từng mục ở cột điều hướng.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.overview.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminOverviewPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const apps = await listAppsForAdmin(locale);

  // "Chưa công khai" gộp cả DRAFT và ARCHIVED: từ góc nhìn người đọc trang công
  // khai thì hai trạng thái này giống nhau — không thấy gì cả.
  const drafts = apps.filter((app) => app.status !== "PUBLISHED");
  const missing = apps.filter((app) => app.missingLocales.length > 0);

  return (
    <>
      <AdminBar>
        <AdminTitle>{t("admin.overview.title")}</AdminTitle>
        <AdminScope>{t("admin.overview.scope", { count: apps.length })}</AdminScope>
      </AdminBar>

      <AdminBody>
        {apps.length === 0 ? (
          // Màn hình trống là lời mời hành động, không phải chỗ than thở.
          <AdminBlock heading={t("admin.overview.emptyTitle")}>
            <p className={styles.text}>{t("admin.overview.emptyBody")}</p>
            <a className={styles.link} href={`/${locale}/admin/apps`}>
              {t("admin.overview.goToApps")}
            </a>
          </AdminBlock>
        ) : (
          <>
            <AdminBlock
              heading={t("admin.overview.draftsTitle")}
              scope={t("admin.overview.draftsScope", { count: drafts.length })}
            >
              {drafts.length === 0 ? (
                <p className={styles.text}>{t("admin.overview.draftsEmpty")}</p>
              ) : (
                <>
                  <p className={styles.text}>{t("admin.overview.draftsHint")}</p>
                  <ul className={styles.list}>
                    {drafts.map((app) => (
                      <li className={styles.item} key={app.id}>
                        {/* Thiếu bản dịch thì nói thẳng là thiếu, không lấy slug làm nhãn. */}
                        <span className={app.name ? styles.name : styles.noName}>
                          {app.name ?? t("admin.apps.noName")}
                        </span>
                        <span className={styles.slug}>{app.slug}</span>
                        <span className={styles.state}>
                          {app.status === "DRAFT"
                            ? t("admin.publishState.draft")
                            : t("admin.publishState.archived")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </AdminBlock>

            <AdminBlock
              heading={t("admin.overview.missingTitle")}
              scope={t("admin.overview.missingScope", { count: missing.length })}
            >
              {missing.length === 0 ? (
                <p className={styles.text}>{t("admin.overview.missingEmpty")}</p>
              ) : (
                <>
                  <p className={styles.text}>{t("admin.overview.missingHint")}</p>
                  <ul className={styles.list}>
                    {missing.map((app) => (
                      <li className={styles.item} key={app.id}>
                        <span className={app.name ? styles.name : styles.noName}>
                          {app.name ?? t("admin.apps.noName")}
                        </span>
                        <span className={styles.slug}>{app.slug}</span>
                        <span className={styles.state}>
                          {app.missingLocales.join(", ").toUpperCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </AdminBlock>
          </>
        )}
      </AdminBody>
    </>
  );
}
