import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { defaultLocale, locales } from "@/i18n/locales.generated";
import { getDocPageForEditor } from "@/server/content/queries";
import {
  listMedia,
  renderMarkdownPreview,
  saveDocPage,
  saveSections,
} from "../../../actions";
import { DocPageEditor } from "./DocPageEditor";

/**
 * `/[locale]/admin/docs/[id]` — trang soạn một trang hướng dẫn.
 *
 * Cùng khuôn với `/admin/apps/[id]`: đọc dữ liệu thô ở máy chủ, rồi trao server
 * action cho client component. `[id]` nhận **id hoặc slug**, vì bảng danh sách liên
 * kết bằng slug (thứ đọc được trên URL) còn tầng ghi định danh bằng `id` để slug
 * đổi được.
 *
 * Không có nút "Xem thử" như trang ứng dụng: chế độ xem thử bản nháp hiện chỉ dựng
 * cho ứng dụng (spec §8.4). Thay vào đó là liên kết mở trang công khai thật, và nó
 * chỉ có nội dung khi trang đã publish — đúng hiện trạng, không hứa quá.
 */

type PageParams = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, id } = await params;
  const [t, page] = await Promise.all([getTranslations({ locale }), getDocPageForEditor(id)]);

  // Tiêu đề tab: dùng tiêu đề thật khi có. Chưa có ở ngôn ngữ này thì đành lấy
  // slug — mọi tab cùng hiện "Chưa có tiêu đề" thì không phân biệt được nhau.
  const label = page ? (page.translations[locale]?.title ?? page.slug) : t("notFound.title");

  return {
    title: `${label} — ${t("admin.docs.title")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminDocPageEditorPage({ params }: PageParams) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const page = await getDocPageForEditor(id);
  // Không có trang đó, hoặc chưa cấu hình `DATABASE_URL`: cả hai đều là 404 chứ
  // không phải một trang soạn thảo trống — soạn vào chỗ không tồn tại thì lần bấm
  // Lưu nào cũng đổ.
  if (!page) notFound();

  return (
    <DocPageEditor
      locale={locale}
      locales={locales}
      defaultLocale={defaultLocale}
      page={page}
      backHref={`/${locale}/admin/docs`}
      saveDocPage={saveDocPage}
      saveSections={saveSections}
      renderPreview={renderMarkdownPreview}
      listMedia={listMedia}
    />
  );
}
