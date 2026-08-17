// src/lib/markdown.test.ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("dựng tiêu đề và đoạn văn", async () => {
    expect(await renderMarkdown("## Tính năng\n\nNội dung.")).toContain("<h2");
  });

  it("loại bỏ thẻ script — nội dung hôm nay một người viết, mai nhiều người", async () => {
    const html = await renderMarkdown('Xin chào <script>alert(1)</script>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("loại bỏ handler nội tuyến", async () => {
    expect(await renderMarkdown('<img src="x" onerror="alert(1)">')).not.toContain("onerror");
  });

  it("chặn liên kết javascript:", async () => {
    expect(await renderMarkdown("[bấm](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("giữ bảng GFM", async () => {
    const html = await renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table");
  });

  it("tô màu khối mã", async () => {
    const html = await renderMarkdown("```bash\nnpm install\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("npm install");
  });

  it("giữ nguyên dấu tiếng Việt", async () => {
    expect(await renderMarkdown("Biến môi trường của ứng dụng")).toContain("Biến môi trường của ứng dụng");
  });
});
