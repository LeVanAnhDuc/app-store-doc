"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import type { NavTreeNode } from "@/server/content/nav";
import { NavTree } from "./NavTree";
import styles from "./NavDrawer.module.css";

export type NavDrawerLabels = {
  /** Chữ trên nút mở, cũng là tên gọi của hộp thoại. */
  open: string;
  /** Chữ trên nút đóng bên trong ngăn kéo. */
  close: string;
};

export type NavDrawerProps = {
  /** Đúng những nút mà cột trái dựng — cùng một nhánh, cùng một cây. */
  nodes: NavTreeNode[];
  /** Đường dẫn trang đang mở, để đánh dấu mục đang xem. */
  activeHref: string;
  /**
   * Nhãn đã dịch. Mặc định tiếng Việt để component render được **trần** trong
   * test, không cần provider của next-intl (quy ước như `ThemeToggle`).
   */
  labels?: Partial<NavDrawerLabels>;
};

const DEFAULT_LABELS: NavDrawerLabels = {
  open: "Điều hướng tài liệu",
  close: "Đóng",
};

/** Mọi thứ bấm/tab tới được bên trong ngăn kéo, theo đúng thứ tự DOM. */
function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

/**
 * Ngăn kéo điều hướng của màn hẹp (mockup v2 mục 07 — "Trên điện thoại").
 *
 * Ở màn rộng cột trái luôn hiện, nên **nút này ẩn hoàn toàn** bằng CSS. Dưới
 * 980px cột trái biến mất và chỗ của nó là nút `☰` đặt ngay đầu bài. Bản trước
 * đẩy cột trái xuống **cuối trang**: người đọc trên điện thoại phải cuộn hết bài
 * mới thấy điều hướng, tức là coi như không có điều hướng.
 *
 * Cây bên trong là **chính `NavTree`** mà cột trái dùng, không phải một cây thứ
 * hai: hai bản cây rồi sẽ lệch nhau ở lần sửa thứ ba.
 *
 * Ba việc của một hộp thoại thật, làm giống hệt `SearchDialog`:
 *
 * - `Esc` và bấm ra ngoài đều đóng;
 * - đóng xong **trả tiêu điểm về nút mở**, nếu không người dùng bàn phím rơi về
 *   `<body>` và mất chỗ đứng;
 * - **bẫy tiêu điểm** khi đang mở — `Tab` ở phần tử cuối vòng về phần tử đầu.
 *   Không có bẫy thì Tab đi thẳng ra sau lưng lớp phủ, tới những liên kết mắt
 *   không nhìn thấy.
 */
export function NavDrawer({ nodes, activeHref, labels }: NavDrawerProps) {
  const text = { ...DEFAULT_LABELS, ...labels };

  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Mở tới đâu, tiêu điểm tới đó — nút đóng là điểm vào an toàn nhất, vì nó là
  // đường ra và nằm ngay đầu vòng Tab.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Nền không cuộn khi ngăn kéo đang mở: cuộn được cả hai lớp thì ngón tay kéo
  // trúng lớp nào là chuyện may rủi.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /** Vòng tiêu điểm khép kín trong panel. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }

    if (event.key !== "Tab") return;

    const items = focusablesIn(panelRef.current);
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Không có nút nào thì không có gì để mở — nút `☰` dẫn tới một ngăn kéo rỗng
  // còn tệ hơn là không có nút.
  if (nodes.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {/* `☰` là ký hiệu chữ (U+2630), không phải emoji — design-rules §5. */}
        <span className={styles.icon} aria-hidden="true">
          ☰
        </span>
        <span className={styles.label}>{text.open}</span>
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={text.open}
            onKeyDown={onKeyDown}
          >
            <div className={styles.head}>
              <p className={styles.title}>{text.open}</p>
              <button ref={closeRef} type="button" className={styles.close} onClick={close}>
                {text.close}
              </button>
            </div>

            <div className={styles.body}>
              <NavTree nodes={nodes} activeHref={activeHref} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
