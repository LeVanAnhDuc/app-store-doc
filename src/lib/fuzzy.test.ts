// src/lib/fuzzy.test.ts
import { describe, it, expect } from "vitest";
import { fuzzyMatch } from "./fuzzy";

const docs = [
  { href: "/vi/apps/web-store-apps", title: "Web Store Apps", kind: "app" as const, text: "đăng nhập oauth consent" },
  { href: "/vi/apps/manage-gym",     title: "Manage Gym",     kind: "app" as const, text: "nhật ký tập luyện" },
];

describe("fuzzyMatch", () => {
  it("khớp theo tiêu đề", () => {
    expect(fuzzyMatch("gym", docs)[0].title).toBe("Manage Gym");
  });
  it("khớp theo nội dung", () => {
    expect(fuzzyMatch("consent", docs)[0].title).toBe("Web Store Apps");
  });
  it("bỏ qua dấu — gõ 'tap luyen' vẫn ra 'tập luyện'", () => {
    expect(fuzzyMatch("tap luyen", docs)[0].title).toBe("Manage Gym");
  });
  it("không khớp thì trả mảng rỗng", () => {
    expect(fuzzyMatch("zzzzz", docs)).toEqual([]);
  });
  it("truy vấn rỗng trả mảng rỗng, không trả tất cả", () => {
    expect(fuzzyMatch("", docs)).toEqual([]);
  });
});
