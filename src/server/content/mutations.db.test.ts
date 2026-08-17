// src/server/content/mutations.db.test.ts
//
// Kiểm mô hình "cấu trúc và bản dịch là hai chuyện khác nhau" trên DB thật.
// Quy tắc thuần đã có test không cần DB ở `resolve.test.ts` (`planContentSave`);
// file này canh phần chỉ DB mới trả lời được: bản dịch của ngôn ngữ **khác** có
// còn nguyên sau khi lưu một ngôn ngữ thiếu bản dịch hay không.
//
// Cần `DATABASE_URL_TEST` nên nó **skip** ở máy không có DB. Skip không phải là
// xanh: coi như chưa chạy.
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL_TEST);

// Tầng nội dung đọc `DATABASE_URL`; test trỏ nó vào DB test trước khi import.
if (hasDb) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const SLUG = "mutations-db-test-app";

describe.skipIf(!hasDb)("saveFeatures / saveSections (cần DATABASE_URL_TEST)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/server/db");
    await prisma.app.deleteMany({ where: { slug: SLUG } });
    await prisma.app.create({
      data: { slug: SLUG, kind: "SATELLITE", status: "DRAFT", techStack: [] },
    });
  });

  afterAll(async () => {
    const { prisma } = await import("@/server/db");
    await prisma.app.deleteMany({ where: { slug: SLUG } });
  });

  it("lưu bản EN thiếu tiêu đề thì mục vẫn còn và bản VI không mất — đó là cách dịch dần", async () => {
    const { saveFeatures } = await import("./mutations");
    const { prisma } = await import("@/server/db");

    await saveFeatures({
      appSlug: SLUG,
      locale: "vi",
      features: [{ order: 0, title: "Đăng nhập OTP" }, { order: 1, title: "Magic link" }],
    });

    // Lượt lưu bản EN: mới dịch được mục đầu, mục thứ hai còn trống.
    await saveFeatures({
      appSlug: SLUG,
      locale: "en",
      features: [
        { order: 0, id: await firstFeatureId(), title: "OTP sign-in" },
        { order: 1, id: await secondFeatureId(), title: "" },
      ],
    });

    const rows = await prisma.feature.findMany({
      where: { app: { slug: SLUG } },
      orderBy: { order: "asc" },
      include: { translations: true },
    });

    // Cấu trúc không đổi: thiếu bản dịch không xoá mục.
    expect(rows).toHaveLength(2);
    expect(rows[1].translations.map((t) => t.locale)).toEqual(["vi"]);
    expect(rows[1].translations[0].title).toBe("Magic link");
    expect(rows[0].translations.map((t) => t.locale).sort()).toEqual(["en", "vi"]);
  });

  it("mục vắng mặt khỏi danh sách gửi lên mới bị xoá", async () => {
    const { saveFeatures } = await import("./mutations");
    const { prisma } = await import("@/server/db");

    await saveFeatures({
      appSlug: SLUG,
      locale: "vi",
      features: [{ order: 0, id: await firstFeatureId(), title: "Đăng nhập OTP" }],
    });

    expect(await prisma.feature.count({ where: { app: { slug: SLUG } } })).toBe(1);
  });

  it("mục nội dung: anchor và thứ tự dùng chung, tiêu đề theo từng ngôn ngữ", async () => {
    const { saveSections } = await import("./mutations");
    const { prisma } = await import("@/server/db");

    await saveSections({
      owner: { appSlug: SLUG },
      locale: "vi",
      sections: [
        { order: 0, anchor: "la-gi", title: "Là gì", body: { type: "markdown", content: "…" } },
      ],
    });

    const before = await prisma.section.findFirst({ where: { app: { slug: SLUG } } });

    await saveSections({
      owner: { appSlug: SLUG },
      locale: "en",
      sections: [
        {
          order: 0,
          id: before!.id,
          anchor: "la-gi",
          title: "",
          body: { type: "markdown", content: "" },
        },
      ],
    });

    const after = await prisma.section.findFirst({
      where: { app: { slug: SLUG } },
      include: { translations: true },
    });

    expect(after!.id).toBe(before!.id);
    expect(after!.anchor).toBe("la-gi");
    expect(after!.translations.map((t) => t.locale)).toEqual(["vi"]);
  });
});

/** Id của tính năng đầu tiên — dùng lại giữa các bước, tránh gõ cứng cuid. */
async function firstFeatureId(): Promise<string> {
  const { prisma } = await import("@/server/db");
  const rows = await prisma.feature.findMany({
    where: { app: { slug: SLUG } },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return rows[0].id;
}

async function secondFeatureId(): Promise<string> {
  const { prisma } = await import("@/server/db");
  const rows = await prisma.feature.findMany({
    where: { app: { slug: SLUG } },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return rows[1].id;
}
