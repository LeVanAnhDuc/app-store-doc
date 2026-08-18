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
  const nodes = [
    {
      id: "core", kind: "CONTAINER" as const, label: "Lõi", href: null, isFallback: false,
      children: [
        { id: "a", kind: "APP" as const, label: "Web Store Apps", href: "/vi/apps/a", isFallback: false, children: [] },
      ],
    },
  ];

  it("đánh dấu trang đang mở bằng aria-current", () => {
    render(<Sidebar nodes={nodes} activeHref="/vi/apps/a" label="Điều hướng tài liệu" />);
    expect(screen.getByRole("link", { name: "Web Store Apps" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("vùng điều hướng có tên gọi để trình đọc màn hình phân biệt với dải tab", () => {
    render(<Sidebar nodes={nodes} activeHref="/vi/apps/a" label="Điều hướng tài liệu" />);
    expect(screen.getByRole("navigation", { name: "Điều hướng tài liệu" })).toBeInTheDocument();
  });

  it("không nút nào thì không dựng cột trống", () => {
    const { container } = render(<Sidebar nodes={[]} activeHref="/vi" label="Điều hướng tài liệu" />);
    expect(container).toBeEmptyDOMElement();
  });
});
