import { describe, it, expect } from "vitest";
import {
  buildNavTree,
  findTrail,
  firstLeafHref,
  wouldCreateCycle,
  assertNavInvariants,
  type NavRow,
} from "./nav";

const row = (o: Partial<NavRow> & { id: string }): NavRow => ({
  parentId: null, order: 0, status: "PUBLISHED", kind: "CONTAINER",
  labels: [{ locale: "vi", value: o.id }], href: null, ...o,
});

describe("buildNavTree", () => {
  it("lồng con vào đúng cha và giữ thứ tự order", () => {
    const t = buildNavTree([
      row({ id: "b", order: 1 }), row({ id: "a", order: 0 }),
      row({ id: "a1", parentId: "a", kind: "DOC", href: "/vi/docs/x" }),
    ], "vi", "vi");
    expect(t.map(n => n.id)).toEqual(["a", "b"]);
    expect(t[0].children.map(n => n.id)).toEqual(["a1"]);
  });

  it("lồng được sâu ba tầng", () => {
    const t = buildNavTree([
      row({ id: "r" }), row({ id: "m", parentId: "r" }),
      row({ id: "leaf", parentId: "m", kind: "APP", href: "/vi/apps/x" }),
    ], "vi", "vi");
    expect(t[0].children[0].children[0].href).toBe("/vi/apps/x");
  });

  it("bỏ nút chưa publish", () => {
    const t = buildNavTree([row({ id: "a" }), row({ id: "b", status: "DRAFT" })], "vi", "vi");
    expect(t.map(n => n.id)).toEqual(["a"]);
  });

  it("thiếu nhãn locale thì lùi về mặc định và đánh dấu isFallback", () => {
    const t = buildNavTree([row({ id: "a", labels: [{ locale: "vi", value: "Ứng dụng" }] })], "en", "vi");
    expect(t[0]).toMatchObject({ label: "Ứng dụng", isFallback: true });
  });

  it("nút mồ côi (cha không tồn tại) bị bỏ chứ không làm sập cây", () => {
    const t = buildNavTree([row({ id: "a" }), row({ id: "x", parentId: "khong-co" })], "vi", "vi");
    expect(t.map(n => n.id)).toEqual(["a"]);
  });

  // Hai test dưới không có trong plan — thêm vào để chu trình và nhãn rỗng có
  // người canh, xem chú thích ở đầu `nav.ts`.
  it("chu trình trong dữ liệu thì ném lỗi chứ không lặp vô hạn", () => {
    expect(() => buildNavTree([
      row({ id: "a", parentId: "b" }), row({ id: "b", parentId: "a" }),
    ], "vi", "vi")).toThrow(/chu trình/i);
  });

  it("không có nhãn nào thì bỏ nút, không bịa nhãn từ id", () => {
    const t = buildNavTree([
      row({ id: "a" }),
      row({ id: "khong-nhan", labels: [], kind: "DOC", href: "/vi/docs/y" }),
    ], "vi", "vi");
    expect(t.map(n => n.id)).toEqual(["a"]);
  });
});

describe("wouldCreateCycle (I3)", () => {
  const rows = [row({ id: "a" }), row({ id: "b", parentId: "a" }), row({ id: "c", parentId: "b" })];
  it("chặn kéo nút vào chính hậu duệ của nó", () => {
    expect(wouldCreateCycle(rows, "a", "c")).toBe(true);
  });
  it("chặn nút làm cha của chính nó", () => {
    expect(wouldCreateCycle(rows, "a", "a")).toBe(true);
  });
  it("cho phép chuyển sang nhánh khác", () => {
    expect(wouldCreateCycle(rows, "c", null)).toBe(false);
  });
});

describe("assertNavInvariants", () => {
  it("I1 — nút có con phải là CONTAINER", () => {
    expect(() => assertNavInvariants([
      row({ id: "a", kind: "APP", href: "/x" }), row({ id: "b", parentId: "a" }),
    ], "vi")).toThrow(/nút chứa/i);
  });

  it("I2 — nút chứa không có con đã publish thì không publish được", () => {
    expect(() => assertNavInvariants([row({ id: "a" })], "vi")).toThrow(/rỗng/i);
  });

  it("I5 — nút chứa phải có nhãn ở locale mặc định", () => {
    expect(() => assertNavInvariants([
      row({ id: "a", labels: [] }), row({ id: "b", parentId: "a", kind: "DOC", href: "/x" }),
    ], "vi")).toThrow(/nhãn/i);
  });

  it("I6 — phải có ít nhất một nút gốc đã publish", () => {
    expect(() => assertNavInvariants([], "vi")).toThrow(/nút gốc/i);
  });
});

describe("firstLeafHref", () => {
  it("trả lá đầu tiên theo thứ tự, dùng khi ai đó mở thẳng URL của nút chứa", () => {
    const t = buildNavTree([
      row({ id: "r" }),
      row({ id: "c1", parentId: "r", order: 1, kind: "DOC", href: "/vi/docs/b" }),
      row({ id: "c0", parentId: "r", order: 0, kind: "DOC", href: "/vi/docs/a" }),
    ], "vi", "vi");
    expect(firstLeafHref(t[0])).toBe("/vi/docs/a");
  });
  it("nút chứa không có lá nào thì trả null", () => {
    expect(firstLeafHref({ id: "x", kind: "CONTAINER", label: "x", href: null, isFallback: false, children: [] })).toBeNull();
  });
});

describe("findTrail", () => {
  it("trả đường từ gốc tới nút chứa href — để biết tab nào mở và mở sẵn nhánh nào", () => {
    const t = buildNavTree([
      row({ id: "r" }), row({ id: "m", parentId: "r" }),
      row({ id: "leaf", parentId: "m", kind: "APP", href: "/vi/apps/x" }),
    ], "vi", "vi");
    expect(findTrail(t, "/vi/apps/x").map(n => n.id)).toEqual(["r", "m", "leaf"]);
  });
});
