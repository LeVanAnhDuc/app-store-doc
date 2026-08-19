"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { formatBytes, mediaLabel, type MediaItem } from "./media";
import { UploadDropzone } from "./UploadDropzone";
import styles from "./MediaLibrary.module.css";

/**
 * Thư viện ảnh — mockup màn 05: vùng kéo-thả là ô đầu tiên của lưới, ảnh xếp
 * tiếp sau, mỗi ô có tên tệp, kích thước và dung lượng.
 *
 * Ảnh **không** gắn cứng vào một ứng dụng: sơ đồ kiến trúc xuất hiện lại ở nhiều
 * trang hướng dẫn, nên một thư viện dùng chung là đúng mô hình (ghi chú của mockup).
 *
 * Kích thước điểm ảnh chỉ hiện khi biết. `uploadImage` nay đo rộng × cao từ header
 * ảnh (`readImageDimensions`), nên ảnh tải qua CMS thường có đủ số đo như mockup vẽ:
 * "1600×900 · 84 KB". Nhưng phép đo **được phép thất bại mà không chặn lượt tải** —
 * định dạng lạ thì `width`/`height` vẫn `null`. Khi đó hiện mỗi dung lượng: đúng
 * phần biết chắc, không bịa số đo.
 */
export type MediaLibraryProps = {
  items: MediaItem[];
  /** Trần dung lượng thật, lấy từ `MAX_IMAGE_BYTES` của tầng lưu ảnh. */
  maxBytes: number;
  /** Kiểu MIME tầng lưu ảnh nhận. */
  accept: readonly string[];
  upload: (formData: FormData) => Promise<unknown>;
  remove: (input: { id: string }) => Promise<void>;
  /**
   * Ẩn vùng kéo-thả khi kho ảnh chưa cấu hình được. Hiện một vùng bấm được mà
   * upload chắc chắn đổ là nói dối về hiện trạng — trang gọi tự kiểm bằng
   * `missingR2Env()` rồi nói rõ thiếu biến nào.
   */
  uploadDisabled?: boolean;
};

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MediaLibrary({
  items,
  maxBytes,
  accept,
  upload,
  remove,
  uploadDisabled = false,
}: MediaLibraryProps) {
  const t = useTranslations();
  const router = useRouter();

  const [query, setQuery] = useState("");
  /** Ảnh đang chờ xác nhận xoá. Xoá ảnh là việc không hoàn lại được. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter((item) => mediaLabel(item).toLowerCase().includes(needle))
    : items;

  function onDelete(item: MediaItem) {
    setNotice(null);
    setConfirming(null);

    startTransition(async () => {
      try {
        await remove({ id: item.id });
        setNotice({ tone: "ok", text: t("admin.media.deleted", { name: mediaLabel(item) }) });
        router.refresh();
      } catch (error) {
        setNotice({
          tone: "error",
          text: t("admin.media.deleteFailed", { reason: reasonOf(error) }),
        });
      }
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tools}>
        <label className={styles.searchLabel} htmlFor="media-search">
          {t("admin.media.searchLabel")}
        </label>
        <input
          className={styles.search}
          id="media-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("admin.media.searchPlaceholder")}
        />
      </div>

      <div className={styles.grid}>
        {uploadDisabled ? null : (
          <UploadDropzone
            upload={upload}
            maxBytes={maxBytes}
            accept={accept}
            onUploaded={() => router.refresh()}
          />
        )}

        {shown.map((item) => {
          const label = mediaLabel(item);
          const size = item.width && item.height ? `${item.width}×${item.height} · ` : "";

          return (
            <figure className={styles.thumb} key={item.id}>
              {/* `next/image` cần khai trước tên miền, mà tên miền R2 nằm trong
                  biến môi trường lúc chạy — thẻ img thường là thứ đúng ở đây. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.image} src={item.url} alt={item.alt ?? ""} loading="lazy" />

              <figcaption className={styles.meta}>
                <b className={styles.name} title={label}>
                  {label}
                </b>
                <span className={styles.size}>
                  {size}
                  {formatBytes(item.sizeBytes)}
                </span>

                <div className={styles.actions}>
                  {confirming === item.id ? (
                    <>
                      <button
                        className={styles.danger}
                        type="button"
                        onClick={() => onDelete(item)}
                        disabled={pending}
                      >
                        {t("admin.media.deleteConfirm")}
                      </button>
                      <button
                        className={styles.action}
                        type="button"
                        onClick={() => setConfirming(null)}
                      >
                        {t("admin.media.deleteCancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.action}
                      type="button"
                      onClick={() => setConfirming(item.id)}
                      disabled={pending}
                    >
                      {t("admin.media.delete")}
                      <span className={styles.srOnly}> {label}</span>
                    </button>
                  )}
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {items.length > 0 && shown.length === 0 ? (
        <p className={styles.hint}>{t("admin.media.searchEmpty", { query: query.trim() })}</p>
      ) : null}

      {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
      <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
        {notice?.text ?? ""}
      </p>
    </div>
  );
}
