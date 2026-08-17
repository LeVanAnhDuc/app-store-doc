import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export type DataTableProps = {
  /** Nội dung bảng: `<caption>`, `<thead>`, `<tbody>`. */
  children: ReactNode;
  /** Tên gọi của hộp cuộn, dùng làm accessible name. */
  label?: string;
  className?: string;
};

/** Bảng dữ liệu, luôn nằm trong hộp cuộn ngang riêng. */
export function DataTable({ children, label = "Bảng dữ liệu", className }: DataTableProps) {
  return (
    <div
      className={className ? `${styles.scroll} ${className}` : styles.scroll}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className={styles.table}>{children}</table>
    </div>
  );
}
