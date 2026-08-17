import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppEditor } from "@/components/admin/AppEditor";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { getAppForEditor } from "@/server/content/queries";
import { renderMarkdownPreview, saveApp, saveFeatures, saveSections } from "../../../actions";

/**
 * `/[locale]/admin/apps/[id]` — trang soạn nội dung một ứng dụng (mockup màn 04).
 *
 * Trang chỉ làm ba việc: đọc dữ liệu thô, dựng liên kết xem thử, rồi trao bốn
 * server action cho `AppEditor`. Toàn bộ tương tác nằm trong client component,
 * còn Prisma và biến môi trường không bao giờ đi qua ranh giới đó.
 *
 * `[id]` nhận **id hoặc slug**: bảng danh sách liên kết bằng slug vì đó là thứ
 * đọc được trên URL, còn tầng ghi định danh bằng `id` để slug đổi được.
 */

type PageParams = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, app] = await Promise.all([getTranslations({ locale }), getAppForEditor(id)]);

  // Tiêu đề tab: dùng tên hiển thị khi có. Chưa có tên ở ngôn ngữ này thì đành
  // lấy slug — `<title>` không có chỗ cho vai trò phụ, mà mọi app cùng hiện
  // "Chưa có tên" thì người vận hành không phân biệt được hai tab đang mở.
  const label = app ? (app.translations[locale]?.name ?? app.slug) : t("notFound.title");

  return {
    title: `${label} — ${t("admin.apps.title")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminAppEditorPage({ params }: PageParams) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const app = await getAppForEditor(id);
  // Không có ứng dụng đó, hoặc chưa cấu hình `DATABASE_URL`: cả hai đều là 404
  // chứ không phải một trang soạn thảo trống — soạn vào chỗ không tồn tại thì
  // lần bấm Lưu nào cũng đổ.
  if (!app) notFound();

  /**
   * Token xem thử ghép ở **máy chủ**. Nó là `PREVIEW_SECRET`, nên chỉ nằm trong
   * HTML của trang đã qua `requireAdmin()` ở `(protected)/layout.tsx`. Chưa khai
   * biến thì không dựng liên kết: nút mở ra trang 403 còn tệ hơn không có nút.
   */
  const secret = process.env.PREVIEW_SECRET;
  const previewHref = secret
    ? `/${locale}/apps/${app.slug}/preview?token=${encodeURIComponent(secret)}`
    : null;

  return (
    <AppEditor
      locale={locale}
      locales={locales}
      defaultLocale={defaultLocale}
      app={app}
      backHref={`/${locale}/admin/apps`}
      previewHref={previewHref}
      saveApp={saveApp}
      saveFeatures={saveFeatures}
      saveSections={saveSections}
      renderPreview={renderMarkdownPreview}
    />
  );
}
