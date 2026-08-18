# Ducker — cây điều hướng và giao diện v3 · Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Chuyển điều hướng từ chrome viết cứng sang một cây do CMS quản, đổi ngôn ngữ thị giác sang hướng tài liệu Claude Code với bậc cỡ đo được, và đổi tên dự án thành Ducker.

**Architecture:** Một bảng `NavNode` tự tham chiếu. Nút gốc (`parentId = null`) chính là dải tab trên cùng; con cháu là sidebar trái. Ba loại nút: `CONTAINER` chỉ gom và toggle, `APP`/`DOC` luôn là lá và mang nội dung. URL giữ phẳng — cây chỉ điều khiển hiển thị điều hướng.

**Tech Stack:** Next.js 16 · React 19 · TypeScript 5 · Tailwind v4 · Prisma 7 · PostgreSQL · Vitest · Playwright

**Spec:** [`../specs/2026-08-18-ducker-navigation-tree-design.md`](../specs/2026-08-18-ducker-navigation-tree-design.md)

**Mockup đã duyệt:** [`../../design/mockups/v3/index.html`](../../design/mockups/v3/index.html) — khi tài liệu và mockup mâu thuẫn, **mockup thắng**.

**Trạng thái:** hoàn thành 18.08.2026. Ba chỗ làm khác kế hoạch, cả ba đều vì kế hoạch sai:

- Task 9 Step 1 viết `/vi/docs/tich-hop-oauth`; slug thật là `oauth-integration-guide`. Slug sai không làm test đỏ — trang 404 đạt mọi assertion về vùng bấm — nên bài quét sẽ báo xanh mà không kiểm gì. Đã đổi slug và thêm một assertion `status() === 200`.
- Task 9 Step 3 dùng `prisma migrate reset --force`; Prisma 7 chặn lệnh này khi phát hiện tác nhân AI và đòi câu đồng ý nguyên văn của người dùng. Đã kiểm seed trên một database rỗng khác trong cùng container rồi `DROP DATABASE`, cho cùng bằng chứng mà không xoá gì.
- Task 9 Step 4 nói dùng `npm run dev`; đã dùng `npm run start` trên bản build sạch, vì `next dev` ghi lại `.next` mà e2e ngay sau đó cần bản build.

---

## Global Constraints

**Môi trường**
- Máy Windows, Node 20+, npm. `DATABASE_URL` **có sẵn** cho dev cục bộ: Postgres trong Docker `app-store-doc-pg` ở cổng 15433, đã migrate và seed. `.env` đã cấu hình.
- ⚠️ **Dấu `$` trong `.env` phải escape thành `\$`.** Next expand biến, hash bcrypt sẽ bị cắt. Nháy đơn không cứu được.
- ⚠️ **Prisma CLI 7, vitest và tsx đều không đọc `.env`** — chỉ Next đọc. Với ba cái kia phải đặt biến trong chính phiên shell.
- ⚠️ **Đổi `next.config.ts` hay `.env` thì phải khởi động lại `next dev`.** Hot reload không nạp được.

**Ngôn ngữ**
- Nội dung, chú thích mã, thông điệp commit: **tiếng Việt**. Định danh trong mã: **tiếng Anh**.

**Ranh giới kiến trúc — vi phạm là lỗi, có test canh**
- Component không bao giờ `import prisma`, `import` Auth.js, hay `import` SDK S3.
- `src/server/content/` là nơi duy nhất chạm Prisma; `src/server/auth/` nơi duy nhất biết Auth.js; `src/server/media/` nơi duy nhất biết R2.
- **Mọi server action ghi dữ liệu gọi `await requireAdmin()` ở DÒNG ĐẦU TIÊN.** Bảo vệ layout không bảo vệ action.

**Thiết kế**
- **Không webfont.** Không `next/font`, không Google Fonts, không `@font-face`.
- **Georgia bị cấm** trong mọi font stack — thiếu glyph tiếng Việt dựng sẵn, `ế` ra dấu rời.
- Thân bài `font-size: 16px`, `line-height: 1.75`. **Không văn xuôi nào dưới 14px.** Ngoại lệ duy nhất: nhãn mono VIẾT HOA ở 11–11.5px.
- Mọi phần tử bấm được `min-height`/`min-width` ≥ `var(--tap)` = 28px. WCAG 2.2 SC 2.5.8 đòi 24×24.
- Mọi màu qua biến CSS. Không màu nào chỉ khai báo trong `@media`/`[data-theme]`.
- Ba trạng thái chủ đề: `:root` · `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` · `:root[data-theme="dark"]`.
- Tên hiển thị ứng dụng viết hoa đầu từ; slug repo chỉ ở vai phụ, chữ mono, màu `--muted`.
- **Một repo là một dự án** — cặp client/api là một bản ghi `App`, hiện hai liên kết repo.

