// src/i18n/messages.test.ts
import { describe, it, expect } from "vitest";
import vi from "./messages/vi.json";
import en from "./messages/en.json";
import { locales, defaultLocale } from "./locales.generated";

/** Cây chuỗi giao diện: lá là chuỗi, nhánh là nhóm khoá lồng nhau. */
type MessageTree = { [key: string]: string | MessageTree };

const isTree = (value: string | MessageTree): value is MessageTree =>
  typeof value === "object" && value !== null;

/** Trả mọi đường dẫn khoá dạng `admin.login.title` để so hai locale với nhau. */
const flatten = (tree: MessageTree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    isTree(value) ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

const lookup = (tree: MessageTree, path: string): string | MessageTree | undefined =>
  path.split(".").reduce<string | MessageTree | undefined>(
    (node, key) => (node !== undefined && isTree(node) ? node[key] : undefined),
    tree,
  );

const viTree: MessageTree = vi;
const enTree: MessageTree = en;

describe("chuỗi giao diện", () => {
  it("vi và en có đúng cùng bộ khoá — thiếu khoá là deploy ra bản trống chữ", () => {
    expect(flatten(enTree).sort()).toEqual(flatten(viTree).sort());
  });
  it("không giá trị nào rỗng", () => {
    for (const msgs of [viTree, enTree]) {
      for (const key of flatten(msgs)) {
        expect(lookup(msgs, key), key).not.toBe("");
      }
    }
  });
  it("locale mặc định nằm trong danh sách locale", () => {
    expect(locales).toContain(defaultLocale);
  });
});

describe("tên dự án", () => {
  it("thương hiệu là Ducker ở mọi ngôn ngữ", () => {
    for (const msgs of [viTree, enTree]) {
      expect(lookup(msgs, "brand.name")).toBe("Ducker");
    }
  });
  it("không còn chữ Atlas trong chuỗi giao diện", () => {
    for (const msgs of [viTree, enTree]) {
      for (const key of flatten(msgs)) {
        expect(String(lookup(msgs, key)), key).not.toMatch(/\bAtlas\b/);
      }
    }
  });
});
