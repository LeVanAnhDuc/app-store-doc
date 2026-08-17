// src/components/ui/Badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("gắn data-kind để CSS chọn màu trạng thái", () => {
    render(<Badge kind="private">Repo riêng tư</Badge>);
    expect(screen.getByText("Repo riêng tư").getAttribute("data-kind")).toBe("private");
  });
  it("không viết mã màu trực tiếp trong style nội tuyến", () => {
    const { container } = render(<Badge kind="core">Lõi</Badge>);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