**Kiểm thử**
- `vitest` **không** typecheck. Sau mỗi task chạy `npx tsc --noEmit` **riêng**.
- Vitest song song flaky trên máy này. Luôn `--maxWorkers=1`. Test component dùng `fireEvent`, **không** `userEvent.type`.
- Test cần DB đặt trong `*.db.test.ts`, mở đầu `describe.skipIf(!process.env.DATABASE_URL_TEST)`.
- ⚠️ **Bộ test xanh KHÔNG bắt được lỗi CSS.** Selector `.shiki` sai từng sống sót qua 108 test vì CSS không khớp thì không báo lỗi. Task cuối bắt buộc **chạy app thật và xem tận mắt**.

**Commit:** mỗi task một commit, thông điệp tiếng Việt theo Conventional Commits.

---

## Cấu trúc file

| Đường dẫn | Trách nhiệm | Trạng thái |
|---|---|---|
| `src/styles/tokens.css` | Bảng màu v3 + bậc cỡ + `--tap` | Sửa |
| `src/styles/globals.css` | Tiêu đề serif, thân bài 16px | Sửa |
| `docs/design/design-rules.md` | §2 màu, §3 chữ viết lại | Sửa |
| `prisma/schema.prisma` | `NavNode`, `NavNodeTranslation`, enum `NavKind`; xoá `DocPage.group` | Sửa |
| `prisma/migrations/0002_nav_tree/migration.sql` | DDL + CHECK + chuyển dữ liệu | Tạo |
| `src/server/content/nav.ts` | Thuần: dựng cây, tìm đường, kiểm bất biến | Tạo |
| `src/server/content/queries.ts` | `getNavTree`, `getUnlinkedContent` | Sửa |
| `src/server/content/mutations.ts` | CRUD nút, chốt I2 khi xoá App/DocPage | Sửa |
| `src/components/ui/OrderControls.tsx` | Bộ bốn nút thứ tự, dùng ở 4 chỗ | Tạo |
| `src/components/docs/NavTree.tsx` | Cây điều hướng công khai | Tạo |
| `src/components/docs/TopBar.tsx` | Masthead + dải tab từ cây | Sửa |
| `src/components/admin/NavEditor.tsx` | Trình soạn cây | Tạo |
| `src/app/[locale]/(admin)/admin/(protected)/navigation/page.tsx` | Trang trình soạn | Tạo |
| `src/app/[locale]/(public)/n/[id]/route.ts` | Chuyển hướng CONTAINER tới con đầu | Tạo |
| `prisma/seed.ts` | Dựng cây seed | Sửa |
| `e2e/a11y-tap-target.spec.ts` | Quét vùng bấm < 24×24 | Tạo |

---

## Task 1: Token, bậc cỡ và quy tắc thiết kế

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/globals.css`, `docs/design/design-rules.md`
- Test: `src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: không
- Produces: biến CSS `--bg --surface --fill --fill-soft --line --line-soft --ink --ink-2 --muted --accent --eyebrow --accent-bg --tap`, bậc cỡ `--t-2xs --t-xs --t-sm --t-md --t-lg --t-xl --t-2xl --t-3xl --t-4xl`, `--serif`.

**Nguồn giá trị:** chép **nguyên văn** khối `:root`, `@media` và `:root[data-theme="dark"]` từ `docs/design/mockups/v3/index.html`. Mockup là bản đã duyệt.

- [x] **Step 1: Viết test mới, thêm vào cuối `src/styles/tokens.test.ts`**

```ts
describe("bậc cỡ và vùng bấm v3", () => {
  it("thân bài 16px — chuẩn của 4/5 trang docs lớn đã đo", () => {
    expect(/--t-md:\s*16px/.test(css)).toBe(true);
  });

  it("có token --tap cho ngưỡng bấm WCAG 2.2 SC 2.5.8", () => {
    const tap = Number(/--tap:\s*(\d+)px/.exec(css)![1]);
    expect(tap).toBeGreaterThanOrEqual(24);
  });

  it("có phông serif cho tiêu đề", () => {
    expect(css).toMatch(/--serif:/);
  });

  it("Georgia KHÔNG có trong stack serif — thiếu glyph tiếng Việt dựng sẵn", () => {
    const serif = /--serif:([^;]+);/.exec(css)![1];
    expect(serif).not.toMatch(/Georgia/i);
  });

  it("token đổi vai theo chủ đề: --eyebrow có ở cả ba khối", () => {
    expect(css.match(/--eyebrow:/g)!.length).toBe(3);
  });

  it("không còn màu tím của bản cũ", () => {
    expect(css).not.toMatch(/#4B2ED4|#9B7CFF/i);
  });
});
```

