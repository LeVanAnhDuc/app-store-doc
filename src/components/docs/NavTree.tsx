"use client";

import { useState } from "react";

import { findTrail, type NavTreeNode } from "@/server/content/nav";
import styles from "./NavTree.module.css";

export type NavTreeProps = {
  /** Nút cùng cấp ở tầng ngoài nhất. Rỗng thì không dựng gì cả. */
  nodes: NavTreeNode[];
  /** Đường dẫn trang đang mở, đã kèm tiền tố locale — trùng khít với `href` của lá. */
  activeHref: string;
};

/**
 * Cây điều hướng công khai — hình khối chép từ `.nav-l`/`.nav-i`/`.nav-c`
 * trong mockup v3 mục 02.
 *
 * Hai loại phần tử, cố ý khác thẻ HTML:
 *
 * - **Nút chứa là `<button>`**, không phải liên kết. `CONTAINER` không có URL
 *   riêng (spec §5): bấm vào nó chỉ mở/đóng. Dựng thành `<a href="#">` thì trình
 *   đọc màn hình đọc "liên kết", người dùng bấm và chờ một trang mới không bao
 *   giờ tới, còn Ctrl+click mở một tab trống.
 * - **Nút lá là `<a>`**, không toggle. Nó đi tới đâu đó thật, nên phải mở được
 *   bằng tab mới, copy được địa chỉ, và hiện ra ở thanh trạng thái khi trỏ tới.
 *
 * `aria-expanded` là thứ duy nhất nói cho trình đọc màn hình biết nhánh đang mở
 * hay đóng; mũi `▾ ▸` chỉ dành cho mắt nên để `aria-hidden`.
 */
export function NavTree({ nodes, activeHref }: NavTreeProps) {
  /**
   * Chỉ lưu **những gì người dùng tự bấm**, không lưu toàn bộ trạng thái mở.
   *
   * Trạng thái hiệu dụng = ý người dùng nếu có, còn lại là "nhánh chứa trang đang
   * xem thì mở". Nhờ vậy chuyển sang trang khác trong cùng cây (điều hướng phía
   * client, component không bị dựng lại) vẫn tự mở đúng nhánh mới, mà nhánh người
   * dùng vừa cố tình đóng thì không tự bật lên lại.
   */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const onTrail = new Set(findTrail(nodes, activeHref).map((node) => node.id));

  const toggle = (id: string, expanded: boolean) =>
    setToggled((current) => ({ ...current, [id]: !expanded }));

  if (nodes.length === 0) return null;

  const renderList = (siblings: NavTreeNode[], depth: number, id?: string) => (
    <ul className={styles.list} data-depth={depth} id={id}>
      {siblings.map((node) => {
        if (node.kind !== "CONTAINER") {
          // `href` rỗng ở một lá là dữ liệu mà CHECK constraint đã cấm. Bỏ mục đó
          // đi: một liên kết dẫn tới `undefined` trông như dữ liệu thật.
          if (node.href === null) return null;

          const current = node.href === activeHref;
          return (
            <li key={node.id}>
              <a
                className={styles.item}
                href={node.href}
                // Mục đang xem đánh dấu bằng aria-current; viên nền chỉ là hệ quả.
                aria-current={current ? "page" : undefined}
              >
                <span className={styles.marker} aria-hidden="true" />
                {node.label}
              </a>
            </li>
          );
        }

        const expanded = toggled[node.id] ?? onTrail.has(node.id);
        const listId = `nav-${node.id}`;

        return (
          <li key={node.id}>
            <button
              type="button"
              className={`${styles.item} ${styles.container}`}
              aria-expanded={expanded}
              aria-controls={expanded && node.children.length > 0 ? listId : undefined}
              onClick={() => toggle(node.id, expanded)}
            >
              <span className={styles.marker} aria-hidden="true">
                {expanded ? "▾" : "▸"}
              </span>
              {node.label}
            </button>
            {expanded && node.children.length > 0
              ? renderList(node.children, depth + 1, listId)
              : null}
          </li>
        );
      })}
    </ul>
  );

  return renderList(nodes, 0);
}
