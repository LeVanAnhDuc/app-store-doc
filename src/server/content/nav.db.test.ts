// src/server/content/nav.db.test.ts
//
// Cây điều hướng ở phần **chỉ DB mới trả lời được**: `order` của anh em có còn
// liên tục sau khi chèn, `@unique` có thật sự chặn việc gắn một App vào hai nút,
// `onDelete: Restrict` có thật sự chặn xoá nút còn con, và — quan trọng nhất —
// cascade của `onDelete: Cascade` có để lại một nút chứa rỗng đã publish hay không.
//
// Quy tắc thuần của cây (dựng cây, tìm đường, sáu bất biến) đã có test không cần
// DB ở `nav.test.ts`; file này không lặp lại chúng.
//
// Cần `DATABASE_URL_TEST` nên nhóm chính **skip** ở máy không có DB. Skip không
// phải là xanh: coi như chưa chạy.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

import type { NavRow, NavTreeNode } from "./nav";

/**
 * `next/cache` đòi "store" của một lượt render Next.
 *
 * `unstable_cache` ném `Invariant: incrementalCache missing` và `revalidateTag`
 * ném `Invariant: static generation store missing` khi gọi ngoài request của
 * Next — tức là **mọi** hàm của tầng nội dung đều không chạy được dưới vitest nếu
 * không thay `next/cache`. Thay bằng bản đi thẳng (`unstable_cache` trả về đúng
 * hàm nhận vào) chứ không bỏ trống: cái đang được kiểm ở đây là truy vấn và phép
 * ghi, còn cache là hành vi của Next và nó có test riêng ở tầng Next.
 */
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
}));

const hasDb = Boolean(process.env.DATABASE_URL_TEST);

// Tầng nội dung đọc `DATABASE_URL`; test trỏ nó vào DB test. Đặt được ở đây (chứ
// không cần `await import`) vì `@/server/db` khởi tạo client trễ: nó chỉ đọc biến
// môi trường ở truy vấn đầu tiên, không đọc lúc nạp module.
if (hasDb) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { prisma } from "@/server/db";
import {
  createNavNode,
  deleteApp,
  deleteDocPage,
  deleteNavNode,
  moveNavNode,
  reorderSiblings,
  updateNavNode,
  assertNavTreeValid,
} from "./mutations";
import { getNavRows, getNavTree, getUnlinkedContent } from "./queries";

/** Mọi bản ghi do test tạo ra đều mang tiền tố này để dọn dẹp không đụng dữ liệu seed. */
const PREFIX = "navdbtest";

/** Id nút do test tạo, dọn theo thứ tự con-trước-cha. */
const createdNodeIds: string[] = [];

function track(id: string): string {
  createdNodeIds.push(id);
  return id;
}

async function createApp(name: string): Promise<string> {
  const app = await prisma.app.create({
    data: {
      slug: `${PREFIX}-${name}`,
      kind: "SATELLITE",
      status: "PUBLISHED",
      techStack: [],
      translations: { create: [{ locale: "vi", name: `App ${name}` }] },
    },
    select: { id: true },
  });
  return app.id;
}

async function createDoc(name: string): Promise<string> {
  const doc = await prisma.docPage.create({
    data: {
      slug: `${PREFIX}-${name}`,
      status: "PUBLISHED",
      translations: { create: [{ locale: "vi", title: `Trang ${name}` }] },
    },
    select: { id: true },
  });
  return doc.id;
}

async function createContainer(label: string, parentId: string | null = null): Promise<string> {
  const node = await createNavNode({
    parentId,
    kind: "CONTAINER",
    labels: [{ locale: "vi", label: `${PREFIX} ${label}` }],
  });
  return track(node.id);
}

/** Một nút lá DOC kèm trang tài liệu của nó. */
async function createDocLeaf(parentId: string, name: string): Promise<string> {
  const docPageId = await createDoc(name);
  const node = await createNavNode({ parentId, kind: "DOC", docPageId });
  return track(node.id);
}

function findById(nodes: NavTreeNode[], id: string): NavTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const deeper = findById(node.children, id);
    if (deeper) return deeper;
  }
  return null;
}

function siblingsOf(rows: NavRow[], parentId: string | null): NavRow[] {
  return rows.filter((row) => row.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** Lỗi của một promise, dạng chuỗi — để kiểm cả câu tiếng Việt lẫn thứ *không* được lộ ra. */
async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "";
  } catch (error) {
    return String(error);
  }
}