- [x] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/styles/tokens.test.ts --maxWorkers=1`
Expected: FAIL — `--t-md: 16px` chưa có, `--tap` chưa có, `--serif` chưa có.

- [x] **Step 3: Viết lại `tokens.css`**

Chép nguyên văn từ mockup v3. Giữ nguyên cấu trúc ba khối chủ đề hiện có. Xoá mọi token tím cũ.

- [x] **Step 4: Sửa `globals.css`**

```css
h1, h2, h3 {
  font-family: var(--serif);
  font-weight: 400;      /* trang tham chiếu để 400, không phải 700 */
  letter-spacing: 0;     /* bỏ hẳn tracking âm cũ */
  line-height: var(--lh-head);
  text-wrap: balance;
}
body { font-size: var(--t-md); line-height: var(--lh-body); }
```

Giữ nguyên khối `.shiki` / `code[data-theme]` đã có — **đừng đụng vào**, nó vừa được sửa và có test canh.

- [x] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run src/styles --maxWorkers=1` → PASS
Run: `npx tsc --noEmit` → sạch

- [x] **Step 6: Viết lại `design-rules.md` §2 và §3**

Chép bảng màu và bậc cỡ từ spec §8.1, §8.2, §8.2.1, §8.2.2. Thêm mục cấm Georgia kèm lý do. Thêm mục `--tap`.

- [x] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: bảng màu v3, tiêu đề serif và bậc cỡ đo từ năm trang docs"
```

---

## Task 2: Đổi tên Ducker

**Files:**
- Modify: `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`, `README.md`, `CLAUDE.md`, `docs/status.md`, `docs/operations.md`, `prisma/seed.ts`
- Test: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: không
- Produces: `brand.name = "Ducker"` ở cả hai locale.

- [x] **Step 1: Viết test**

```ts
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
```

- [x] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/i18n --maxWorkers=1` → FAIL, giá trị hiện là "Atlas".

- [x] **Step 3: Đổi trong hai file messages, rồi trong tài liệu và seed**

Slug repo và tên package **không đổi** — `app-store-doc` vẫn là tên kho mã. Chỉ đổi tên hiển thị.

- [x] **Step 4: Kiểm tra và commit**

```bash
npx vitest run src/i18n --maxWorkers=1

# Loại ba nhóm tự tham chiếu, nếu không lệnh này không bao giờ rỗng được:
#  - mockups/ là ảnh chụp lịch sử của quyết định cũ, giữ nguyên để đối chiếu
#  - spec và plan ghi lại chính quyết định "đổi từ Atlas sang Ducker"
#  - messages.test.ts bắt buộc chứa regex /\bAtlas\b/ vì đó là thứ nó kiểm
grep -rn "Atlas" src/ docs/ README.md CLAUDE.md prisma/ \
  | grep -v mockups | grep -v "docs/superpowers/" | grep -v "messages.test.ts"   # phải rỗng

git add -A && git commit -m "feat: đổi tên hiển thị dự án thành Ducker"
```

---

