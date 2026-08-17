// src/i18n/messages.test.ts
import { describe, it, expect } from "vitest";
import vi from "./messages/vi.json";
import en from "./messages/en.json";
import { locales, defaultLocale } from "./locales.generated";

const flatten = (o: any, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? flatten(v, `${p}${k}.`) : [`${p}${k}`]);

describe("chuỗi giao diện", () => {
  it("vi và en có đúng cùng bộ khoá — thiếu khoá là deploy ra bản trống chữ", () => {
    expect(flatten(en).sort()).toEqual(flatten(vi).sort());
  });
  it("không giá trị nào rỗng", () => {
    for (const msgs of [vi, en]) {
      for (const key of flatten(msgs)) {
        const val = key.split(".").reduce<any>((a, k) => a[k], msgs);
        expect(val, key).not.toBe("");
      }
    }
  });
  it("locale mặc định nằm trong danh sách locale", () => {
    expect(locales).toContain(defaultLocale);
  });
});
