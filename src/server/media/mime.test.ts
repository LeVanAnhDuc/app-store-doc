// src/server/media/mime.test.ts
import { describe, it, expect } from "vitest";
import { detectImageMime } from "./mime";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(32).fill(0)]);

describe("detectImageMime", () => {
  it("nhận PNG", () => {
    expect(detectImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });
  it("nhận JPEG", () => {
    expect(detectImageMime(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
  });
  it("nhận WebP qua RIFF....WEBP", () => {
    const b = new Uint8Array(32);
    b.set([0x52, 0x49, 0x46, 0x46], 0);
    b.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectImageMime(b)).toBe("image/webp");
  });
  it("nhận SVG", () => {
    expect(detectImageMime(new TextEncoder().encode('<svg xmlns="..."></svg>'))).toBe("image/svg+xml");
  });
  it("từ chối tệp thực thi đổi tên thành .png — không tin đuôi file", () => {
    expect(detectImageMime(bytes(0x4d, 0x5a, 0x90))).toBeNull();
  });
  it("từ chối HTML trá hình", () => {
    expect(detectImageMime(new TextEncoder().encode("<html><script>"))).toBeNull();
  });
  it("từ chối tệp rỗng", () => {
    expect(detectImageMime(new Uint8Array(0))).toBeNull();
  });
});