## Task 3: Data model cây điều hướng

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/0002_nav_tree/migration.sql`
- Test: `prisma/schema.test.ts`

**Interfaces:**
- Consumes: không
- Produces: model `NavNode`, `NavNodeTranslation`, enum `NavKind { CONTAINER APP DOC }`. `DocPage.group` **bị xoá**.

Schema chép **nguyên văn** từ spec §3.1.

- [x] **Step 1: Viết test**

```ts
describe("cây điều hướng", () => {
  it("NavNode tự tham chiếu để lồng sâu tuỳ ý", () => {
    const block = schema.slice(schema.indexOf("model NavNode {"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toMatch(/parentId\s+String\?/);
    expect(body).toMatch(/children\s+NavNode\[\]/);
  });

  it("một App hoặc DocPage chỉ gắn vào đúng một nút — ép bằng @unique (I4)", () => {
    const block = schema.slice(schema.indexOf("model NavNode {"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toMatch(/appId\s+String\?\s+@unique/);
    expect(body).toMatch(/docPageId\s+String\?\s+@unique/);
  });

  it("nhãn nút chứa có bảng dịch riêng — thay cho DocPage.group không dịch được", () => {
    const block = schema.slice(schema.indexOf("model NavNodeTranslation {"));
    expect(block.slice(0, block.indexOf("\n}"))).toContain("@@unique([nodeId, locale])");
  });

  it("DocPage.group đã bị xoá", () => {
    const block = schema.slice(schema.indexOf("model DocPage {"));
    expect(block.slice(0, block.indexOf("\n}"))).not.toMatch(/^\s*group\s/m);
  });

  it("migration ép kind khớp với cột trỏ", () => {
    const sql2 = readFileSync("prisma/migrations/0002_nav_tree/migration.sql", "utf8");
    expect(sql2).toContain("nav_node_kind_matches_target");
  });

  it("migration chuyển group thành CONTAINER TRƯỚC khi drop cột", () => {
    const sql2 = readFileSync("prisma/migrations/0002_nav_tree/migration.sql", "utf8");
    const insert = sql2.indexOf('INSERT INTO "NavNode"');
    const drop = sql2.indexOf('DROP COLUMN "group"');
    expect(insert).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(insert);   // đảo thứ tự là mất sạch thông tin nhóm
  });
});
```

- [x] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run prisma/schema.test.ts --maxWorkers=1` → FAIL.

- [x] **Step 3: Sửa schema, sinh migration offline**

```bash
mkdir -p prisma/migrations/0002_nav_tree
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datasource prisma.config.ts --script \
  -o prisma/migrations/0002_nav_tree/migration.sql
```

Nếu cờ trên không chạy trên Prisma 7.9, dùng lối đã dùng cho `0001_init`:
`npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script` rồi cắt lấy phần chênh lệch. **Kiểm file sinh ra không rỗng** — `migrate diff` thất bại âm thầm, in chuỗi rỗng và vẫn thoát mã 0.

- [x] **Step 4: Nối tay CHECK constraint và bước chuyển dữ liệu**

Chèn **trước** lệnh `DROP COLUMN "group"`:

```sql
-- Mỗi giá trị group cũ thành một nút chứa, giữ tên ở locale mặc định.
INSERT INTO "NavNode" ("id","parentId","order","status","kind")
SELECT gen_random_uuid()::text, NULL, 0, 'PUBLISHED', 'CONTAINER'
FROM (SELECT DISTINCT "group" FROM "DocPage" WHERE "group" IS NOT NULL) g;
-- (bản đầy đủ gắn nhãn và gắn lá — xem spec §11)
```

Rồi nối vào cuối file:

```sql
ALTER TABLE "NavNode" ADD CONSTRAINT nav_node_kind_matches_target CHECK (
  ("kind" = 'CONTAINER' AND "appId" IS NULL AND "docPageId" IS NULL) OR
  ("kind" = 'APP'       AND "appId" IS NOT NULL AND "docPageId" IS NULL) OR
  ("kind" = 'DOC'       AND "appId" IS NULL AND "docPageId" IS NOT NULL)
);
```

- [x] **Step 5: Chạy migration lên DB dev và kiểm tra**

```bash
DATABASE_URL="postgresql://postgres:devpass@localhost:15433/app_store_doc" npx prisma migrate deploy
npx prisma generate
npx vitest run prisma/schema.test.ts --maxWorkers=1
npx tsc --noEmit
```

`tsc` sẽ báo lỗi ở mọi chỗ còn đọc `DocPage.group` — đó là ý đồ, sửa hết.

- [x] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: model cây điều hướng NavNode, xoá DocPage.group"
```

---

## Task 4: Dựng cây và kiểm bất biến (thuần)

**Files:**
- Create: `src/server/content/nav.ts`
- Test: `src/server/content/nav.test.ts`

**Interfaces:**
- Consumes: Task 3 (`NavKind`), `resolveTranslation` từ `./resolve`
- Produces:
  - `type NavRow` — chép nguyên văn từ spec §6
  - `type NavTreeNode = { id: string; kind: NavKind; label: string; href: string | null; isFallback: boolean; children: NavTreeNode[] }`
  - `buildNavTree(rows: NavRow[], locale: string, fallback: string): NavTreeNode[]`
  - `findTrail(tree: NavTreeNode[], href: string): NavTreeNode[]`
  - `firstLeafHref(node: NavTreeNode): string | null`
  - `assertNavInvariants(rows: NavRow[], defaultLocale: string): void`
  - `wouldCreateCycle(rows: NavRow[], nodeId: string, newParentId: string | null): boolean`

- [x] **Step 1: Viết test**

```ts
import { describe, it, expect } from "vitest";
import { buildNavTree, findTrail, firstLeafHref, wouldCreateCycle, assertNavInvariants } from "./nav";

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
```

- [x] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/server/content/nav.test.ts --maxWorkers=1` → FAIL, không import được `./nav`.

- [x] **Step 3: Cài đặt `nav.ts`**

`buildNavTree` phải chịu được dữ liệu xấu: nút mồ côi bị bỏ, và **phải phát hiện chu trình rồi ném lỗi** thay vì lặp vô hạn.

⚠️ **Sửa so với bản đầu của kế hoạch này:** tập `visited` khi đi **xuống** từ nút gốc *không bao giờ* bắt được chu trình. Mỗi nút chỉ có một cha, nên nút nằm trong vòng không có tổ tiên nào là nút gốc — cả vòng đơn giản là **không tới được**, cây vẫn dựng xong và dữ liệu lặng lẽ mất tích. Phải đi **lên** theo chuỗi cha của từng dòng (có memo để giữ O(n)). Tập `visited` khi đi xuống vẫn nên giữ làm chốt cuối, kèm chú thích nói rõ nó không bao giờ chặn thật.

Phân biệt cố ý hai loại dữ liệu xấu: **mồ côi bị bỏ im lặng** (phần điều hướng còn lại vẫn hiện được), **chu trình thì ném lỗi** (nó là dấu hiệu dữ liệu đã hỏng, không phải một nhánh thiếu).

- [x] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/server/content/nav.test.ts --maxWorkers=1` → PASS toàn bộ
Run: `npx tsc --noEmit` → sạch

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: dựng cây điều hướng và sáu bất biến, thuần không chạm DB"
```

---

## Task 5: Truy vấn và ghi cây

**Files:**
- Modify: `src/server/content/queries.ts`, `src/server/content/mutations.ts`
- Test: `src/server/content/nav.db.test.ts`

**Interfaces:**
- Consumes: Task 4 (`buildNavTree`, `assertNavInvariants`, `wouldCreateCycle`, `NavTreeNode`), `tags` từ `./tags`
- Produces:
  - `getNavTree(locale: string): Promise<NavTreeNode[]>` — bọc `unstable_cache`, tag `nav`
  - `getNavRows(): Promise<NavRow[]>` — không cache, cho trình soạn
  - `getUnlinkedContent(): Promise<{ apps: AppCard[]; docs: { slug: string; title: string }[] }>` — không cache
  - `createNavNode`, `updateNavNode`, `deleteNavNode`, `moveNavNode`, `reorderSiblings` trong `mutations.ts`

- [x] **Step 1: Viết test có cổng DB**

```ts
const hasDb = Boolean(process.env.DATABASE_URL_TEST);

describe.skipIf(!hasDb)("ghi cây điều hướng (cần DATABASE_URL_TEST)", () => {
  it("moveNavNode giữ đúng thứ tự anh em", async () => { /* chèn vào giữa, kiểm order 0,1,2 */ });
  it("xoá nút còn con bị chặn", async () => { /* onDelete Restrict */ });
  it("gắn một App vào hai nút bị chặn bởi @unique (I4)", async () => { /* kỳ vọng P2002 */ });
  it("kéo nút vào hậu duệ của nó bị chặn (I3)", async () => { /* kỳ vọng lỗi tiếng Việt */ });

  it("xoá App làm nút chứa rỗng thì nút chứa tự hạ xuống DRAFT", async () => {
    // Cascade xoá nút lá mà KHÔNG qua tầng kiểm, nên deleteApp phải tự kiểm lại cha.
  });
});

describe("getNavTree khi không có DB", () => {
  it("trả mảng rỗng để next build vẫn chạy", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { getNavTree } = await import("./queries");
    expect(await getNavTree("vi")).toEqual([]);
    if (saved) process.env.DATABASE_URL = saved;
  });
});
```

- [x] **Step 2: Chạy test, xác nhận nhóm cần DB skip và nhóm còn lại fail**

- [x] **Step 3: Cài đặt truy vấn và ghi**

Mọi hàm ghi: `assertNavInvariants` trước khi ghi, `wouldCreateCycle` trước khi đổi cha, rồi `revalidateTag(tags.nav())`. Đổi `status` hoặc gắn/gỡ nội dung thì thêm `tags.appsList()` và `tags.searchIndex()`.

**Chốt lỗ hổng I2:** sửa `deleteApp` và `deleteDocPage` — sau khi xoá, đọc lại cha của nút vừa bị cascade; nếu cha là `CONTAINER` đang `PUBLISHED` mà không còn con publish nào, tự hạ xuống `DRAFT` và trả về cờ để giao diện báo cho người dùng biết.

- [x] **Step 4: Kiểm tra và commit**

```bash
npx vitest run src/server/content --maxWorkers=1
npx tsc --noEmit
git add -A && git commit -m "feat: truy vấn và ghi cây điều hướng, chốt lỗ hổng I2 khi cascade"
```

---

## Task 6: Bộ nút thứ tự

**Files:**
- Create: `src/components/ui/OrderControls.tsx`, `src/components/ui/OrderControls.module.css`
- Test: `src/components/ui/OrderControls.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`--tap`)
- Produces: `<OrderControls index={number} total={number} onMove={(to: "top"|"up"|"down"|"bottom") => void} labels={{top,up,down,bottom}} />`

- [x] **Step 1: Viết test — dùng `fireEvent`, KHÔNG dùng `userEvent`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OrderControls } from "./OrderControls";

const labels = { top: "Đưa lên đầu", up: "Lên một bậc", down: "Xuống một bậc", bottom: "Đưa xuống cuối" };

describe("OrderControls", () => {
  it("bốn nút đều là <button> thật để dùng được bằng bàn phím", () => {
    render(<OrderControls index={1} total={3} onMove={() => {}} labels={labels} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("phần tử đầu: ⤒ và ↑ bị vô hiệu — không nút nào bấm vào mà không xảy ra gì", () => {
    render(<OrderControls index={0} total={3} onMove={() => {}} labels={labels} />);
    expect(screen.getByRole("button", { name: labels.top })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.up })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.down })).toBeEnabled();
  });

  it("phần tử cuối: ↓ và ⤓ bị vô hiệu", () => {
    render(<OrderControls index={2} total={3} onMove={() => {}} labels={labels} />);
    expect(screen.getByRole("button", { name: labels.bottom })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.down })).toBeDisabled();
  });

  it("chỉ một phần tử thì cả bốn nút vô hiệu", () => {
    render(<OrderControls index={0} total={1} onMove={() => {}} labels={labels} />);
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
  });

  it("bấm ⤒ gọi onMove('top')", () => {
    const onMove = vi.fn();
    render(<OrderControls index={2} total={3} onMove={onMove} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.top }));
    expect(onMove).toHaveBeenCalledWith("top");
  });

  it("bấm ⤓ gọi onMove('bottom')", () => {
    const onMove = vi.fn();
    render(<OrderControls index={0} total={3} onMove={onMove} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.bottom }));
    expect(onMove).toHaveBeenCalledWith("bottom");
  });

  it("không viết mã màu trực tiếp", () => {
    const { container } = render(<OrderControls index={1} total={3} onMove={() => {}} labels={labels} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
```

- [x] **Step 2: Chạy test, xác nhận fail, rồi cài đặt**

CSS: mỗi nút `min-width: var(--tap); min-height: var(--tap);`. Nút vô hiệu giảm `opacity` và đặt `disabled`, **không** chỉ đổi màu.

- [x] **Step 3: Kiểm tra và commit**

```bash
npx vitest run src/components/ui --maxWorkers=1
npx tsc --noEmit
git add -A && git commit -m "feat: bộ bốn nút thứ tự, dùng được bằng bàn phím và đạt ngưỡng bấm"
```

---

## Task 7: Điều hướng công khai

**Files:**
- Create: `src/components/docs/NavTree.tsx` (+ `.module.css`), `src/app/[locale]/(public)/n/[id]/route.ts`
- Modify: `src/components/docs/TopBar.tsx`, `src/components/docs/Sidebar.tsx`, `src/app/[locale]/(public)/layout.tsx`
- Test: `src/components/docs/NavTree.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`NavTreeNode`, `findTrail`, `firstLeafHref`), Task 5 (`getNavTree`)
- Produces: `<NavTree nodes={NavTreeNode[]} activeHref={string} />`

**Bắt buộc đọc `docs/design/mockups/v3/index.html` mục 02 trước khi viết.**

- [x] **Step 1: Viết test**

```tsx
const tree = [{
  id: "r", kind: "CONTAINER" as const, label: "Vệ tinh", href: null, isFallback: false,
  children: [
    { id: "a", kind: "APP" as const, label: "Match CV", href: "/vi/apps/match-cv", isFallback: false, children: [] },
    { id: "c", kind: "CONTAINER" as const, label: "Công cụ nhỏ", href: null, isFallback: false, children: [
      { id: "b", kind: "APP" as const, label: "Calculate Badminton", href: "/vi/apps/badminton", isFallback: false, children: [] },
    ]},
  ],
}];

describe("NavTree", () => {
  it("nút chứa là <button> toggle, KHÔNG phải liên kết", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(screen.getByRole("button", { name: /Vệ tinh/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Vệ tinh/ })).toBeNull();
  });

  it("nút lá là liên kết, KHÔNG toggle", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/match-cv" />);
    expect(screen.getByRole("link", { name: "Match CV" })).toHaveAttribute("href", "/vi/apps/match-cv");
  });

  it("lồng được ba tầng", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/badminton" />);
    expect(screen.getByRole("link", { name: "Calculate Badminton" })).toBeInTheDocument();
  });

  it("nhánh chứa mục đang xem được mở sẵn", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/badminton" />);
    expect(screen.getByRole("button", { name: /Công cụ nhỏ/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("bấm nút chứa thì đóng nhánh lại", () => {
    render(<NavTree nodes={tree} activeHref="/vi/apps/badminton" />);
    const b = screen.getByRole("button", { name: /Vệ tinh/ });
    fireEvent.click(b);
    expect(b).toHaveAttribute("aria-expanded", "false");
  });
});
```

- [x] **Step 2: Chạy test, xác nhận fail, rồi cài đặt**

`TopBar` dựng dải tab từ **nút gốc** của `getNavTree`; tab đang mở xác định bằng `findTrail`. `Sidebar` dựng từ con cháu của tab đang mở.

Route `/n/[id]` chuyển hướng nút chứa tới `firstLeafHref`; không có lá nào publish thì `notFound()`.

- [x] **Step 3: Kiểm tra và commit**

```bash
npx vitest run src/components --maxWorkers=1
npx tsc --noEmit && npm run build
git add -A && git commit -m "feat: dải tab và sidebar dựng từ cây, không còn viết cứng"
```

---

## Task 8: Trình soạn cây

**Files:**
- Create: `src/app/[locale]/(admin)/admin/(protected)/navigation/page.tsx`, `src/components/admin/NavEditor.tsx` (+ `.module.css`), `src/components/admin/NavNodeRow.tsx`
- Modify: `src/app/[locale]/(admin)/admin/actions.ts`, `src/components/admin/AdminShell.tsx`
- Test: `src/components/admin/NavEditor.test.tsx`

**Interfaces:**
- Consumes: Task 5 (mutations), Task 6 (`OrderControls`)
- Produces: trang `/admin/navigation` theo mockup mục 03.

- [x] **Step 1: Viết test**

```tsx
describe("NavEditor", () => {
  it("nút gốc hiển thị dưới nhãn dải tab", () => { /* getByText(/dải tab/i) */ });
  it("chọn nút chứa thì bảng thuộc tính KHÔNG có ô nội dung", () => { /* queryByLabelText(/nội dung/i) === null */ });
  it("bảng thuộc tính giải thích tại chỗ vì sao không có ô nội dung", () => { /* getByText(/chỉ làm nhiệm vụ mở đóng/i) */ });
  it("mỗi hàng có bộ bốn nút thứ tự", () => { /* within(row).getAllByRole("button") chứa 4 nhãn */ });
});
```

- [x] **Step 2: Chạy test, xác nhận fail, rồi cài đặt**

Thêm wrapper action cho `createNavNode`/`updateNavNode`/`deleteNavNode`/`moveNavNode`/`reorderSiblings` — **`await requireAdmin()` ở dòng đầu tiên**, không ngoại lệ.

Bật `ready: true` cho mục `navigation` trong `AdminShell`.

- [x] **Step 3: Kiểm tra và commit**

```bash
npx vitest run src/components/admin --maxWorkers=1
npx tsc --noEmit && npm run build
npx playwright test e2e/admin-auth.spec.ts   # ranh giới bảo mật phải còn xanh
git add -A && git commit -m "feat: trình soạn cây điều hướng trong CMS"
```

---

## Task 9: Seed, kiểm tiếp cận, và xem tận mắt

**Files:**
- Modify: `prisma/seed.ts`
- Create: `e2e/a11y-tap-target.spec.ts`
- Test: chạy toàn bộ

**Interfaces:**
- Consumes: mọi task trước

- [x] **Step 1: Viết e2e quét vùng bấm**

```ts
import { test, expect } from "@playwright/test";

const PAGES = ["/vi", "/vi/apps", "/vi/apps/web-store-apps", "/vi/docs/tich-hop-oauth"];

for (const path of PAGES) {
  test(`vùng bấm ở ${path} đạt 24x24 (WCAG 2.2 SC 2.5.8)`, async ({ page }) => {
    await page.goto(path);
    const small = await page.evaluate(() => {
      const sel = "a, button, input, select, [role=button]";
      return [...document.querySelectorAll(sel)]
        .filter(e => (e as HTMLElement).offsetParent !== null)
        .map(e => { const r = e.getBoundingClientRect();
          return { t: e.tagName, txt: (e.textContent || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter(x => x.h > 0 && (x.h < 24 || x.w < 24));
    });
    expect(small, JSON.stringify(small, null, 2)).toEqual([]);
  });

  test(`thân trang không cuộn ngang ở 375px — ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
```

- [x] **Step 2: Sửa `seed.ts` dựng cây**

Ba nút gốc: **Hệ sinh thái · Ứng dụng · Hướng dẫn**, mỗi nút có nhãn `vi` và `en`. Dưới *Ứng dụng* là hai nút chứa *Lõi* và *Vệ tinh*, gắn 6 app vào đúng chỗ. **Không seed tab "Tham chiếu"** — chưa có nội dung, mà I2 cấm publish nút chứa rỗng.

- [x] **Step 3: Chạy seed lên DB dev và kiểm toàn bộ**

```bash
DATABASE_URL="postgresql://postgres:devpass@localhost:15433/app_store_doc" npx prisma migrate reset --force
npx vitest run --maxWorkers=1
npx tsc --noEmit
npx eslint .
npm run build
```

- [x] **Step 4: XEM TẬN MẮT — bắt buộc, không bỏ qua**

Bộ test xanh **không** bắt được lỗi CSS. Khởi động lại dev server (đổi token thì hot reload không đủ), rồi chụp ảnh và **nhìn** từng màn ở **cả ba trạng thái chủ đề**:

```bash
# giết server cũ trước — nó không nạp lại tokens.css đã đổi
npm run dev
```

Kiểm bằng mắt: sáng · tối · theo hệ thống, ở 1440px và 375px, cho `/vi`, `/vi/apps/web-store-apps`, `/vi/docs/tich-hop-oauth`, `/vi/admin/navigation`, `/vi/admin/apps/web-store-apps`.

Danh sách phải xác nhận: tiêu đề là **serif weight 400**; thân bài **16px**; sidebar lồng đúng tầng và mũi xổ thấy được; dấu tiếng Việt (ế ữ ộ ằ) **không vỡ** trong tiêu đề; khối mã có màu; không màn nào cuộn ngang.

- [x] **Step 5: Chạy e2e**

```bash
npx playwright test
```

- [x] **Step 6: Cập nhật `docs/status.md` và commit**

```bash
git add -A && git commit -m "feat: seed cây điều hướng, test vùng bấm và kiểm giao diện tận mắt"
```

---

## Tự soát kế hoạch

**Phủ spec:** §3.1 model → Task 3 · §3.2 ba loại nút → Task 3, 4 · §3.3 xoá `group` → Task 3 · §3.4 `App.kind` thu hẹp → Task 7 · §4 sáu bất biến → Task 4 (thuần) + Task 5 (DB) · §4 lỗ hổng cascade I2 → Task 5 Step 3 · §5 URL phẳng và chuyển hướng container → Task 7 · §6 tầng truy vấn → Task 4, 5 · §7 trình soạn → Task 8 · §7.1 bộ nút thứ tự → Task 6 · §8.1 màu → Task 1 · §8.2 chữ → Task 1 · §8.2.1 bậc cỡ → Task 1 · §8.2.2 vùng bấm → Task 1 (token), Task 6 (áp), Task 9 (test quét) · §9 đổi tên → Task 2 · §10 một repo một dự án → Task 7 · §11 migration và seed → Task 3, 9 · §12 kiểm thử → rải khắp, chốt ở Task 9.

**Chỗ chưa phủ và lý do:** không có. Mọi mục trong "Định nghĩa hoàn thành" của spec đều có task tương ứng.

**Nhất quán tên gọi:** `buildNavTree` · `findTrail` · `firstLeafHref` · `assertNavInvariants` · `wouldCreateCycle` · `getNavTree` · `getNavRows` · `getUnlinkedContent` · `createNavNode` / `updateNavNode` / `deleteNavNode` / `moveNavNode` / `reorderSiblings` · `OrderControls` với `onMove(to)` nhận `"top"|"up"|"down"|"bottom"` · `NavTreeNode` · `NavRow` · `NavKind`. Đã đối chiếu giữa khối Interfaces và mã ví dụ ở mọi task.
