import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SortableList } from "./SortableList";

const items = [
  { id: "a", label: "Là gì" },
  { id: "b", label: "Quick start" },
  { id: "c", label: "Triển khai" },
];

/**
 * Tay cầm kéo mang tên "Sắp xếp {tên}". Neo vào đầu chuỗi vì bộ nút thứ tự cũng
 * ghép tên mục vào nhãn của nó, nên `/Là gì/` trần khớp sáu nút một lúc.
 */
const handle = (label: string) => screen.getByRole("button", { name: new RegExp(`^Sắp xếp ${label}`) });

describe("SortableList", () => {
  it("đổi chỗ được bằng bàn phím — kéo thả không dùng được nếu chỉ có bàn phím", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);
    fireEvent.keyDown(handle("Là gì"), { key: "ArrowDown" });
    expect(onReorder).toHaveBeenCalledWith(["b", "a", "c"]);
  });

  it("mũi tên lên ở tay cầm vẫn đưa mục lên một bậc", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);
    fireEvent.keyDown(handle("Triển khai"), { key: "ArrowUp" });
    expect(onReorder).toHaveBeenCalledWith(["a", "c", "b"]);
  });

  it("xoá một mục thì gọi lại với danh sách còn lại", () => {
    const onRemove = vi.fn();
    render(<SortableList items={items} onReorder={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^xoá/i })[0]);
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("mỗi mục có bộ bốn nút thứ tự, nhãn mang tên mục để không trùng nhau", () => {
    render(<SortableList items={items} onReorder={() => {}} />);

    for (const label of ["Là gì", "Quick start", "Triển khai"]) {
      for (const prefix of ["Đưa lên đầu", "Lên một bậc", "Xuống một bậc", "Đưa xuống cuối"]) {
        expect(
          screen.getByRole("button", { name: `${prefix} ${label}` }),
          `${label} · ${prefix}`,
        ).toBeInTheDocument();
      }
    }
  });

  it("bộ nút mờ ở hai đầu — không nút nào bấm vào mà không xảy ra gì", () => {
    render(<SortableList items={items} onReorder={() => {}} />);

    expect(screen.getByRole("button", { name: "Đưa lên đầu Là gì" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lên một bậc Là gì" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xuống một bậc Là gì" })).toBeEnabled();

    expect(screen.getByRole("button", { name: "Đưa xuống cuối Triển khai" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xuống một bậc Triển khai" })).toBeDisabled();
  });

  it("'đưa lên đầu' đẩy cả dải xuống một bậc chứ không hoán đổi hai ô", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);

    fireEvent.click(screen.getByRole("button", { name: "Đưa lên đầu Triển khai" }));
    // Hoán đổi sẽ cho ["c", "b", "a"] — "Là gì" bị ném xuống cuối mà không ai bảo.
    expect(onReorder).toHaveBeenCalledWith(["c", "a", "b"]);
  });

  it("'đưa xuống cuối' đưa mục đầu về cuối trong một lần bấm", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);

    fireEvent.click(screen.getByRole("button", { name: "Đưa xuống cuối Là gì" }));
    expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"]);
  });

  it("nhãn bộ nút dịch được — không có chuỗi tiếng Việt nào lọt ra khi truyền labels", () => {
    render(
      <SortableList
        items={items}
        onReorder={() => {}}
        labels={{
          order: {
            top: "Move to the top",
            up: "Move up one place",
            down: "Move down one place",
            bottom: "Move to the bottom",
          },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Move to the top Là gì" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đưa lên đầu Là gì" })).toBeNull();
  });
});
