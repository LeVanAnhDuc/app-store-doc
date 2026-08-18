import styles from "./OrderControls.module.css";

/** Bốn hướng di chuyển một phần tử trong danh sách anh em. */
export type OrderMove = "top" | "up" | "down" | "bottom";

/** Nhãn cho trình đọc màn hình, một nhãn cho mỗi hướng. */
export type OrderControlsLabels = Record<OrderMove, string>;

export type OrderControlsProps = {
  /** Vị trí của phần tử trong danh sách anh em, đếm từ 0. */
  index: number;
  /** Tổng số anh em, kể cả chính nó. */
  total: number;
  onMove: (to: OrderMove) => void;
  /**
   * Nhãn truyền từ ngoài vào, **không** gọi `useTranslations` bên trong:
   * component phải render được trần, không có `NextIntlClientProvider`.
   * Cùng lối với `AppCard` và `AppHero`.
   */
  labels: OrderControlsLabels;
};

/**
 * Bộ bốn nút đổi thứ tự — `⤒ ↑ ↓ ⤓`, hình khối chép từ `.tr-act`/`.tr-b`
 * trong mockup v3 mục 03.
 *
 * Bốn phần tử là `<button>` thật, không phải `<div onClick>`: kéo thả mà
 * không có đường bàn phím thì người chỉ dùng bàn phím bị loại khỏi CMS.
 *
 * Nút không dùng được đặt `disabled` **thật** rồi giảm `opacity` trong CSS —
 * chỉ làm nhạt màu thì vẫn bấm được và vẫn gọi `onMove`.
 */
export function OrderControls({ index, total, onMove, labels }: OrderControlsProps) {
  const atTop = index <= 0;
  const atBottom = index >= total - 1;

  // Ký hiệu và điều kiện vô hiệu đi cùng nhau để không lệch khỏi nhau về sau.
  const buttons: { to: OrderMove; glyph: string; disabled: boolean }[] = [
    { to: "top", glyph: "⤒", disabled: atTop },
    { to: "up", glyph: "↑", disabled: atTop },
    { to: "down", glyph: "↓", disabled: atBottom },
    { to: "bottom", glyph: "⤓", disabled: atBottom },
  ];

  return (
    <span className={styles.group}>
      {buttons.map(({ to, glyph, disabled }) => (
        <button
          key={to}
          type="button"
          className={styles.button}
          aria-label={labels[to]}
          title={labels[to]}
          disabled={disabled}
          onClick={() => onMove(to)}
        >
          {/* Ký hiệu chỉ để mắt nhìn; tên gọi cho trình đọc lấy từ aria-label. */}
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </span>
  );
}
