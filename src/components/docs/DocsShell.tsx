import type { ReactNode } from "react";
import styles from "./DocsShell.module.css";

export type DocsShellProps = {
  /** Cột trái. Bỏ trống thì lưới không chừa chỗ cho nó. */
  sidebar?: ReactNode;
  /** Cột giữa: nội dung bài. */
  main: ReactNode;
  /** Cột phải. Bỏ trống thì lưới không chừa chỗ cho nó. */
  toc?: ReactNode;
};

/**
 * Bố cục ba cột của mọi trang tài liệu: điều hướng · nội dung · mục lục
 * (mockup màn 02 và 03). Dùng chung cho trang ứng dụng lẫn trang hướng dẫn.
 *
 * Số cột do dữ liệu quyết định, không cố định: trang không có mục lục thì lưới
 * chỉ hai cột chứ không chừa một dải trống 178px bên phải. Nơi gọi truyền
 * `undefined` khi không có gì để dựng — `Toc` tự trả `null` khi rỗng, nhưng
 * phần tử vẫn tồn tại trong cây nên lưới không tự biết điều đó.
 *
 * Tới 980px cả ba gập thành một cột: mục lục lên đầu bài, điều hướng xuống cuối
 * trang (design-rules §9, mockup màn 07).
 */
export function DocsShell({ sidebar, main, toc }: DocsShellProps) {
  return (
    <div
      className={styles.shell}
      data-sidebar={sidebar ? "yes" : "no"}
      data-toc={toc ? "yes" : "no"}
    >
      {sidebar ? <div className={styles.sidebarSlot}>{sidebar}</div> : null}
      <div className={styles.mainSlot}>{main}</div>
      {toc ? <div className={styles.tocSlot}>{toc}</div> : null}
    </div>
  );
}
