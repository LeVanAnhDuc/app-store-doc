// src/lib/slug.test.ts
import { describe, it, expect } from "vitest";
import { slugify, toAnchor, ensureUniqueAnchors } from "./slug";

describe("slugify", () => {
  it("bỏ dấu tiếng Việt", () => {
    expect(slugify("Chạy thử trong 5 phút")).toBe("chay-thu-trong-5-phut");
  });
  it("xử lý đ và Đ", () => {
    expect(slugify("Đăng nhập")).toBe("dang-nhap");
  });
  it("gộp khoảng trắng và ký tự lạ thành một gạch nối", () => {
    expect(slugify("Biến   môi  trường!!")).toBe("bien-moi-truong");
  });
  it("không để gạch nối thừa ở hai đầu", () => {
    expect(slugify("  --Là gì--  ")).toBe("la-gi");
  });
  it("chuỗi rỗng trả về rỗng", () => {
    expect(slugify("   ")).toBe("");
  });
});

describe("ensureUniqueAnchors", () => {
  it("chấp nhận danh sách không trùng", () => {
    expect(ensureUniqueAnchors(["la-gi", "quick-start"])).toEqual({ ok: true });
  });
  it("bắt được anchor trùng — trùng thì mục lục nhảy sai chỗ", () => {
    expect(ensureUniqueAnchors(["la-gi", "la-gi"])).toEqual({ ok: false, duplicate: "la-gi" });
  });
});

describe("toAnchor", () => {
  it("dùng lại slugify", () => {
    expect(toAnchor("Tính năng")).toBe("tinh-nang");
  });
});
