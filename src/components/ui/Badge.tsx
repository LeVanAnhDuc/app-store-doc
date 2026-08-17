import type { ReactNode } from "react";
import styles from "./Badge.module.css";

/** Năm trạng thái tích hợp dùng chung toàn site — xem design-rules §2. */
export type StatusKind = "core" | "connected" | "planned" | "standalone" | "private";

export type BadgeProps = {
  kind: StatusKind;
  children: ReactNode;
  className?: string;
};

/**
 * Huy hiệu trạng thái. Màu do CSS chọn qua `[data-kind]`, component không
 * biết mã màu nào — đổi màu trạng thái chỉ sửa `tokens.css`.
 */
export function Badge({ kind, children, className }: BadgeProps) {
  return (
    <span className={className ? `${styles.badge} ${className}` : styles.badge} data-kind={kind}>
      {children}
    </span>
  );
}
