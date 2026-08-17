import styles from "./FallbackNotice.module.css";

export type FallbackNoticeProps = {
  /** Ngôn ngữ thật của nội dung đang hiện. */
  shownLocale: string;
  /** Ngôn ngữ người đọc đang yêu cầu (locale của đường dẫn). */
  wantedLocale: string;
  /** Câu thông báo, đã dịch. */
  label: string;
};

/**
 * Ghi chú "đang đọc bản ngôn ngữ khác".
 *
 * Đặt cạnh **từng** mục và **từng** tính năng chứ không phải một lần ở đầu
 * trang: bản dịch hoàn thiện không đều, nên một trang có thể vừa có mục đã dịch
 * vừa có mục chưa. Báo ở đầu trang sẽ nói sai về phần lớn nội dung bên dưới.
 *
 * Đúng ngôn ngữ thì không dựng gì cả — thêm một dòng "bản dịch đầy đủ" vào mọi
 * mục chỉ làm loãng trang.
 */
export function FallbackNotice({ shownLocale, wantedLocale, label }: FallbackNoticeProps) {
  if (shownLocale === wantedLocale) return null;

  return (
    // Không đặt `lang` ở đây: câu thông báo viết bằng ngôn ngữ người đọc chọn,
    // chỉ phần nội dung bên dưới mới thuộc `shownLocale`.
    <p className={styles.notice}>
      {/* Mã ngôn ngữ là dấu hiệu nhìn, câu chữ bên cạnh mới là nội dung —
          trình đọc màn hình chỉ cần đọc câu. */}
      <span className={styles.code} aria-hidden="true">
        {shownLocale}
      </span>
      <span className={styles.label}>{label}</span>
    </p>
  );
}
