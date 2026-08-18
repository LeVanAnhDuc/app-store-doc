import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NavTree } from "./NavTree";

const tree = [{
  id: "r", kind: "CONTAINER" as const, label: "Vệ tinh", href: null, isFallback: false,
  children: [
    { id: "a", kind: "APP" as const, label: "Match CV", href: "/vi/apps/match-cv", isFallback: false, children: [] },
    { id: "c", kind: "CONTAINER" as const, label: "Công cụ nhỏ", href: null, isFallback: false, children: [
      { id: "b", kind: "APP" as const, label: "Calculate Badminton", href: "/vi/apps/badminton", isFallback: false, children: [] },
    ]},
  ],
}];

describe("NavTree", () => {
  it("nút chứa là <button> toggle, KHÔNG phải liên kết", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(screen.getByRole("button", { name: /Vệ tinh/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Vệ tinh/ })).toBeNull();
  });

  it("nút lá là liên kết, KHÔNG toggle", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(screen.getByRole("link", { name: "Match CV" })).toHaveAttribute("href", "/vi/apps/match-cv");
  });

  it("lồng được ba tầng", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/badminton" />);
    expect(screen.getByRole("link", { name: "Calculate Badminton" })).toBeInTheDocument();
  });

  it("nhánh chứa mục đang xem được mở sẵn", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/badminton" />);
    expect(screen.getByRole("button", { name: /Công cụ nhỏ/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("bấm nút chứa thì đóng nhánh lại", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/badminton" />);
    const b = screen.getByRole("button", { name: /Vệ tinh/ });
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "false");
  });
});

// ---------------------------------------------------------------------------
// Thêm ngoài năm test của kế hoạch: hai chốt mà năm test kia không bắt được.
// ---------------------------------------------------------------------------

describe("NavTree — chốt thêm", () => {
  it("nút lá KHÔNG có aria-expanded — nó không mở đóng gì cả", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(screen.getByRole("link", { name: "Match CV" })).not.toHaveAttribute("aria-expanded");
  });

  it("mục đang xem đánh dấu bằng aria-current, viên nền chỉ là hệ quả", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(screen.getByRole("link", { name: "Match CV" })).toHaveAttribute("aria-current", "page");
  });

  it("không viết mã màu trực tiếp", () => {
    const { container } = render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("cây rỗng thì không dựng gì cả", () => {
    const { container } = render(<NavTree nodes={[]} activeHref="/vi" />);
    expect(container).toBeEmptyDOMElement();
  });
});
