import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export type ChipProps = {
  children: ReactNode;
  className?: string;
};

/** Nhãn phụ trung tính: tên công nghệ, phạm vi quyền, từ khoá. */
export function Chip({ children, className }: ChipProps) {
  return (
    <span className={className ? `${styles.chip} ${className}` : styles.chip}>{children}</span>
  );
}
