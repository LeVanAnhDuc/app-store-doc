import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AdminBar,
  AdminBlock,
  AdminBody,
  AdminScope,
  AdminTitle,
} from "@/components/admin/AdminShell";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { formatBytes } from "@/components/admin/media";
import { hasContentDatabase } from "@/server/content/queries";
import { MAX_IMAGE_BYTES } from "@/server/media";
import { deleteMedia, listMedia, uploadMedia } from "../../actions";
import styles from "./page.module.css";

/**
 * `/[locale]/admin/media` — thư viện ảnh, mockup màn 05.
 *
 * Ảnh **không** gắn vào một ứng dụng cụ thể: sơ đồ kiến trúc xuất hiện lại ở
 * nhiều trang hướng dẫn, nên một thư viện dùng chung là đúng mô hình.
 *
 * Trang đọc `MAX_IMAGE_BYTES` từ tầng lưu ảnh rồi truyền xuống giao diện. Con số
 * chỉ tồn tại **một** chỗ: gõ lại "5 MB" trong chuỗi giao diện nghĩa là đến ngày
 * ai đó đổi trần thật, màn hình vẫn nói con số cũ.
 */

type PageParams = { params: Promise<{ locale: string }> };

/** Kiểu ảnh tầng lưu ảnh nhận — khớp `detectImageMime` trong `src/server/media/mime.ts`. */
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.media.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminMediaPage({ params }: PageParams) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  // Thư viện ảnh là trang quản trị duy nhất **không** trả rỗng khi thiếu
  // `DATABASE_URL`: một thư viện rỗng trông y như thư viện chưa có ảnh, và người
  // vận hành sẽ tải lại ảnh lần nữa mà không hiểu vì sao. Nhưng để `listImages`
  // đổ thì Next trả một trang trắng — cũng không nói được gì. Vậy hỏi trước, rồi
  // nói thẳng thiếu cái gì và sửa thế nào.
  if (!hasContentDatabase()) {
    return (
      <>
        <AdminBar>
          <AdminTitle>{t("admin.media.title")}</AdminTitle>
        </AdminBar>
        <AdminBody>
          <AdminBlock heading={t("admin.media.title")}>
            <p className={styles.notice}>{t("admin.media.noDatabase")}</p>
          </AdminBlock>
        </AdminBody>
      </>
    );
  }

  // Đọc qua đúng action mà bộ chọn ảnh dùng, thay vì gọi `listImages()` rồi tự cắt
  // lại `Media` một lần nữa: hai lối đọc song song thì sớm muộn cũng trả hai hình
  // dạng khác nhau.
  const items = await listMedia();

  const totalBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);

  return (
    <>
      <AdminBar>
        <AdminTitle>{t("admin.media.title")}</AdminTitle>
        <AdminScope>
          {t("admin.media.scope", { count: items.length, size: formatBytes(totalBytes) })}
        </AdminScope>
      </AdminBar>

      <AdminBody>
        <AdminBlock
          heading={t("admin.media.title")}
          scope={t("admin.media.limitScope", { max: formatBytes(MAX_IMAGE_BYTES) })}
        >
          <MediaLibrary
            items={items}
            maxBytes={MAX_IMAGE_BYTES}
            accept={ACCEPTED_MIME}
            upload={uploadMedia}
            remove={deleteMedia}
          />
        </AdminBlock>
      </AdminBody>
    </>
  );
}
