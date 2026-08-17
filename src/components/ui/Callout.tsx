import type { ReactNode } from "react";
import styles from "./Callout.module.css";

export type CalloutTone = "note" | "warning";

export type CalloutProps = {
  tone?: CalloutTone;
  /** Nhãn ngắn ở đầu khối, ví dụ "Lưu ý" hoặc "Trạng thái". */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Khối ghi chú. Dùng `tone="warning"` khi trang mô tả thứ chưa tồn tại —
 * design-rules §7 bắt buộc nói thật về hiện trạng.
 */
export function Callout({ tone = "note", title, children, className }: CalloutProps) {
  return (
    <aside
      className={className ? `${styles.callout} ${className}` : styles.callout}
      data-tone={tone}
    >
      {title ? <strong className={styles.title}>{title}</strong> : null}
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
