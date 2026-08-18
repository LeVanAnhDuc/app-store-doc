import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OrderControls } from "./OrderControls";

const labels = { top: "Đưa lên đầu", up: "Lên một bậc", down: "Xuống một bậc", bottom: "Đưa xuống cuối" };

describe("OrderControls", () => {
  it("bốn nút đều là <button> thật để dùng được bằng bàn phím", () => {
    render(<OrderControls index={1} total={3} onMove={() => {}} labels={labels} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("phần tử đầu: ⤒ và ↑ bị vô hiệu — không nút nào bấm vào mà không xảy ra gì", () => {
    render(<OrderControls index={0} total={3} onMove={() => {}} labels={labels} />);
    expect(screen.getByRole("button", { name: labels.top })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.up })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.down })).toBeEnabled();
  });

  it("phần tử cuối: ↓ và ⤓ bị vô hiệu", () => {
    render(<OrderControls index={2} total={3} onMove={() => {}} labels={labels} />);
    expect(screen.getByRole("button", { name: labels.bottom })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.down })).toBeDisabled();
  });

  it("chỉ một phần tử thì cả bốn nút vô hiệu", () => {
    render(<OrderControls index={0} total={1} onMove={() => {}} labels={labels} />);
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
  });

  it("bấm ⤒ gọi onMove('top')", () => {
    const onMove = vi.fn();
    render(<OrderControls index={2} total={3} onMove={onMove} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.top }));
    expect(onMove).toHaveBeenCalledWith("top");
  });

  it("bấm ⤓ gọi onMove('bottom')", () => {
    const onMove = vi.fn();
    render(<OrderControls index={0} total={3} onMove={onMove} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.bottom }));
    expect(onMove).toHaveBeenCalledWith("bottom");
  });

  it("không viết mã màu trực tiếp", () => {
    const { container } = render(<OrderControls index={1} total={3} onMove={() => {}} labels={labels} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
