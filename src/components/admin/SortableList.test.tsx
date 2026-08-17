import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SortableList } from "./SortableList";

const items = [{ id: "a", label: "Là gì" }, { id: "b", label: "Quick start" }];

describe("SortableList", () => {
  it("đổi chỗ được bằng bàn phím — kéo thả không dùng được nếu chỉ có bàn phím", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Là gì/ }), { key: "ArrowDown" });
    expect(onReorder).toHaveBeenCalledWith(["b", "a"]);
  });

  it("xoá một mục thì gọi lại với danh sách còn lại", () => {
    const onRemove = vi.fn();
    render(<SortableList items={items} onReorder={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByRole("button", { name: /xoá/i })[0]);
    expect(onRemove).toHaveBeenCalledWith("a");
  });
});
