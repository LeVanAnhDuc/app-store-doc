"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

import styles from "./SortableList.module.css";

/** Một dòng trong danh sách sắp xếp được. */
export type SortableItem = {
  id: string;
  /** Tên hiển thị, đồng thời là tên gọi của tay cầm kéo. */
  label: string;
  /** Chữ mono phụ cạnh nhãn — anchor của mục nội dung, ví dụ `#quick-start`. */
  meta?: string;
  /** Ghi chú ngắn bên phải, ví dụ "Thiếu bản EN". */
  note?: string;
  /** Khối soạn thảo mở ra dưới dòng. Có `detail` thì dòng có nút mở/đóng. */
  detail?: ReactNode;
};

/** Chuỗi giao diện của danh sách. Vắng mặt thì dùng tiếng Việt (locale mặc định). */
export type SortableListLabels = {
  /** Ghép trước tên mục cho tay cầm kéo: "Sắp xếp {label}". */
  handle: string;
  /** Câu hướng dẫn cho người dùng bàn phím, đọc kèm tay cầm. */
  handleHint: string;
  /** Ghép trước tên mục cho nút xoá: "Xoá {label}". */
  remove: string;
  /** Ghép trước tên mục cho nút mở khối soạn thảo. */
  expand: string;
  /** Ghép trước tên mục cho nút đóng khối soạn thảo. */
  collapse: string;
};

const DEFAULT_LABELS: SortableListLabels = {
  handle: "Sắp xếp",
  handleHint: "Dùng mũi tên lên xuống để đổi chỗ.",
  remove: "Xoá",
  expand: "Mở khối soạn",
  collapse: "Đóng khối soạn",
};

export type SortableListProps = {
  items: SortableItem[];
  /** Nhận danh sách **đầy đủ** id theo thứ tự mới. */
  onReorder: (ids: string[]) => void;
  /** Vắng mặt thì dòng không có nút xoá. */
  onRemove?: (id: string) => void;
  labels?: Partial<SortableListLabels>;
};

/** Chuyển một phần tử từ `from` sang `to`, trả mảng mới. */
function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

/**
 * Danh sách sắp xếp được bằng **cả** chuột và bàn phím (spec §8.2.4).
 *
 * Kéo thả là cách nhanh nhất khi có chuột, nhưng kéo thả *chỉ* bằng chuột thì
 * loại hẳn người dùng bàn phím khỏi việc sắp xếp nội dung — mà thứ tự trong CMS
 * chính là thứ tự hiển thị thật. Vì vậy tay cầm là một `<button>` thật: nhận
 * được tiêu điểm, có tên gọi, và mũi tên lên/xuống đổi chỗ ngay.
 *
 * Component **không giữ thứ tự trong state**: `items` là nguồn sự thật duy nhất
 * và mỗi lần đổi chỗ gọi `onReorder` với danh sách id đầy đủ. Giữ thêm một bản
 * thứ tự ở đây sẽ lệch với dữ liệu của trang ngay lần lưu thất bại đầu tiên.
 */
export function SortableList({ items, onReorder, onRemove, labels }: SortableListProps) {
  const text = { ...DEFAULT_LABELS, ...labels };

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);

  const handles = useRef(new Map<string, HTMLButtonElement | null>());
  /** Mục vừa được đổi chỗ bằng bàn phím, cần lấy lại tiêu điểm sau khi render. */
  const pendingFocus = useRef<string | null>(null);

  // Sau khi đổi chỗ, dòng cũ không còn ở vị trí cũ nên trình duyệt bỏ tiêu điểm
  // về `<body>`. Không trả tiêu điểm lại thì người dùng bàn phím phải Tab lại từ
  // đầu danh sách sau **mỗi** lần nhấn mũi tên.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    handles.current.get(id)?.focus();
  }, [items]);

  function reorderTo(index: number, target: number, id: string) {
    if (target < 0 || target >= items.length) return;
    pendingFocus.current = id;
    onReorder(move(items, index, target).map((item) => item.id));
  }

  function onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    // Không chặn thì trang cuộn theo mũi tên trong lúc mục đang di chuyển.
    event.preventDefault();
    reorderTo(index, index + (event.key === "ArrowDown" ? 1 : -1), id);
  }

  function onDrop(event: DragEvent<HTMLLIElement>, targetIndex: number) {
    event.preventDefault();
    setOverId(null);

    const from = items.findIndex((item) => item.id === dragId);
    setDragId(null);
    if (from < 0 || from === targetIndex) return;

    onReorder(move(items, from, targetIndex).map((item) => item.id));
  }

  function toggle(id: string) {
    setOpenIds((open) => (open.includes(id) ? open.filter((it) => it !== id) : [...open, id]));
  }

  return (
    <ul className={styles.list}>
      {items.map((item, index) => {
        const open = openIds.includes(item.id);
        const detailId = `sortable-detail-${item.id}`;

        return (
          <li
            key={item.id}
            className={styles.item}
            data-dragging={item.id === dragId ? "true" : undefined}
            data-over={item.id === overId && item.id !== dragId ? "true" : undefined}
            onDragOver={(event) => {
              // Không `preventDefault` thì trình duyệt từ chối vùng thả.
              event.preventDefault();
              setOverId(item.id);
            }}
            onDragLeave={() => setOverId((current) => (current === item.id ? null : current))}
            onDrop={(event) => onDrop(event, index)}
          >
            <div className={styles.row}>
              <button
                className={styles.handle}
                type="button"
                ref={(node) => {
                  handles.current.set(item.id, node);
                }}
                draggable
                onDragStart={(event) => {
                  setDragId(item.id);
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox không bắt đầu kéo nếu dataTransfer trống.
                  event.dataTransfer.setData("text/plain", item.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onKeyDown={(event) => onHandleKeyDown(event, index, item.id)}
                aria-label={`${text.handle} ${item.label}. ${text.handleHint}`}
              >
                {/* Ký hiệu tay cầm là hình, không phải nội dung — tên gọi nằm ở aria-label. */}
                <span aria-hidden="true">⠿</span>
              </button>

              <span className={styles.name}>{item.label}</span>
              {item.meta ? <span className={styles.meta}>{item.meta}</span> : null}

              <div className={styles.right}>
                {item.note ? <span className={styles.note}>{item.note}</span> : null}

                {item.detail === undefined ? null : (
                  <button
                    className={styles.action}
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={open}
                    aria-controls={detailId}
                  >
                    <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                    <span className={styles.srOnly}>
                      {open ? text.collapse : text.expand} {item.label}
                    </span>
                  </button>
                )}

                {onRemove ? (
                  <button
                    className={styles.action}
                    type="button"
                    onClick={() => onRemove(item.id)}
                  >
                    {text.remove} <span className={styles.srOnly}>{item.label}</span>
                  </button>
                ) : null}
              </div>
            </div>

            {item.detail === undefined ? null : (
              <div className={styles.detail} id={detailId} hidden={!open}>
                {item.detail}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
