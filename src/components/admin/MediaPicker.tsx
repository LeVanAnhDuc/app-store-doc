"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { formatBytes, mediaLabel, type MediaItem } from "./media";
import styles from "./MediaPicker.module.css";

export type MediaPickerProps = {
  /** Server action liệt kê ảnh. Gọi khi mở, không gọi lúc render trang. */
  listMedia: () => Promise<MediaItem[]>;
  onPick: (item: MediaItem) => void;
  /** Nhãn nút mở; mặc định là "Ảnh". */
  label?: string;
};

/**
 * Nút mở bảng chọn ảnh — dùng ở ô soạn markdown (chèn `![alt](url)`) và ở ô
 * `logoUrl` của khối Thông tin chung.
 *
 * Danh sách ảnh nạp **khi mở**, không nạp sẵn cùng trang: trang soạn nội dung có
 * thể mở cả chục ô soạn markdown, và nạp trước cho từng ô là hàng chục lần đọc DB
 * cho một bảng mà người soạn có thể không mở lần nào.
 *
 * Bảng chọn dựng bằng `position: fixed` chứ không phải khối buông xuống dưới nút.
 * Lý do là kỹ thuật, không phải thẩm mỹ: cả `.block` của khung quản trị lẫn `.wrap`
 * của ô soạn markdown đều có `overflow: hidden` (để bo góc ăn với nền tiêu đề), nên
 * một khối `position: absolute` bên trong chúng sẽ **bị cắt** đúng lúc nút nằm gần
 * đáy khối. Thả trong luồng thì lại đẩy cả thanh công cụ giãn ra và làm trang cuộn
 * ngang ở 375px. `fixed` không bị cắt bởi ancestor nào và không chiếm chỗ trong bố cục.
 */
export function MediaPicker({ listMedia, onPick, label }: MediaPickerProps) {
  const t = useTranslations();

  // Trang soạn nội dung có thể mở nhiều bộ chọn cùng lúc (mỗi mục một cái), nên
  // id của bảng phải là duy nhất — `aria-controls` trùng id thì trình đọc màn hình
  // trỏ sai bảng.
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement | null>(null);

  // Esc đóng bảng. Người dùng bàn phím mở ra rồi không có cách đóng nào khác
  // ngoài Tab qua hết danh sách ảnh.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Tiêu điểm đi theo bảng vừa mở: không thế thì người dùng bàn phím phải Tab qua
  // hết phần còn lại của trang mới tới được danh sách ảnh.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    setError(null);
    // Nạp lại mỗi lần mở: ảnh vừa tải lên ở tab khác phải thấy ngay.
    startTransition(async () => {
      try {
        setItems(await listMedia());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  }

  return (
    <div className={styles.wrap}>
      <button
        className={styles.trigger}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {label ?? t("admin.media.pick")}
      </button>

      {open ? (
        <>
          {/* Bấm ra ngoài là đóng. Không phải lớp chặn thao tác: nó chỉ tối nhẹ
              phần còn lại để mắt biết đâu là chỗ đang chờ chọn. */}
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            className={styles.panel}
            id={panelId}
            ref={panel}
            role="dialog"
            aria-label={t("admin.media.pickTitle")}
            tabIndex={-1}
          >
            <div className={styles.head}>
              <span className={styles.title}>{t("admin.media.pickTitle")}</span>
              <button className={styles.close} type="button" onClick={() => setOpen(false)}>
                {t("admin.media.close")}
              </button>
            </div>

            {error ? (
              <p className={styles.error}>{t("admin.media.listFailed", { reason: error })}</p>
            ) : pending || items === null ? (
              <p className={styles.hint}>{t("admin.media.loading")}</p>
            ) : items.length === 0 ? (
              <p className={styles.hint}>{t("admin.media.pickEmpty")}</p>
            ) : (
              <ul className={styles.grid}>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      className={styles.item}
                      type="button"
                      onClick={() => {
                        onPick(item);
                        setOpen(false);
                      }}
                    >
                      {/* `next/image` cần khai trước tên miền, mà tên miền R2 nằm
                          trong biến môi trường lúc chạy — thẻ img thường là thứ
                          đúng ở đây. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.thumb} src={item.url} alt="" loading="lazy" />
                      <span className={styles.name}>{mediaLabel(item)}</span>
                      <span className={styles.meta}>{formatBytes(item.sizeBytes)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
