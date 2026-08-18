// src/server/content/queries.db.test.ts
import { describe, it, expect, beforeAll, vi } from "vitest";

// `unstable_cache` và `revalidateTag` đòi store của một lượt render Next, không
// có trong vitest — thiếu khối này thì mọi test cần DB ở đây đổ với
// "Invariant: incrementalCache missing" chứ không phải vì mã sai.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
}));

const hasDb = Boolean(process.env.DATABASE_URL_TEST);

// Tầng nội dung đọc `DATABASE_URL`; trỏ nó sang DB test TRƯỚC khi import.
// Thiếu dòng này thì `hasContentDatabase()` trả false, mọi truy vấn trả rỗng, và
// test đổ với "Cannot read properties of undefined" — trông như lỗi mã chứ không
// như lỗi cấu hình. Đây chính là lý do file này chưa từng chạy xanh với DB thật.
if (hasDb) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

// Nhóm test dưới đây dựa vào DB đã được seed (`prisma db seed`), không tự seed.

describe.skipIf(!hasDb)("truy vấn nội dung (cần DATABASE_URL_TEST)", () => {
  beforeAll(async () => { /* migrate reset + seed dữ liệu mẫu */ });

  it("listApps trả tên hiển thị, không trả slug", async () => {
    const { listApps } = await import("./queries");
    const apps = await listApps("vi");
    expect(apps.find(a => a.slug === "web-store-apps")!.name).toBe("Web Store Apps");
  });

  it("getApp lùi về locale mặc định khi thiếu bản dịch", async () => {
    const { getApp } = await import("./queries");
    // Hỏi bằng một locale KHÔNG có bản dịch nào. Không dùng "en" được: seed cung
    // cấp đủ cả `vi` và `en` cho mọi mục (bắt buộc, nếu không thì lưu từng phần
    // ngôn ngữ bị chặn), nên với "en" không có gì để lùi và `isFallback` toàn false.
    // Bản đầu của test này kỳ vọng "en" fallback — kỳ vọng đó viết theo một giả
    // định đã không còn đúng, và nó chưa từng chạy nên không ai thấy.
    const app = await getApp("web-store-apps", "ja");
    expect(app).not.toBeNull();
    expect(app!.sections.length).toBeGreaterThan(0);
    expect(app!.sections.every(s => s.isFallback)).toBe(true);
    expect(app!.isFallback).toBe(true);
    // Lùi về locale mặc định nghĩa là ra chữ tiếng Việt, KHÔNG phải ra slug.
    expect(app!.name).toBe("Web Store Apps");
  });

  it("getApp trả null với app chưa publish", async () => {
    const { getApp } = await import("./queries");
    expect(await getApp("shorten-link", "vi")).toBeNull();
  });
});

describe("getStaticSlugs khi không có DB", () => {
  it("trả danh sách rỗng để next build vẫn chạy", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { getStaticSlugs } = await import("./queries");
    expect(await getStaticSlugs()).toEqual({ apps: [], docs: [] });
    if (saved) process.env.DATABASE_URL = saved;
  });
});
