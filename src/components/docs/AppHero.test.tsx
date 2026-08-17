import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { AppDetail } from "@/server/content/queries";
import { AppHero } from "./AppHero";
import { FeatureGrid } from "./FeatureGrid";

const app: AppDetail = {
  id: "a1",
  slug: "web-store-apps",
  kind: "CORE",
  status: "PUBLISHED",
  order: 0,
  logoUrl: null,
  repoUrl: "https://github.com/LeVanAnhDuc/web-store-apps",
  apiRepoUrl: null,
  demoUrl: null,
  isRepoPrivate: false,
  isStandalone: false,
  techStack: ["Next.js 16"],
  integration: "core",
  name: "Web Store Apps",
  tagline: "Cổng đăng nhập và bảng khởi chạy ứng dụng",
  summary: "Giao diện của IDMS.",
  locale: "vi",
  isFallback: false,
  features: [],
  sections: [],
  toc: [],
};

const labels = {
  status: "Lõi",
  privateRepo: "Repo riêng tư",
  repo: "Xem repo",
  apiRepo: "Xem repo máy chủ",
  demo: "Mở bản chạy thử",
  fallback: "Chưa có bản dịch",
};

describe("AppHero", () => {
  it("tên hiển thị là h1, slug repo chỉ ở vai phụ", () => {
    render(<AppHero app={app} locale="vi" crumb="Ứng dụng / Lõi" labels={labels} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Web Store Apps");
    expect(heading).not.toHaveTextContent("web-store-apps");
    expect(screen.getByText("web-store-apps")).toBeInTheDocument();
  });

  it("repo riêng tư thì không dựng liên kết chết, thay bằng huy hiệu", () => {
    render(
      <AppHero
        app={{ ...app, isRepoPrivate: true }}
        locale="vi"
        crumb="Ứng dụng / Lõi"
        labels={labels}
      />,
    );
    expect(screen.queryByRole("link", { name: "Xem repo" })).toBeNull();
    expect(screen.getByText("Repo riêng tư")).toBeInTheDocument();
  });

  it("báo bản dịch thiếu khi nội dung lùi về ngôn ngữ khác", () => {
    render(
      <AppHero
        app={{ ...app, locale: "vi", isFallback: true }}
        locale="en"
        crumb="Apps / Core"
        labels={labels}
      />,
    );
    expect(screen.getByText("Chưa có bản dịch")).toBeInTheDocument();
  });
});

describe("FeatureGrid", () => {
  it("mỗi ô mang cờ fallback riêng — bản dịch hoàn thiện không đều", () => {
    render(
      <FeatureGrid
        title="Tính năng"
        locale="vi"
        fallbackLabel="Chưa có bản dịch"
        features={[
          {
            id: "f1",
            order: 0,
            icon: null,
            title: "Đăng nhập OTP",
            description: null,
            locale: "vi",
            isFallback: false,
          },
          {
            id: "f2",
            order: 1,
            icon: null,
            title: "Consent screen",
            description: null,
            locale: "en",
            isFallback: true,
          },
        ]}
      />,
    );
    expect(screen.getAllByText("Chưa có bản dịch")).toHaveLength(1);
  });

  it("không tính năng nào thì không dựng tiêu đề cho khối trống", () => {
    const { container } = render(
      <FeatureGrid features={[]} title="Tính năng" locale="vi" fallbackLabel="x" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
