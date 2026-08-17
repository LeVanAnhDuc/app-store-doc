// src/server/content/queries.db.test.ts
import { describe, it, expect, beforeAll } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL_TEST);

describe.skipIf(!hasDb)("truy vấn nội dung (cần DATABASE_URL_TEST)", () => {
  beforeAll(async () => { /* migrate reset + seed dữ liệu mẫu */ });

  it("listApps trả tên hiển thị, không trả slug", async () => {
    const { listApps } = await import("./queries");
    const apps = await listApps("vi");
    expect(apps.find(a => a.slug === "web-store-apps")!.name).toBe("Web Store Apps");
  });

  it("getApp lùi về locale mặc định khi thiếu bản dịch", async () => {
    const { getApp } = await import("./queries");
    const app = await getApp("web-store-apps", "en");
    expect(app!.sections.some(s => s.isFallback)).toBe(true);
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
