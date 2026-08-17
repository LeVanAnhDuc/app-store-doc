import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { ResolvedSection } from "@/server/content/queries";
import { SectionBody } from "./SectionBody";

const section: ResolvedSection = {
  id: "s1",
  order: 0,
  anchor: "chay-thu",
  title: "Chạy thử trong 5 phút",
  body: {
    type: "markdown",
    content: "Cần Node 20.\n\n```bash\nnpm install\n```\n\n| Tên | Bắt buộc |\n|---|---|\n| API_SERVER_URL | Có |",
  },
  locale: "vi",
  isFallback: false,
};

const labels = {
  fallback: "Chưa có bản dịch",
  code: "Khối mã",
  table: "Bảng dữ liệu",
  permalink: "Liên kết tới mục Chạy thử trong 5 phút",
};

describe("SectionBody", () => {
  it("kết xuất markdown ở máy chủ và neo mục theo anchor", async () => {
    const { container } = render(await SectionBody({ section, locale: "vi", labels }));

    expect(container.querySelector("#chay-thu")).not.toBeNull();
    expect(screen.getByText("Cần Node 20.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: labels.permalink })).toHaveAttribute(
      "href",
      "#chay-thu",
    );
  });

  it("khối mã và bảng nằm trong hộp cuộn riêng — thân trang không cuộn ngang", async () => {
    render(await SectionBody({ section, locale: "vi", labels }));

    expect(screen.getByRole("region", { name: "Khối mã" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bảng dữ liệu" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("một khối mã chỉ có một điểm dừng Tab, không phải hai", async () => {
    const { container } = render(await SectionBody({ section, locale: "vi", labels }));
    expect(container.querySelectorAll("pre[tabindex]")).toHaveLength(0);
  });

  it("mục lùi về ngôn ngữ khác thì mang ghi chú của riêng nó", async () => {
    render(await SectionBody({ section: { ...section, locale: "vi" }, locale: "en", labels }));
    expect(screen.getByText("Chưa có bản dịch")).toBeInTheDocument();
  });
});
