import type { NavTreeNode } from "@/server/content/nav";
import { NavTree } from "./NavTree";
import styles from "./Sidebar.module.css";

export type SidebarProps = {
  /**
   * Con cháu của tab đang mở (mockup v3 mục 02). Nơi gọi lấy bằng
   * `findTrail(tree, activeHref)[0]?.children` — nút gốc là dải tab trên cùng
   * nên nó không lặp lại ở đây.
   */
  nodes: NavTreeNode[];
  /** Đường dẫn trang đang mở, để đánh dấu mục đang xem. */
  activeHref: string;
  /** Tên gọi của vùng điều hướng, đã dịch. */
  label: string;
};

/**
 * Cột điều hướng trái của trang tài liệu (mockup v3 mục 02).
 *
 * Chỉ còn là cái vỏ: một `<nav>` có tên gọi, bên trong là `NavTree`. Trước đây
 * component này nhận `groups` phẳng và nơi gọi tự viết cứng hai nhóm "Lõi" và
 * "Ứng dụng vệ tinh"; giờ cấu trúc do CMS quản trong `NavNode` nên không chỗ nào
 * trong mã còn biết tên nhóm nào cả.
 *
 * Không có nút nào thì không dựng gì — cột trống có viền phải chỉ trông như giao
 * diện hỏng. Đó cũng là đường đi khi chưa có DB hoặc trang chưa được gắn vào cây.
 */
export function Sidebar({ nodes, activeHref, label }: SidebarProps) {
  if (nodes.length === 0) return null;

  return (
    <nav className={styles.side} aria-label={label}>
      <NavTree nodes={nodes} activeHref={activeHref} />
    </nav>
  );
}
