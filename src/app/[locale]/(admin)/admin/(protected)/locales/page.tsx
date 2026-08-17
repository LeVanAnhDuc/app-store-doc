import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AdminBar,
  AdminBlock,
  AdminBody,
  AdminScope,
  AdminTitle,
} from "@/components/admin/AdminShell";
import { listLocalesForAdmin } from "@/server/content/queries";
import { setDefaultLocale, setLocaleEnabled } from "../../actions";
import { LocaleTable } from "./LocaleTable";
import styles from "./page.module.css";

/**
 * `/[locale]/admin/locales` — bật/tắt ngôn ngữ và đặt ngôn ngữ mặc định.
 *
 * Bảng `Locale` là nguồn sự thật; `src/i18n/locales.generated.ts` chỉ là bản chụp
 * dùng cho middleware ở edge. Vì vậy trang này có cột "Định tuyến": bật một ngôn
 * ngữ mới trong DB xong, `/xx/...` vẫn chưa có trang cho tới lần redeploy kế tiếp
 * (spec §9.3). Nói ra trong bảng còn hơn để người vận hành tự đoán vì sao ngôn ngữ
 * vừa bật lại ra 404.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.locales.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLocalesPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const rows = await listLocalesForAdmin();

  const pendingRedeploy = rows.filter((row) => row.enabled && !row.routed).map((row) => row.code);

  return (
    <>
      <AdminBar>
        <AdminTitle>{t("admin.locales.title")}</AdminTitle>
        <AdminScope>{t("admin.locales.scope", { count: rows.length })}</AdminScope>
      </AdminBar>

      <AdminBody>
        <AdminBlock heading={t("admin.locales.title")} scope={t("admin.locales.invariant")}>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t("admin.locales.emptyTitle")}</p>
              <p className={styles.emptyBody}>{t("admin.locales.emptyBody")}</p>
            </div>
          ) : (
            <LocaleTable rows={rows} setEnabled={setLocaleEnabled} setDefault={setDefaultLocale} />
          )}
        </AdminBlock>

        {pendingRedeploy.length > 0 ? (
          <AdminBlock heading={t("admin.locales.redeployTitle")}>
            <p className={styles.emptyBody}>
              {t("admin.locales.redeployBody", { codes: pendingRedeploy.join(", ") })}
            </p>
          </AdminBlock>
        ) : null}
      </AdminBody>
    </>
  );
}
