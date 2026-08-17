import type { TocItem } from "@/server/content/queries";
import styles from "./Toc.module.css";

export type TocProps = {
  /** Mục lục đã dựng sẵn ở tầng dữ liệu; anchor đã được kiểm không trùng. */
  items: TocItem[];
  /** Tiêu đề khối, đã dịch. Ví dụ "Trong trang". */
  title: string;
};

/**
 * Mục lục trong trang — cột phải ở màn rộng, khối gập ở đầu bài trên điện thoại
 * (mockup màn 02 và màn 07).
 *
 * Hai quyết định đáng ghi lại:
 *
 * 1. **Không mục nào thì không dựng gì cả.** Khung rỗng kèm tiêu đề "Trong
 *    trang" trông như mục lục hỏng chứ không như trang ngắn.
 * 2. **`<details open>` chứ không phải hai bản sao cho hai khổ màn.** Cùng một
 *    danh sách liên kết dùng cho cả hai bố cục, nên không có chuyện bản này có
 *    mục mà bản kia thiếu. Mặc định mở: người đọc thấy ngay cấu trúc bài, và
 *    trang vẫn dùng được khi JavaScript chưa tải.
 */
export function Toc({ items, title }: TocProps) {
  if (items.length === 0) return null;

  return (
    <nav className={styles.toc} aria-label={title}>
      <details className={styles.box} open>
        <summary className={styles.summary}>{title}</summary>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.anchor}>
              <a className={styles.link} href={`#${item.anchor}`}>
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
