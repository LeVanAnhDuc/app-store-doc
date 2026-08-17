import { describe, it, expect } from "vitest";
import { resolveTranslation, assertSingleDefaultLocale, buildToc } from "./resolve";

const rows = [
  { locale: "vi", title: "Tính năng" },
  { locale: "en", title: "Features" },
];

describe("resolveTranslation", () => {
  it("trả đúng bản dịch khi có", () => {
    expect(resolveTranslation(rows, "en", "vi")).toEqual({
      value: rows[1], locale: "en", isFallback: false,
    });
  });

  it("thiếu bản dịch thì lùi về locale mặc định và đánh dấu isFallback", () => {
    expect(resolveTranslation(rows, "ja", "vi")).toEqual({
      value: rows[0], locale: "vi", isFallback: true,
    });
  });

  it("không có cả bản mặc định thì trả null, để trang gọi notFound()", () => {
    expect(resolveTranslation([], "vi", "vi")).toBeNull();
  });

  it("không bao giờ trả slug làm nhãn thay thế", () => {
    const r = resolveTranslation(rows, "ja", "vi");
    expect(r!.value.title).not.toMatch(/-/);
  });
});

describe("assertSingleDefaultLocale", () => {
  it("chấp nhận đúng một mặc định đang bật", () => {
    expect(() => assertSingleDefaultLocale([
      { code: "vi", isDefault: true,  enabled: true },
      { code: "en", isDefault: false, enabled: true },
    ])).not.toThrow();
  });

  it("từ chối khi có hai mặc định — fallback sẽ không xác định", () => {
    expect(() => assertSingleDefaultLocale([
      { code: "vi", isDefault: true, enabled: true },
      { code: "en", isDefault: true, enabled: true },
    ])).toThrow(/đúng một/);
  });

  it("từ chối khi locale mặc định đang tắt", () => {
    expect(() => assertSingleDefaultLocale([
      { code: "vi", isDefault: true, enabled: false },
    ])).toThrow();
  });

  it("từ chối khi không có mặc định nào", () => {
    expect(() => assertSingleDefaultLocale([
      { code: "vi", isDefault: false, enabled: true },
    ])).toThrow();
  });
});

// Bổ sung sau đợt chạy song song: buildToc nằm trong khối "Produces" của Task 4
// và Task 12/13 phụ thuộc, nhưng 8 test gốc không phủ nó.
describe("buildToc", () => {
  it("giữ nguyên thứ tự mục — thứ tự trong CMS là thứ tự hiển thị", () => {
    expect(
      buildToc([
        { anchor: "la-gi", title: "Là gì" },
        { anchor: "quick-start", title: "Chạy thử" },
      ]),
    ).toEqual([
      { anchor: "la-gi", title: "Là gì" },
      { anchor: "quick-start", title: "Chạy thử" },
    ]);
  });

  it("ném lỗi khi anchor trùng — trùng thì mục lục nhảy sai chỗ", () => {
    expect(() =>
      buildToc([
        { anchor: "la-gi", title: "Là gì" },
        { anchor: "la-gi", title: "Mục khác" },
      ]),
    ).toThrow(/la-gi/);
  });

  it("không mục nào thì trả mảng rỗng, để trang không dựng khung trống", () => {
    expect(buildToc([])).toEqual([]);
  });
});