async function cleanup(): Promise<void> {
  // Xoá nội dung trước: cascade lấy luôn nút lá gắn với nó, nên phần còn lại chỉ
  // là nút chứa.
  await prisma.app.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.docPage.deleteMany({ where: { slug: { startsWith: PREFIX } } });

  // Nút chứa phải xoá con trước cha (`onDelete: Restrict`), nên lặp cho tới khi
  // không còn nút nào không con.
  for (let round = 0; round < 10; round += 1) {
    const nodes = await prisma.navNode.findMany({
      where: { id: { in: createdNodeIds } },
      select: { id: true, _count: { select: { children: true } } },
    });
    const leaves = nodes.filter((node) => node._count.children === 0).map((node) => node.id);
    if (leaves.length === 0) break;
    await prisma.navNode.deleteMany({ where: { id: { in: leaves } } });
  }

  createdNodeIds.length = 0;
}

describe.skipIf(!hasDb)("truy vấn và ghi cây điều hướng (cần DATABASE_URL_TEST)", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("getNavTree dựng cây từ DB: nút chứa lồng nút lá, nhãn lấy từ nội dung", async () => {
    const appId = await createApp("cay-app");
    const containerId = await createContainer("Cụm cây");
    track((await createNavNode({ parentId: containerId, kind: "APP", appId, status: "PUBLISHED" })).id);
    await updateNavNode({ id: containerId, status: "PUBLISHED" });

    const container = findById(await getNavTree("vi"), containerId);

    expect(container).toMatchObject({
      kind: "CONTAINER",
      label: `${PREFIX} Cụm cây`,
      href: null,
    });
    expect(container!.children).toHaveLength(1);
    expect(container!.children[0]).toMatchObject({
      kind: "APP",
      label: "App cay-app",
      href: `/vi/apps/${PREFIX}-cay-app`,
    });
  });

  it("getNavTree bỏ nút nháp, getNavRows thì không — trình soạn phải thấy bản nháp", async () => {
    const containerId = await createContainer("Cụm nháp");

    expect(findById(await getNavTree("vi"), containerId)).toBeNull();

    const row = (await getNavRows()).find((candidate) => candidate.id === containerId);
    expect(row).toMatchObject({ status: "DRAFT", kind: "CONTAINER", href: null });
    expect(row!.labels).toEqual([{ locale: "vi", value: `${PREFIX} Cụm nháp` }]);
  });

  it("getNavRows không cache: nút vừa tạo hiện ra ngay ở lượt đọc kế tiếp", async () => {
    const before = await getNavRows();
    const containerId = await createContainer("Cụm không cache");
    const after = await getNavRows();

    expect(after).toHaveLength(before.length + 1);
    expect(after.some((row) => row.id === containerId)).toBe(true);
  });

  it("gắn một App vào nút thứ hai bị chặn, và người dùng đọc được lý do chứ không đọc P2002 (I4)", async () => {
    const appId = await createApp("i4");
    const containerId = await createContainer("Cụm I4");
    track((await createNavNode({ parentId: containerId, kind: "APP", appId })).id);

    const message = await messageOf(createNavNode({ parentId: containerId, kind: "APP", appId }));

    expect(message).toMatch(/đã nằm ở một nút khác/);
    expect(message).not.toMatch(/P2002/);
    expect((await getNavRows()).filter((row) => row.parentId === containerId)).toHaveLength(1);
  });

  it("publish một nút chứa rỗng bị chặn (I2)", async () => {
    const containerId = await createContainer("Cụm rỗng");

    await expect(updateNavNode({ id: containerId, status: "PUBLISHED" })).rejects.toThrow(/rỗng/i);
    expect((await getNavRows()).find((row) => row.id === containerId)?.status).toBe("DRAFT");
  });

  it("publish một nút chứa chưa có nhãn ở locale mặc định bị chặn (I5)", async () => {
    const containerId = track((await createNavNode({ kind: "CONTAINER" })).id);
    await createDocLeaf(containerId, "i5-con");
    await updateNavNode({ id: (await getNavRows()).filter((r) => r.parentId === containerId)[0].id, status: "PUBLISHED" });

    await expect(updateNavNode({ id: containerId, status: "PUBLISHED" })).rejects.toThrow(/nhãn/i);
  });

  it("moveNavNode chèn vào giữa và giữ order anh em liên tục 0..n-1", async () => {
    const parentId = await createContainer("Cụm thứ tự");
    const first = await createDocLeaf(parentId, "thu-tu-a");
    const second = await createDocLeaf(parentId, "thu-tu-b");
    const third = await createDocLeaf(parentId, "thu-tu-c");

    await moveNavNode({ id: third, parentId, index: 1 });

    const siblings = siblingsOf(await getNavRows(), parentId);
    expect(siblings.map((row) => row.id)).toEqual([first, third, second]);
    expect(siblings.map((row) => row.order)).toEqual([0, 1, 2]);
  });

  it("moveNavNode đổi cha thì vá lại order ở CẢ chỗ mới lẫn chỗ cũ", async () => {
    const oldParentId = await createContainer("Cụm cho");
    const newParentId = await createContainer("Cụm nhận");
    const stay = await createDocLeaf(oldParentId, "o-lai-a");
    const move = await createDocLeaf(oldParentId, "chuyen-di");
    const alsoStay = await createDocLeaf(oldParentId, "o-lai-b");

    await moveNavNode({ id: move, parentId: newParentId, index: 0 });

    const rows = await getNavRows();
    expect(siblingsOf(rows, oldParentId).map((row) => row.id)).toEqual([stay, alsoStay]);
    expect(siblingsOf(rows, oldParentId).map((row) => row.order)).toEqual([0, 1]);
    expect(siblingsOf(rows, newParentId).map((row) => row.id)).toEqual([move]);
    expect(siblingsOf(rows, newParentId).map((row) => row.order)).toEqual([0]);
  });

  it("kéo một nút vào hậu duệ của chính nó bị chặn và không ghi gì (I3)", async () => {
    const outerId = await createContainer("Cụm ngoài I3");
    const innerId = await createContainer("Cụm trong I3", outerId);

    const message = await messageOf(moveNavNode({ id: outerId, parentId: innerId, index: 0 }));

    expect(message).toMatch(/hậu duệ/i);
    expect((await getNavRows()).find((row) => row.id === outerId)?.parentId).toBeNull();
  });

  it("xoá nút còn con bị chặn, kèm câu giải thích thay vì lỗi Prisma thô", async () => {
    const parentId = await createContainer("Cụm còn con");
    await createContainer("Cụm con", parentId);

    const message = await messageOf(deleteNavNode(parentId));

    expect(message).toMatch(/còn 1 nút con/);
    expect(message).not.toMatch(/P20\d\d/);
  });

  it("xoá một nút lá thì order của anh em còn lại khép lại liền mạch", async () => {
    const parentId = await createContainer("Cụm xoá giữa");
    const first = await createDocLeaf(parentId, "xoa-a");
    const middle = await createDocLeaf(parentId, "xoa-b");
    const last = await createDocLeaf(parentId, "xoa-c");

    await deleteNavNode(middle);

    const siblings = siblingsOf(await getNavRows(), parentId);
    expect(siblings.map((row) => row.id)).toEqual([first, last]);
    expect(siblings.map((row) => row.order)).toEqual([0, 1]);
  });

  it("reorderSiblings sắp lại theo danh sách đầy đủ, và từ chối danh sách đã cũ", async () => {
    const parentId = await createContainer("Cụm sắp lại");
    const first = await createDocLeaf(parentId, "sap-a");
    const second = await createDocLeaf(parentId, "sap-b");

    await reorderSiblings({ parentId, ids: [second, first] });
    expect(siblingsOf(await getNavRows(), parentId).map((row) => row.id)).toEqual([second, first]);

    await expect(reorderSiblings({ parentId, ids: [first] })).rejects.toThrow(/tải lại trang/);
  });

  it("xoá App làm nút chứa rỗng thì nút chứa tự hạ xuống DRAFT và nói ra chuyện đó", async () => {
    // Cascade xoá nút lá mà KHÔNG đi qua tầng kiểm, nên `deleteApp` phải tự đọc
    // lại cha. Không có bước đó thì còn lại một nút chứa rỗng đã publish — đúng
    // thứ I2 cấm, mà không có gì báo lỗi.
    const appId = await createApp("i2-cascade");
    const containerId = await createContainer("Cụm I2");
    track((await createNavNode({ parentId: containerId, kind: "APP", appId, status: "PUBLISHED" })).id);
    await updateNavNode({ id: containerId, status: "PUBLISHED" });

    const result = await deleteApp(appId);

    expect(result.slug).toBe(`${PREFIX}-i2-cascade`);
    expect(result.demotedContainers).toEqual([
      { id: containerId, label: `${PREFIX} Cụm I2` },
    ]);

    const rows = await getNavRows();
    expect(rows.find((row) => row.id === containerId)?.status).toBe("DRAFT");
    expect(rows.some((row) => row.parentId === containerId)).toBe(false);
  });

  it("xoá DocPage hạ cả chuỗi nút chứa vừa thành rỗng, không chỉ một tầng", async () => {
    const outerId = await createContainer("Cụm ngoài I2");
    const innerId = await createContainer("Cụm trong I2", outerId);
    const docPageId = await createDoc("i2-long");
    const leafId = track((await createNavNode({ parentId: innerId, kind: "DOC", docPageId, status: "PUBLISHED" })).id);
    await updateNavNode({ id: innerId, status: "PUBLISHED" });
    await updateNavNode({ id: outerId, status: "PUBLISHED" });

    const result = await deleteDocPage(docPageId);

    // Thứ tự là thứ tự đi lên: nút trong trước, rồi tới nút ngoài vừa thành rỗng.
    expect(result.demotedContainers.map((container) => container.label)).toEqual([
      `${PREFIX} Cụm trong I2`,
      `${PREFIX} Cụm ngoài I2`,
    ]);

    const rows = await getNavRows();
    expect(rows.find((row) => row.id === innerId)?.status).toBe("DRAFT");
    expect(rows.find((row) => row.id === outerId)?.status).toBe("DRAFT");
    expect(rows.some((row) => row.id === leafId)).toBe(false);
  });

  it("getUnlinkedContent liệt kê nội dung chưa gắn nút, và thôi liệt kê ngay khi đã gắn", async () => {
    const appId = await createApp("chua-gan");
    const docPageId = await createDoc("chua-gan");

    const before = await getUnlinkedContent();
    expect(before.apps.map((app) => app.slug)).toContain(`${PREFIX}-chua-gan`);
    expect(before.docs.map((doc) => doc.slug)).toContain(`${PREFIX}-chua-gan`);
    // `home` cố tình không có route nên không bao giờ được nhắc gắn vào cây.
    expect(before.docs.map((doc) => doc.slug)).not.toContain("home");

    const containerId = await createContainer("Cụm gắn");
    track((await createNavNode({ parentId: containerId, kind: "APP", appId })).id);
    track((await createNavNode({ parentId: containerId, kind: "DOC", docPageId })).id);

    const after = await getUnlinkedContent();
    expect(after.apps.map((app) => app.slug)).not.toContain(`${PREFIX}-chua-gan`);
    expect(after.docs.map((doc) => doc.slug)).not.toContain(`${PREFIX}-chua-gan`);
  });
});

