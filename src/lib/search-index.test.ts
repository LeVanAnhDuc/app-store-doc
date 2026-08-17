// src/lib/search-index.test.ts
import { describe, it, expect } from "vitest";
import { stripMarkdown, buildSearchIndex } from "./search-index";

describe("stripMarkdown", () => {
  it("bỏ ký hiệu tiêu đề và nhấn mạnh", () => {
    expect(stripMarkdown("## Tính năng\n\n**đậm** và *nghiêng*")).toBe("Tính năng đậm và nghiêng");
  });
  it("bỏ khối mã — lệnh shell làm nhiễu kết quả tìm", () => {
    expect(stripMarkdown("Chạy:\n\n```bash\nnpm install\n```\n\nXong.")).toBe("Chạy: Xong.");
  });
  it("giữ chữ trong liên kết, bỏ URL", () => {
    expect(stripMarkdown("[GitHub](https://github.com/a/b)")).toBe("GitHub");
  });
});

describe("buildSearchIndex", () => {
  const input = {
    apps: [{ slug: "web-store-apps", name: "Web Store Apps",
             sections: [{ title: "Là gì", body: "Giao diện của IDMS." }] }],
    docs: [{ slug: "tich-hop-oauth", title: "Tích hợp OAuth",
             sections: [{ title: "Luồng", body: "Năm bước." }] }],
    locale: "vi",
  };

  it("sinh href có tiền tố locale", () => {
    const idx = buildSearchIndex(input);
    expect(idx.map(d => d.href)).toEqual(["/vi/apps/web-store-apps", "/vi/docs/tich-hop-oauth"]);
  });

  it("dùng tên hiển thị làm tiêu đề, không dùng slug", () => {
    expect(buildSearchIndex(input)[0].title).toBe("Web Store Apps");
  });

  it("gộp nội dung mọi mục vào một chuỗi tìm được", () => {
    expect(buildSearchIndex(input)[0].text).toContain("Giao diện của IDMS");
    expect(buildSearchIndex(input)[0].text).toContain("Là gì");
  });
});
