import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocsShell } from "./DocsShell";
import { Sidebar } from "./Sidebar";

describe("DocsShell", () => {
  it("chỉ chừa cột cho phần thật sự có nội dung", () => {
    const { container } = render(<DocsShell main={<p>Nội dung</p>} />);
    const shell = container.firstElementChild!;
    expect(shell.getAttribute("data-sidebar")).toBe("no");
    expect(shell.getAttribute("data-toc")).toBe("no");
  });

  it("đủ ba cột thì lưới biết cả ba", () => {
    const { container } = render(
      <DocsShell sidebar={<nav />} main={<p>Nội dung</p>} toc={<nav />} />,
    );
    const shell = container.firstElementChild!;
    expect(shell.getAttribute("data-sidebar")).toBe("yes");
    expect(shell.getAttribute("data-toc")).toBe("yes");
  });
});

describe("Sidebar", () => {
  const groups = [
    { key: "core", label: "Lõi", items: [{ key: "a", href: "/vi/apps/a", label: "Web Store Apps" }] },
    { key: "empty", label: "Ứng dụng vệ tinh", items: [] },
  ];

  it("đánh dấu trang đang mở bằng aria-current", () => {
    render(<Sidebar groups={groups} currentHref="/vi/apps/a" label="Điều hướng tài liệu" />);
    expect(screen.getByRole("link", { name: "Web Store Apps" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("bỏ nhóm rỗng thay vì dựng tiêu đề nhóm không có mục nào", () => {
    render(<Sidebar groups={groups} label="Điều hướng tài liệu" />);
    expect(screen.queryByText("Ứng dụng vệ tinh")).toBeNull();
  });

  it("không nhóm nào thì không dựng cột trống", () => {
    const { container } = render(<Sidebar groups={[]} label="Điều hướng tài liệu" />);
    expect(container).toBeEmptyDOMElement();
  });
});
