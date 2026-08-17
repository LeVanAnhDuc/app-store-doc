// src/lib/markdown.test.ts
import { readFileSync } from "node:fs";
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

// Canh hợp đồng giữa markdown và CSS. Thêm sau khi xem tận mắt phát hiện khối mã
// ra đơn sắc: globals.css viết selector `.shiki` theo phỏng đoán, mà markup thật
// không có class đó. CSS không khớp thì không báo lỗi, nên phải có test.
describe("hợp đồng với globals.css", () => {
  it("token mang biến màu trên phần tử mà selector của globals.css khớp", async () => {
    const html = await renderMarkdown("```bash\nnpm install\n```");
    // Biến màu nằm ở `style` nội tuyến, không phải class.
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
    // Và phần tử bọc chúng phải mang `data-theme` — đó là chỗ CSS bám vào.
    expect(html).toMatch(/<code[^>]*data-theme=/);
  });

  it("không sinh class `shiki` — đừng viết CSS bám vào nó", async () => {
    const html = await renderMarkdown("```bash\nnpm install\n```");
    expect(html).not.toMatch(/class="[^"]*\bshiki\b/);
  });

  it("globals.css bám vào code[data-theme], không bám vào .shiki", () => {
    const css = readFileSync("src/styles/globals.css", "utf8");
    expect(css).toContain("code[data-theme]");
    expect(css).not.toMatch(/^\s*\.shiki[\s,{]/m);
  });
});
