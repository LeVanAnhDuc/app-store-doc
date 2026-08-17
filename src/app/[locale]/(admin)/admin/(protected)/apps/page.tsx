import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AdminBar,
  AdminBlock,
  AdminBody,
  AdminScope,
  AdminTitle,
} from "@/components/admin/AdminShell";
import { AppsTable } from "@/components/admin/AppsTable";
import { listAppsForAdmin } from "@/server/content/queries";
import { reorderApps, setAppStatus } from "../../actions";

/**
 * `/[locale]/admin/apps` — bảng danh sách ứng dụng.
 *
 * Trang chỉ đọc dữ liệu rồi trao hai server action cho bảng. Bảng là client
 * component nên nó không thấy tầng nội dung, mà tầng nội dung cũng không thấy
 * tầng auth: mỗi lớp chỉ biết đúng lớp kế bên.
 */

type PageParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.apps.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminAppsPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const apps = await listAppsForAdmin(locale);

  return (
    <>
      <AdminBar>
        <AdminTitle>{t("admin.apps.title")}</AdminTitle>
        <AdminScope>{t("admin.apps.scope", { count: apps.length })}</AdminScope>
      </AdminBar>

      <AdminBody>
        <AdminBlock heading={t("admin.apps.title")}>
          <AppsTable rows={apps} setStatus={setAppStatus} reorder={reorderApps} />
        </AdminBlock>
      </AdminBody>
    </>
  );
}
