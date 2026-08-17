import styles from "./Sidebar.module.css";

export type SidebarItem = {
  /** Khoá ổn định cho React, không hiện ra giao diện. */
  key: string;
  href: string;
  label: string;
};

export type SidebarGroup = {
  key: string;
  /** Tên nhóm; `null` là nhóm không tên (không dựng tiêu đề nhóm). */
  label: string | null;
  items: SidebarItem[];
};

export type SidebarProps = {
  groups: SidebarGroup[];
  /** Đường dẫn trang đang mở, để đánh dấu `aria-current`. */
  currentHref?: string;
  /** Tên gọi của vùng điều hướng, đã dịch. */
  label: string;
};

/**
 * Cột điều hướng trái của trang tài liệu (mockup màn 02 và 03).
 *
 * Nhận sẵn danh sách đã dựng thay vì tự truy vấn: trang ứng dụng gộp ứng dụng
 * lõi, ứng dụng vệ tinh và trang hướng dẫn vào cùng một cột, còn trang hướng
 * dẫn chỉ có các nhóm tài liệu. Cùng một component, hai cách gộp.
 *
 * Không nhóm nào thì không dựng gì cả — cột trống có viền phải chỉ trông như
 * giao diện hỏng.
 */
export function Sidebar({ groups, currentHref, label }: SidebarProps) {
  const visible = groups.filter((group) => group.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <nav className={styles.side} aria-label={label}>
      {visible.map((group) => (
        <div className={styles.group} key={group.key}>
          {group.label ? <p className={styles.heading}>{group.label}</p> : null}
          <ul className={styles.list}>
            {group.items.map((item) => (
              <li key={item.key}>
                <a
                  className={styles.link}
                  href={item.href}
                  // Trang đang mở đánh dấu bằng aria-current; màu chỉ là hệ quả.
                  aria-current={item.href === currentHref ? "page" : undefined}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
