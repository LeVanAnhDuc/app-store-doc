"use client";

import { OrderControls, type OrderMove } from "@/components/ui/OrderControls";

import type { NavEditorKind, NavEditorLabels, NavEditorNode } from "./NavEditor";
import styles from "./NavNodeRow.module.css";

/**
 * Tên loại nút cho mắt người đọc. Khai ở đây chứ không ở `NavEditor` để đồ thị
 * import chỉ chạy một chiều: `NavEditor` nạp `NavNodeRow` lúc chạy, còn
 * `NavNodeRow` chỉ mượn *kiểu* của `NavEditor` — `import type` bị xoá khi biên
 * dịch nên không thành vòng.
 */
export function navKindLabel(kind: NavEditorKind, labels: NavEditorLabels): string {
  if (kind === "APP") return labels.kindApp;
  if (kind === "DOC") return labels.kindDoc;
  return labels.kindContainer;
}

export type NavNodeRowProps = {
  node: NavEditorNode;
  /** Tên hiển thị đã lo sẵn phần thiếu nhãn — hàng không tự bịa từ id. */
  name: string;
  /** Số con trực tiếp; nút chứa mà 0 con thì hàng nói ra là chưa publish được. */
  childCount: number;
  /** Vị trí trong danh sách anh em và tổng số anh em, cho bộ nút thứ tự. */
  index: number;
  total: number;
  selected: boolean;
  /** Nút gốc — dải tab trên cùng, nền chìm như `.tr-row.root` của mockup. */
  isRoot: boolean;
  /** Có con nhưng nhánh đang thu lại. */
  collapsed: boolean;
  /** Mục đang được kéo sẽ thả được vào nút này (chỉ nút chứa). */
  dropTarget: boolean;
  labels: NavEditorLabels;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (to: OrderMove) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropInto: () => void;
};

/**
 * Một hàng trong trình soạn cây — `.tr-row` của mockup v3 mục 03.
 *
 * Hàng **không** bọc nhánh con: `data-nav-row` phải trỏ đúng một nút để
 * `within(row(id))` trong test — và người đọc mã sau này — không bắt trọn cả
 * nhánh. Danh sách con là phần tử em của hàng, cùng nằm trong `<li>`.
 *
 * Mockup vẽ hai hành động cuối bằng emoji `✎ 🗑`. Đó là mâu thuẫn trong chính
 * mockup: design-rules §5 cấm emoji làm ký hiệu, và emoji còn đọc thành tên
 * khác nhau trên mỗi hệ điều hành. Dùng chữ "Sửa"/"Xoá" — có test canh.
 */
export function NavNodeRow({
  node,
  name,
  childCount,
  index,
  total,
  selected,
  isRoot,
  collapsed,
  dropTarget,
  labels,
  onSelect,
  onRemove,
  onMove,
  onDragStart,
  onDragEnd,
  onDropInto,
}: NavNodeRowProps) {
  // `.tr-tw` trong mockup là `<span>`, không phải nút: nó chỉ báo trạng thái.
  // Đường mở/thu là chính việc chọn nút — xem `hiddenBranches` trong `NavEditor`.
  const twisty = childCount === 0 ? "" : collapsed ? "▸" : "▾";

  const count =
    node.kind !== "CONTAINER"
      ? null
      : childCount === 0
        ? { text: labels.emptyContainer, warn: true }
        : {
            text:
              childCount === 1
                ? labels.childCountOne
                : labels.childCountOther.replace("{count}", String(childCount)),
            warn: false,
          };

  return (
    <div
      className={styles.row}
      data-nav-row={node.id}
      data-selected={selected ? "true" : undefined}
      data-root={isRoot ? "true" : undefined}
      data-status={node.status}
      onDragOver={
        dropTarget
          ? (event) => {
              // Không chặn thì trình duyệt từ chối cả vùng thả.
              event.preventDefault();
            }
          : undefined
      }
      onDrop={
        dropTarget
          ? (event) => {
              event.preventDefault();
              // Hàng nằm trong khối gốc trên cùng; không chặn thì một lần thả
              // vào nút chứa lại chạy thêm nhánh "thành tab".
              event.stopPropagation();
              onDropInto();
            }
          : undefined
      }
    >
      {/*
        Tay cầm kéo là hình, không phải tên gọi: `aria-hidden` để trình đọc màn
        hình không đọc một thứ nó không dùng được, còn `title` để người dùng
        chuột biết kéo được. Đường bàn phím tương đương là ô "Nút cha" và bộ bốn
        nút thứ tự — hai thứ đó mới là cam kết tiếp cận, kéo thả chỉ là đường
        nhanh khi có chuột.
      */}
      <span
        className={styles.grip}
        data-nav-grip=""
        draggable
        title={labels.drag}
        aria-hidden="true"
        onDragStart={(event) => {
          onDragStart();
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            // Firefox không bắt đầu kéo nếu dataTransfer trống.
            event.dataTransfer.setData("text/plain", node.id);
          }
        }}
        onDragEnd={onDragEnd}
      >
        ⠿
      </span>

      <span className={styles.twisty} aria-hidden="true">
        {twisty}
      </span>

      {/* Bấm tên là chọn nút — bảng thuộc tính bên phải đổi theo. */}
      <button
        className={styles.name}
        type="button"
        aria-label={labels.select.replace("{name}", name)}
        onClick={onSelect}
      >
        {name}
      </button>

      <span className={styles.kind} data-kind={node.kind}>
        {navKindLabel(node.kind, labels)}
      </span>

      {/*
        Huy hiệu trạng thái chỉ hiện khi nút **chưa** ra ngoài được. Nút đã
        publish là trường hợp thường, gắn nhãn cho nó chỉ làm hàng dài thêm mà
        không nói thêm gì; còn `DRAFT` và `ARCHIVED` trông y hệt nút đã publish
        nếu không có gì đánh dấu — và đó chính là lúc người vận hành không hiểu
        vì sao mục vừa thêm không xuất hiện trên trang công khai.

        Chữ chứ không phải chấm màu: chấm màu bắt người đọc học bảng chú giải,
        và người không phân biệt được màu thì không đọc được gì cả.
      */}
      {node.status === "PUBLISHED" ? null : (
        <span className={styles.status} data-status={node.status}>
          {node.status === "DRAFT" ? labels.statusDraft : labels.statusArchived}
        </span>
      )}

      {count === null ? null : (
        <span className={styles.count} data-warn={count.warn ? "true" : undefined}>
          {count.text}
        </span>
      )}

      {/* `.tr-act`: `margin-left:auto` đặt ở đây, không ở `OrderControls` —
          bộ nút đó còn dùng ở tính năng và mục nội dung, nơi nó không đứng cuối. */}
      <span className={styles.actions}>
        <OrderControls index={index} total={total} onMove={onMove} labels={labels.order} />

        <button className={styles.action} type="button" onClick={onSelect}>
          {labels.edit}
        </button>
        <button
          className={styles.action}
          type="button"
          title={labels.removeHint}
          onClick={onRemove}
        >
          {labels.remove}
        </button>
      </span>
    </div>
  );
}
