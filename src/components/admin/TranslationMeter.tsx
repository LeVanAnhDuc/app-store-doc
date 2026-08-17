import styles from "./TranslationMeter.module.css";

export type TranslationMeterProps = {
  /** Mã ngôn ngữ đang đo, ví dụ `"en"`. Hiện ra dạng chữ hoa. */
  locale: string;
  /** Số mục đã có bản dịch ở `locale`. */
  done: number;
  /** Tổng số mục cần dịch: khối metadata + từng tính năng + từng mục nội dung. */
  total: number;
  /**
   * Câu cảnh báo, **đã dịch và đã điền số**. Vắng mặt thì dùng câu tiếng Việt
   * của mockup — `vi` là locale mặc định của site.
   *
   * Component không tự gọi `useTranslations` vì nó phải render được ngoài
   * `NextIntlClientProvider` (xem test cùng thư mục), và vì mọi component trình
   * bày khác trong dự án cũng nhận nhãn qua props (`AppHero`, `SectionBody`).
   */
  label?: string;
  /** Câu cho trạng thái đủ bản dịch. */
  completeLabel?: string;
};

/**
 * Chỉ báo độ hoàn thiện bản dịch, đặt **ngay cạnh nút chuyển ngôn ngữ**
 * (spec §8.2.2, mockup màn 04 `.m-trans`).
 *
 * Với nội dung song ngữ bắt buộc, việc khó nhất không phải là dịch mà là *biết
 * mình còn thiếu gì*. Vì vậy con số nằm ở chỗ dễ thấy nhất của trang soạn thảo,
 * không nằm trong một trang báo cáo riêng.
 *
 * Câu chữ giữ **nguyên văn mockup**: `EN thiếu 3/8 mục`, trong đó `3/8` là số
 * mục đã có bản dịch trên tổng số mục. Đọc kỹ thì "thiếu 3/8" hơi tối nghĩa,
 * nhưng mockup là bản đã duyệt và design-rules nói mockup thắng khi mâu thuẫn —
 * sửa mockup cho khớp tài liệu là làm ngược. Ai đổi câu này thì đổi ở
 * `admin.editor.meter*` trong cả `vi.json` lẫn `en.json`.
 *
 * Đủ bản dịch thì **không** cảnh báo: thêm một dòng "đã đủ" vào mọi trang chỉ
 * làm loãng chỗ đáng chú ý.
 */
export function TranslationMeter({
  locale,
  done,
  total,
  label,
  completeLabel,
}: TranslationMeterProps) {
  const code = locale.toUpperCase();
  const complete = done >= total;

  if (complete) {
    return (
      <span className={styles.meter} data-tone="ok">
        {completeLabel ?? `${code} đủ bản dịch`}
      </span>
    );
  }

  return (
    // `role="alert"` chứ không phải `status`: người dùng bàn phím vừa đổi ngôn
    // ngữ cần biết ngay là bản này còn dở, không phải tự đi tìm con số.
    <span className={styles.meter} data-tone="warn" role="alert">
      {label ?? `${code} thiếu ${done}/${total} mục`}
    </span>
  );
}
