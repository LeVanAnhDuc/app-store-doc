import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AppCard } from "./AppCard";

const base = {
  slug: "app-manage-gym", name: "Manage Gym", tagline: "Nhật ký tập luyện",
  kind: "SATELLITE" as const, techStack: ["Next.js 16"], integration: "planned" as const,
  isRepoPrivate: false,
};

describe("AppCard", () => {
  it("tên hiển thị là tiêu đề, slug chỉ là chữ phụ", () => {
    render(<AppCard app={base} locale="vi" />);
    expect(screen.getByRole("heading")).toHaveTextContent("Manage Gym");
    expect(screen.getByRole("heading")).not.toHaveTextContent("app-manage-gym");
  });

  it("repo riêng tư thì không dựng liên kết GitHub chết", () => {
    render(<AppCard app={{ ...base, isRepoPrivate: true }} locale="vi" />);
    expect(screen.queryByRole("link", { name: /github/i })).toBeNull();
  });

  it("liên kết trỏ tới đường dẫn có tiền tố locale", () => {
    render(<AppCard app={base} locale="en" />);
    expect(screen.getByRole("link", { name: /Manage Gym/ }))
      .toHaveAttribute("href", "/en/apps/app-manage-gym");
  });
});
