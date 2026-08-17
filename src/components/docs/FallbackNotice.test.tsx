import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FallbackNotice } from "./FallbackNotice";

describe("FallbackNotice", () => {
  it("báo rõ đang đọc bản ngôn ngữ khác", () => {
    render(<FallbackNotice shownLocale="vi" wantedLocale="en" label="Chưa có bản tiếng Anh" />);
    expect(screen.getByText("Chưa có bản tiếng Anh")).toBeInTheDocument();
  });
  it("không hiện gì khi đúng ngôn ngữ", () => {
    const { container } = render(<FallbackNotice shownLocale="vi" wantedLocale="vi" label="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
