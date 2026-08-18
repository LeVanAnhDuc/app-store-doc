// src/styles/tokens.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");

describe("design token", () => {
  it("định nghĩa bảng màu sáng đầy đủ ở :root trần", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf("@media"));
    for (const name of ["--bg","--surface","--line","--ink","--muted","--accent",
                        "--st-core","--st-connected","--st-standalone","--st-planned","--st-private"]) {
      expect(root).toContain(name);
    }
  });

  it("khối dark bọc bằng :root:not([data-theme=\"light\"])", () => {
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it("có khối [data-theme=\"dark\"] để nút chuyển thắng cả hai chiều", () => {
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it("mọi token khai báo trong khối tối đều đã có ở :root trần", () => {
    const light = css.slice(0, css.indexOf("@media"));
    const darkNames = [...css.slice(css.indexOf("@media")).matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]);
    for (const n of new Set(darkNames)) expect(light).toContain(`${n}:`);
  });

  it("không dùng webfont", () => {
    expect(css).not.toMatch(/@font-face|fonts\.googleapis|next\/font/);
  });

  it("leading thân bài không dưới 1.7 vì dấu tiếng Việt chồng nhau", () => {
    const lh = Number(/--lh-body:\s*([\d.]+)/.exec(css)![1]);
    expect(lh).toBeGreaterThanOrEqual(1.7);
  });
});

describe("bậc cỡ và vùng bấm v3", () => {
  it("thân bài 16px — chuẩn của 4/5 trang docs lớn đã đo", () => {
    expect(/--t-md:\s*16px/.test(css)).toBe(true);
  });

  it("có token --tap cho ngưỡng bấm WCAG 2.2 SC 2.5.8", () => {
    const tap = Number(/--tap:\s*(\d+)px/.exec(css)![1]);
    expect(tap).toBeGreaterThanOrEqual(24);
  });

  it("có phông serif cho tiêu đề", () => {
    expect(css).toMatch(/--serif:/);
  });

  it("Georgia KHÔNG có trong stack serif — thiếu glyph tiếng Việt dựng sẵn", () => {
    const serif = /--serif:([^;]+);/.exec(css)![1];
    expect(serif).not.toMatch(/Georgia/i);
  });

  it("token đổi vai theo chủ đề: --eyebrow có ở cả ba khối", () => {
    expect(css.match(/--eyebrow:/g)!.length).toBe(3);
  });

  it("không còn màu tím của bản cũ", () => {
    expect(css).not.toMatch(/#4B2ED4|#9B7CFF/i);
  });
});
