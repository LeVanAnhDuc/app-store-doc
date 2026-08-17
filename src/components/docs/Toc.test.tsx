import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Toc } from "./Toc";

describe("Toc", () => {
  it("dựng liên kết neo từ anchor của mục", () => {
    render(<Toc items={[{ anchor: "la-gi", title: "Là gì" }]} title="Trong trang" />);
    expect(screen.getByRole("link", { name: "Là gì" })).toHaveAttribute("href", "#la-gi");
  });
  it("không mục nào thì không dựng khung rỗng", () => {
    const { container } = render(<Toc items={[]} title="Trong trang" />);
    expect(container).toBeEmptyDOMElement();
  });
});
