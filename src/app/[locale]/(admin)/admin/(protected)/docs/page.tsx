import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AdminBar,
  AdminBlock,
  AdminBody,
  AdminScope,
  AdminTitle,
} from "@/components/admin/AdminShell";
import { Badge, type StatusKind } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { listDocPagesForAdmin, type Status } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * `/[locale]/admin/docs` — danh sách trang hướng dẫn.
 *
 * Không có nút bật/tắt công khai và không kéo thả ở đây: trạng thái và thứ tự của
 * một trang hướng dẫn nằm trong khối Thông tin chung của chính trang soạn thảo,
 * nên thêm lối thứ hai chỉ tạo thêm một chỗ để hai con số lệch nhau. Bảng ứng dụng
 * có nút bật/tắt vì ở đó nó là việc làm hàng ngày trên nhiều bản ghi một lúc.
 *
 * Trang chủ (`slug = "home"`) **có** trong danh sách vì nó là một bản ghi thật mà
 * người vận hành phải thấy. Cột địa chỉ để trống chỗ URL và ghi `home`: route
 * `/[locale]/docs/home` cố tình 404, còn trang chủ `/[locale]` hiện dựng từ chuỗi
 * giao diện chứ chưa kết xuất bản ghi này. Trang soạn nói rõ điều đó thay vì dựng
 * một liên kết dẫn tới chỗ không có nội dung.
 */

type PageParams = { params: Promise<{ locale: string }> };

const STATUS_KIND: Record<Status, StatusKind> = {
  DRAFT: "planned",
  PUBLISHED: "connected",
  ARCHIVED: "private",
};

const STATUS_LABEL_KEY: Record<Status, string> = {
  DRAFT: "admin.publishState.draft",
  PUBLISHED: "admin.publishState.published",
  ARCHIVED: "admin.publishState.archived",
};

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.docs.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminDocsPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const pages = await listDocPagesForAdmin(locale);

  return (
    <>
      <AdminBar>
        <AdminTitle>{t("admin.docs.title")}</AdminTitle>
        <AdminScope>{t("admin.docs.scope", { count: pages.length })}</AdminScope>
      </AdminBar>

      <AdminBody>
        <AdminBlock heading={t("admin.docs.title")} scope={t("admin.docs.editHint")}>
          {pages.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{t("admin.docs.emptyTitle")}</p>
              <p className={styles.emptyBody}>{t("admin.docs.emptyBody")}</p>
            </div>
          ) : (
            <DataTable label={t("admin.docs.tableLabel")}>
              <thead>
                <tr>
                  <th scope="col">{t("admin.docs.colTitle")}</th>
                  <th scope="col">{t("admin.docs.colOrder")}</th>
                  <th scope="col">{t("admin.docs.colStatus")}</th>
                  <th scope="col">{t("admin.apps.colTranslations")}</th>
                  <th scope="col">{t("admin.apps.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td>
                      {page.title ? (
                        <span className={styles.name}>{page.title}</span>
                      ) : (
                        <span className={styles.noName}>{t("admin.docs.noTitle")}</span>
                      )}
                      <span className={styles.slug}>
                        {page.isLanding ? page.slug : `/${locale}/docs/${page.slug}`}
                      </span>
                    </td>

                    <td className={styles.number}>{page.order}</td>

                    <td>
                      <Badge kind={STATUS_KIND[page.status]}>
                        {t(STATUS_LABEL_KEY[page.status])}
                      </Badge>
                    </td>

                    <td>
                      {page.missingLocales.length === 0 ? (
                        <span className={styles.complete}>
                          {t("admin.apps.translationsComplete")}
                        </span>
                      ) : (
                        <span className={styles.missing}>
                          {t("admin.missingTranslation")}: {page.missingLocales.join(", ")}
                        </span>
                      )}
                    </td>

                    <td>
                      {/* Liên kết bằng slug: nó là thứ người vận hành đọc được
                          trên URL. Trang soạn thảo nhận cả id lẫn slug. */}
                      <a className={styles.action} href={`/${locale}/admin/docs/${page.slug}`}>
                        {t("admin.apps.edit")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </AdminBlock>
      </AdminBody>
    </>
  );
}
