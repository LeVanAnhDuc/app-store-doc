import { describe, it, expect } from "vitest";
import {
  resolveTranslation,
  assertSingleDefaultLocale,
  buildToc,
  planContentSave,
} from "./resolve";

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

// Sửa khiếm khuyết Task 15 phát hiện: cấu trúc và bản dịch là hai chuyện khác
// nhau. Trước đây thiếu tiêu đề ở ngôn ngữ đang lưu là **xoá** mục, nên không
// thể dịch dần — mà `TranslationMeter` tồn tại chính là để đo việc dịch dần.
describe("planContentSave", () => {
  it("mục chưa có tiêu đề ở ngôn ngữ đang lưu vẫn được giữ — chưa dịch không phải là xoá", () => {
    const plan = planContentSave(
      [
        { id: "a", title: "Là gì" },
        { id: "b", title: "" },
      ],
      ["a", "b"],
    );

    expect(plan.removedIds).toEqual([]);
    expect(plan.items.map((row) => row.translated)).toEqual([true, false]);
  });

  it("mục vắng mặt khỏi danh sách gửi lên mới là mục bị xoá", () => {
    const plan = planContentSave([{ id: "a", title: "Là gì" }], ["a", "b"]);
    expect(plan.removedIds).toEqual(["b"]);
  });

  it("tiêu đề chỉ có khoảng trắng cũng là chưa dịch", () => {
    const plan = planContentSave([{ id: "a", title: "   " }], ["a"]);
    expect(plan.items[0].translated).toBe(false);
    expect(plan.removedIds).toEqual([]);
  });

  it("mục mới chưa có id thì tạo mới, không tính vào danh sách xoá", () => {
    const plan = planContentSave([{ title: "Mục mới" }], ["a"]);
    expect(plan.items[0].id).toBeUndefined();
    expect(plan.removedIds).toEqual(["a"]);
  });

  it("thứ tự lấy từ vị trí trong mảng — kéo thả trong CMS là thứ tự hiển thị thật", () => {
    const plan = planContentSave(
      [
        { id: "b", title: "Hai" },
        { id: "a", title: "Một" },
      ],
      ["a", "b"],
    );
    expect(plan.items.map((row) => [row.id, row.order])).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
  });

  it("id không thuộc chủ sở hữu này bị nêu ra, không âm thầm bỏ qua", () => {
    const plan = planContentSave([{ id: "x", title: "Của trang khác" }], ["a"]);
    expect(plan.foreignIds).toEqual(["x"]);
  });

  it("danh sách rỗng thì xoá hết — đó là cách xoá mục cuối cùng", () => {
    const plan = planContentSave([], ["a", "b"]);
    expect(plan.removedIds).toEqual(["a", "b"]);
    expect(plan.items).toEqual([]);
  });
});
