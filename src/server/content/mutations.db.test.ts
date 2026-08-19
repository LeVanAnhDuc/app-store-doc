// src/server/content/mutations.db.test.ts
//
// Kiểm mô hình "cấu trúc và bản dịch là hai chuyện khác nhau" trên DB thật.
// Quy tắc thuần đã có test không cần DB ở `resolve.test.ts` (`planContentSave`);
// file này canh phần chỉ DB mới trả lời được: bản dịch của ngôn ngữ **khác** có
// còn nguyên sau khi lưu một ngôn ngữ thiếu bản dịch hay không.
//
// Cần `DATABASE_URL_TEST` nên nó **skip** ở máy không có DB. Skip không phải là
// xanh: coi như chưa chạy.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// `unstable_cache` và `revalidateTag` đòi store của một lượt render Next, không
// có trong vitest — thiếu khối này thì mọi test cần DB ở đây đổ với
// "Invariant: incrementalCache missing" chứ không phải vì mã sai.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
}));

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

/**
 * Thứ tự ngôn ngữ. Bảng `Locale` là bảng dùng chung của cả bộ test — nó tới từ
 * seed, không phải do file này dựng ra — nên mọi test dưới đây **trả lại đúng
 * thứ tự cũ** ở `afterAll`. Thêm một ngôn ngữ thứ ba đang tắt để phép sắp có
 * thứ để sắp kể cả khi DB test mới chỉ có `vi` và `en`: với hai dòng thì "đưa
 * lên đầu" và "lên một bậc" cho cùng một kết quả, và một test không phân biệt
 * được hai thứ đó thì không chứng minh được gì.
 */
const TEST_LOCALE = "zz";

describe.skipIf(!hasDb)("reorderLocales (cần DATABASE_URL_TEST)", () => {
  /** Thứ tự lúc đầu, để trả lại nguyên trạng. */
  let original: { code: string; order: number }[] = [];

  beforeAll(async () => {
    const { prisma } = await import("@/server/db");
    original = await prisma.locale.findMany({ select: { code: true, order: true } });
    await prisma.locale.deleteMany({ where: { code: TEST_LOCALE } });
    await prisma.locale.create({
      data: { code: TEST_LOCALE, label: "Ngôn ngữ chỉ có trong test", enabled: false, order: 99 },
    });
  });

  afterAll(async () => {
    const { prisma } = await import("@/server/db");
    await prisma.locale.deleteMany({ where: { code: TEST_LOCALE } });
    for (const row of original) {
      await prisma.locale.update({ where: { code: row.code }, data: { order: row.order } });
    }
  });

  it("ghi order liên tục 0..n-1 theo đúng thứ tự gửi lên, và bảng quản trị đọc lại đúng thứ tự đó", async () => {
    const { reorderLocales } = await import("./mutations");
    const { listLocalesForAdmin } = await import("./queries");

    const codes = (await listLocalesForAdmin()).map((row) => row.code);
    const reversed = [...codes].reverse();

    await reorderLocales(reversed);

    const after = await listLocalesForAdmin();
    expect(after.map((row) => row.code)).toEqual(reversed);
    // Liên tục, không lỗ hổng: bộ nút thứ tự tính "lên một bậc" bằng chỉ số.
    expect(after.map((row) => row.order)).toEqual(after.map((_, index) => index));
  });

  it("sắp lại thứ tự không đụng tới mặc định và bật/tắt — hai bất biến của §6.4 còn nguyên", async () => {
    const { reorderLocales } = await import("./mutations");
    const { listLocalesForAdmin } = await import("./queries");

    const before = await listLocalesForAdmin();
    const flagsOf = (rows: typeof before) =>
      [...rows]
        .map((row) => `${row.code}:${row.isDefault}:${row.enabled}`)
        .sort();

    await reorderLocales([...before.map((row) => row.code)].reverse());

    expect(flagsOf(await listLocalesForAdmin())).toEqual(flagsOf(before));
  });

  it("danh sách thiếu một mã bị từ chối, và thứ tự trong DB không đổi", async () => {
    const { reorderLocales } = await import("./mutations");
    const { listLocalesForAdmin } = await import("./queries");

    const before = await listLocalesForAdmin();
    const short = before.map((row) => row.code).slice(1);

    await expect(reorderLocales(short)).rejects.toThrow(/hãy tải lại trang/i);
    expect((await listLocalesForAdmin()).map((row) => row.code)).toEqual(
      before.map((row) => row.code),
    );
  });

  it("mã lặp bị từ chối trước khi chạm DB", async () => {
    const { reorderLocales } = await import("./mutations");
    const { listLocalesForAdmin } = await import("./queries");

    const before = await listLocalesForAdmin();
    const doubled = [before[0].code, ...before.map((row) => row.code)];

    await expect(reorderLocales(doubled)).rejects.toThrow(/bị lặp/);
    expect((await listLocalesForAdmin()).map((row) => row.code)).toEqual(
      before.map((row) => row.code),
    );
  });

  it("mã không tồn tại bị từ chối và người dùng đọc được mã đó, không đọc lỗi Prisma", async () => {
    const { reorderLocales } = await import("./mutations");
    const { listLocalesForAdmin } = await import("./queries");

    const before = await listLocalesForAdmin();
    const swapped = ["qq", ...before.map((row) => row.code).slice(1)];

    let message = "";
    try {
      await reorderLocales(swapped);
    } catch (error) {
      message = String(error);
    }

    expect(message).toMatch(/không tồn tại \(qq\)/);
    expect(message).not.toMatch(/P20\d\d/);
    expect((await listLocalesForAdmin()).map((row) => row.code)).toEqual(
      before.map((row) => row.code),
    );
  });
});
