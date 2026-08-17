// src/components/ui/WireDiagram.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WireDiagram } from "./WireDiagram";

const items = [
  { name: "Web Store Apps",     desc: "Đăng nhập",  integration: "core" as const },
  { name: "Match CV",           desc: "Đối chiếu",  integration: "planned" as const },
  { name: "Calculate Badminton",desc: "Chia tiền",  integration: "standalone" as const },
];

describe("WireDiagram", () => {
  it("hiện tên hiển thị, không hiện slug", () => {
    render(<WireDiagram items={items} coreLabel="IDMS" />);
    expect(screen.getByText("Calculate Badminton")).toBeInTheDocument();
    expect(screen.queryByText("app-calculate-badminton")).toBeNull();
  });

  it("nét liền cho đã nối, nét đứt cho dự kiến, không nét cho độc lập", () => {
    const { container } = render(<WireDiagram items={items} coreLabel="IDMS" />);
    const leads = container.querySelectorAll("[data-integration]");
    expect(leads[0].getAttribute("data-integration")).toBe("core");
    expect(leads[1].getAttribute("data-integration")).toBe("planned");
    expect(leads[2].getAttribute("data-integration")).toBe("standalone");
  });

  it("luôn kèm chú giải — kiểu nét vô nghĩa nếu không giải thích", () => {
    render(<WireDiagram items={items} coreLabel="IDMS" />);
    expect(screen.getByRole("list", { name: /chú giải/i })).toBeInTheDocument();
  });

  it("danh sách rỗng vẫn dựng được, không đổ vỡ", () => {
    const { container } = render(<WireDiagram items={[]} coreLabel="IDMS" />);
    expect(container.querySelectorAll("[data-integration]")).toHaveLength(0);
  });
});