// ---------------------------------------------------------------------------
// Không cần DB
// ---------------------------------------------------------------------------

const row = (overrides: Partial<NavRow> & { id: string }): NavRow => ({
  parentId: null,
  order: 0,
  status: "PUBLISHED",
  kind: "CONTAINER",
  labels: [{ locale: "vi", value: overrides.id }],
  href: null,
  ...overrides,
});

describe("assertNavTreeValid", () => {
  it("cây rỗng: nút đầu tiên không bị I6 chặn — nếu không thì không cách nào dựng cây", () => {
    expect(() => assertNavTreeValid([], [row({ id: "a", status: "DRAFT" })], "vi")).not.toThrow();
  });

  it("cây chưa có cửa vào: publish một lá dưới nút chứa nháp cũng không bị I6 chặn", () => {
    const before = [row({ id: "c", status: "DRAFT" })];
    const after = [
      row({ id: "c", status: "DRAFT" }),
      row({ id: "leaf", parentId: "c", kind: "DOC", href: "/vi/docs/x" }),
    ];
    expect(() => assertNavTreeValid(before, after, "vi")).not.toThrow();
  });

  it("miễn I6 KHÔNG có nghĩa là miễn I2: nút chứa rỗng vẫn không publish được", () => {
    expect(() => assertNavTreeValid([], [row({ id: "a" })], "vi")).toThrow(/rỗng/i);
  });

  it("cây đang có cửa vào thì I6 kiểm đủ: hạ nút gốc publish cuối cùng bị chặn", () => {
    const before = [
      row({ id: "r" }),
      row({ id: "leaf", parentId: "r", kind: "DOC", href: "/vi/docs/x" }),
    ];
    const after = [
      row({ id: "r", status: "DRAFT" }),
      row({ id: "leaf", parentId: "r", kind: "DOC", href: "/vi/docs/x" }),
    ];
    expect(() => assertNavTreeValid(before, after, "vi")).toThrow(/nút gốc/i);
  });
});

describe("cây điều hướng khi không có DB", () => {
  /** `next build` phải chạy được khi chưa cấu hình DB, nên ba hàm này trả rỗng. */
  async function withoutDatabase<T>(read: () => Promise<T>): Promise<T> {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      return await read();
    } finally {
      if (saved) process.env.DATABASE_URL = saved;
    }
  }

  it("getNavTree trả mảng rỗng để next build vẫn chạy", async () => {
    expect(await withoutDatabase(() => getNavTree("vi"))).toEqual([]);
  });

  it("getNavRows trả mảng rỗng", async () => {
    expect(await withoutDatabase(() => getNavRows())).toEqual([]);
  });

  it("getUnlinkedContent trả hai danh sách rỗng", async () => {
    expect(await withoutDatabase(() => getUnlinkedContent())).toEqual({ apps: [], docs: [] });
  });
});
