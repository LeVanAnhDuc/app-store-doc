# app-store-doc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang tài liệu công khai song ngữ cho hệ sinh thái ứng dụng, kèm CMS cho phép thêm/sửa/xoá nội dung mà không cần deploy lại.

**Architecture:** Next.js App Router full-stack. Trang công khai render tĩnh (SSG) và được làm mới bằng `revalidateTag` khi CMS ghi dữ liệu. Ba tầng `src/server/{content,auth,media}` là cửa duy nhất chạm Prisma / Auth.js / R2; component không bao giờ import chúng trực tiếp.

**Tech Stack:** Next.js 16 · React 19 · TypeScript 5 · Tailwind v4 · Prisma 7 · PostgreSQL (Neon) · Auth.js v5 · next-intl · Cloudflare R2 (`@aws-sdk/client-s3`) · Vitest · Playwright

**Spec:** [`docs/superpowers/specs/2026-08-17-app-store-doc-design.md`](../specs/2026-08-17-app-store-doc-design.md)

**Design rules (bắt buộc cho mọi task chạm UI):** [`docs/design/design-rules.md`](../../design/design-rules.md) · mockup đã duyệt: [`docs/design/mockups/index.html`](../../design/mockups/index.html)

---

## Global Constraints

Mọi task ngầm định phải thoả các ràng buộc dưới đây.

**Môi trường**
- Máy Windows. Shell là PowerShell hoặc Git Bash. Đường dẫn dùng `/` trong mã.
- Node 20+. Package manager: `npm`.
- **Không có kết nối database khi thực thi kế hoạch này.** `DATABASE_URL` chưa được cấp. Mọi thứ phải build và test được khi biến này vắng mặt. Xem "Chế độ không có DB" bên dưới.

**Ngôn ngữ**
- Nội dung, chú thích mã, thông điệp commit: **tiếng Việt**.
- Định danh trong mã (biến, hàm, kiểu, tên file): **tiếng Anh**.

**Ranh giới kiến trúc — vi phạm là lỗi**
- Component không bao giờ `import prisma`, `import` Auth.js, hay `import` SDK S3.
- `src/server/content/` là nơi duy nhất chạm Prisma.
- `src/server/auth/` là nơi duy nhất biết Auth.js. Chỉ lộ ra `getCurrentUser()`, `requireAdmin()`, `signOut()`.
- `src/server/media/` là nơi duy nhất biết R2.
- **Mọi server action ghi dữ liệu gọi `requireAdmin()` ở dòng đầu tiên.** Bảo vệ layout không bảo vệ action.

**Thiết kế**
- Không webfont. Không `next/font`. Không Google Fonts.
- Thân bài `line-height: 1.75` (dấu tiếng Việt chồng nhau).
- Mọi màu qua biến CSS. Không màu nào chỉ khai báo trong `@media`/`[data-theme]`.
- Ba trạng thái chủ đề: `:root` (sáng), `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, `:root[data-theme="dark"]`.
- Tên ứng dụng hiển thị viết hoa đầu từ (**Manage Gym**), slug repo chỉ ở vai trò phụ, chữ mono, màu `--muted`.
- Bảng và khối mã bọc trong `overflow-x: auto`.

**Kiểm thử**
- `vitest` **không** typecheck. Sau mỗi task chạy `npx tsc --noEmit` **riêng**.
- Vitest song song hay flaky trên máy này. Test fail chưa được coi là fail thật cho tới khi lặp lại với `--maxWorkers=1`.
- Test component dùng `fireEvent`, **không** dùng `userEvent.type`.

**Chế độ không có DB**
- Test cần Postgres đặt trong `*.db.test.ts` và mở đầu bằng `describe.skipIf(!process.env.DATABASE_URL_TEST)`.
- `generateStaticParams` trả `[]` khi `process.env.DATABASE_URL` vắng mặt, để `next build` chạy được. `dynamicParams` để mặc định `true`.
- Migration SQL sinh **offline** bằng `prisma migrate diff`, không dùng `prisma migrate dev`.

**Commit:** mỗi task một commit, thông điệp tiếng Việt theo Conventional Commits.

---

## Cấu trúc file

| Đường dẫn | Trách nhiệm |
|---|---|
| `prisma/schema.prisma` | Toàn bộ data model |
| `prisma/migrations/0001_init/migration.sql` | DDL, gồm CHECK constraint cho `Section` |
| `prisma/seed.ts` | Seed 6 ứng dụng + 4 trang hướng dẫn + 2 locale |
| `src/lib/slug.ts` | `slugify`, `toAnchor` — thuần, không phụ thuộc |
| `src/lib/schemas.ts` | Toàn bộ Zod schema cho input server action |
| `src/lib/markdown.ts` | Markdown → HTML đã sanitize, tô màu mã |
| `src/lib/search-index.ts` | Dựng chỉ mục tìm kiếm từ nội dung (thuần) |
| `src/lib/fuzzy.ts` | So khớp mờ phía trình duyệt |
| `src/server/db.ts` | Singleton PrismaClient |
| `src/server/content/resolve.ts` | Thuần: fallback ngôn ngữ, dựng ToC, kiểm bất biến |
| `src/server/content/queries.ts` | Đọc dữ liệu, bọc `unstable_cache` |
| `src/server/content/mutations.ts` | Ghi dữ liệu + `revalidateTag` |
| `src/server/content/tags.ts` | Sinh tên cache tag |
| `src/server/auth/index.ts` | `getCurrentUser`, `requireAdmin`, `signOut` |
| `src/server/auth/providers/credentials.ts` | Cài đặt Auth.js hiện tại |
| `src/server/auth/rate-limit.ts` | Giới hạn số lần đăng nhập |
| `src/server/media/index.ts` | `uploadImage`, `deleteImage`, `listImages` |
| `src/server/media/mime.ts` | Nhận dạng định dạng bằng magic bytes (thuần) |
| `src/i18n/locales.generated.ts` | Danh sách locale sinh lúc prebuild |
| `src/i18n/messages/{vi,en}.json` | Chuỗi giao diện |
| `src/i18n/request.ts` | Cấu hình next-intl |
| `src/middleware.ts` | Định tuyến locale |
| `src/styles/tokens.css` | Toàn bộ biến CSS theo design-rules |
| `src/components/ui/*` | Badge, Chip, Callout, CodeBlock, DataTable, WireDiagram |
| `src/components/docs/*` | DocsShell, Sidebar, Toc, AppHero, FeatureGrid, SectionBody |
| `src/components/admin/*` | AdminShell, LocaleSwitch, SortableList, MarkdownEditor, MediaPicker |
| `src/app/[locale]/(public)/*` | Trang công khai |
| `src/app/[locale]/(admin)/admin/*` | CMS |
| `src/app/api/search-index/[locale]/route.ts` | Chỉ mục tìm kiếm có cache tag |
| `scripts/generate-locales.ts` | Sinh `locales.generated.ts` từ DB |
| `e2e/*.spec.ts` | Playwright |

---

## Task 1: Nền dự án và design token

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`
- Create: `src/styles/tokens.css`, `src/styles/globals.css`
- Create: `src/app/layout.tsx`
- Test: `src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: không
- Produces: script npm `dev`, `build`, `start`, `test`, `test:run`, `typecheck`, `lint`, `e2e`, `prebuild`. File `src/styles/tokens.css` chứa mọi biến màu và chữ mà các task sau dùng.

- [ ] **Step 1: Khởi tạo dự án**

```bash
npm init -y
npm i next@latest react@latest react-dom@latest
npm i -D typescript @types/react @types/react-dom @types/node
npm i -D tailwindcss @tailwindcss/postcss postcss
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm i -D @playwright/test
```

- [ ] **Step 2: Viết `src/styles/tokens.css` theo design-rules §2 và §3**

Sao chép nguyên văn bảng token từ `docs/design/design-rules.md`. Bố cục bắt buộc:

```css
:root {
  --bg: #FBFBFD; --surface: #FFFFFF; --surface-2: #F4F4F8;
  --line: #E3E3EC; --line-soft: #EEEEF4;
  --ink: #15151E; --muted: #6A6A7C;
  --accent: #4B2ED4; --accent-bg: #EEEBFC;
  --st-core: #4B2ED4;       --st-core-bg: #EEEBFC;
  --st-connected: #0E7C63;  --st-connected-bg: #E2F3EE;
  --st-standalone: #8A5A08; --st-standalone-bg: #F8EFDD;
  --st-planned: #6A6A7C;    --st-planned-bg: #EEEEF4;
  --st-private: #A82F49;    --st-private-bg: #FAE7EB;
  --sans: "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --mono: "Cascadia Mono", "Cascadia Code", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --lh-body: 1.75; --lh-head: 1.18;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* chỉ định nghĩa lại token, giá trị tối trong design-rules §2 */ }
}
:root[data-theme="dark"] { /* cùng bộ giá trị tối */ }
```

`src/styles/globals.css` đặt `body { background: var(--bg); color: var(--ink); font-family: var(--sans); line-height: var(--lh-body); }` và `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` và khối `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 3: Viết test kiểm bất biến của token**

```ts
// src/styles/tokens.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");

describe("design token", () => {
  it("định nghĩa bảng màu sáng đầy đủ ở :root trần", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf("@media"));
    for (const name of ["--bg","--surface","--line","--ink","--muted","--accent",
                        "--st-core","--st-connected","--st-standalone","--st-planned","--st-private"]) {
      expect(root).toContain(name);
    }
  });

  it("khối dark bọc bằng :root:not([data-theme=\"light\"])", () => {
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it("có khối [data-theme=\"dark\"] để nút chuyển thắng cả hai chiều", () => {
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it("mọi token khai báo trong khối tối đều đã có ở :root trần", () => {
    const light = css.slice(0, css.indexOf("@media"));
    const darkNames = [...css.slice(css.indexOf("@media")).matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]);
    for (const n of new Set(darkNames)) expect(light).toContain(`${n}:`);
  });

  it("không dùng webfont", () => {
    expect(css).not.toMatch(/@font-face|fonts\.googleapis|next\/font/);
  });

  it("leading thân bài không dưới 1.7 vì dấu tiếng Việt chồng nhau", () => {
    const lh = Number(/--lh-body:\s*([\d.]+)/.exec(css)![1]);
    expect(lh).toBeGreaterThanOrEqual(1.7);
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận fail trước khi có file**

Run: `npx vitest run src/styles/tokens.test.ts`
Expected: FAIL — `ENOENT: no such file or directory` nếu chưa viết `tokens.css`.

- [ ] **Step 5: Hoàn thiện `tokens.css` cho test xanh**

Run: `npx vitest run src/styles/tokens.test.ts`
Expected: PASS, 6 test.

- [ ] **Step 6: Viết `.env.example`**

```bash
DATABASE_URL=
DATABASE_URL_TEST=
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
PREVIEW_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 7: Kiểm tra build sạch**

Run: `npx tsc --noEmit` → Expected: không lỗi
Run: `npm run build` → Expected: build thành công dù `DATABASE_URL` trống

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: dựng nền dự án Next.js và design token"
```

---

## Task 2: Data model và migration offline

**Files:**
- Create: `prisma/schema.prisma`, `prisma/migrations/0001_init/migration.sql`, `prisma/migrations/migration_lock.toml`
- Create: `src/server/db.ts`
- Test: `prisma/schema.test.ts`

**Interfaces:**
- Consumes: Task 1 (npm scripts)
- Produces: kiểu Prisma Client `App`, `AppTranslation`, `Feature`, `FeatureTranslation`, `DocPage`, `DocPageTranslation`, `Section`, `SectionTranslation`, `Media`, `Locale`; enum `Status` (`DRAFT|PUBLISHED|ARCHIVED`), `AppKind` (`CORE|SATELLITE`). Export `prisma` từ `src/server/db.ts`.

- [ ] **Step 1: Cài Prisma**

```bash
npm i -D prisma@latest
npm i @prisma/client@latest
```

- [ ] **Step 2: Chép nguyên văn schema từ spec §6**

Sao chép khối `schema.prisma` trong `docs/superpowers/specs/2026-08-17-app-store-doc-design.md` §6, không sửa tên trường. Thêm khối đầu:

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql", url = env("DATABASE_URL") }
```

- [ ] **Step 3: Sinh migration offline (không cần DB)**

```bash
mkdir -p prisma/migrations/0001_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0001_init/migration.sql
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
```

- [ ] **Step 4: Thêm CHECK constraint vào cuối `migration.sql`**

`Section` thuộc về đúng một chủ sở hữu. Prisma không diễn đạt được, phải viết tay:

```sql
ALTER TABLE "Section" ADD CONSTRAINT section_single_owner
  CHECK (("appId" IS NULL) <> ("docPageId" IS NULL));
```

- [ ] **Step 5: Viết test kiểm schema và migration**

```ts
// prisma/schema.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const sql    = readFileSync("prisma/migrations/0001_init/migration.sql", "utf8");

describe("schema", () => {
  it("locale là dòng, không phải cột — mọi bảng dịch có unique (chủ, locale)", () => {
    for (const [model, fk] of [["AppTranslation","appId"],["FeatureTranslation","featureId"],
                               ["DocPageTranslation","docPageId"],["SectionTranslation","sectionId"]] as const) {
      const block = schema.slice(schema.indexOf(`model ${model} {`));
      expect(block.slice(0, block.indexOf("}"))).toContain(`@@unique([${fk}, locale])`);
    }
  });

  it("thân Section là Json để sau mở sang block-based", () => {
    const block = schema.slice(schema.indexOf("model SectionTranslation {"));
    expect(block.slice(0, block.indexOf("}"))).toMatch(/body\s+Json/);
  });

  it("xoá chủ sở hữu thì bản dịch xoá theo", () => {
    expect(schema.match(/onDelete: Cascade/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("migration có CHECK ràng buộc Section thuộc đúng một chủ", () => {
    expect(sql).toContain("section_single_owner");
    expect(sql).toMatch(/\("appId" IS NULL\)\s*<>\s*\("docPageId" IS NULL\)/);
  });
});
```

- [ ] **Step 6: Chạy test, xác nhận fail**

Run: `npx vitest run prisma/schema.test.ts`
Expected: FAIL trước khi có schema.

- [ ] **Step 7: Viết `src/server/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Chưa cấu hình DB thì trang tĩnh dựng rỗng thay vì làm hỏng build. */
export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
```

- [ ] **Step 8: Sinh client và kiểm tra**

Run: `npx prisma generate` → Expected: thành công, không cần DB
Run: `npx vitest run prisma/schema.test.ts` → Expected: PASS
Run: `npx tsc --noEmit` → Expected: không lỗi

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: data model Prisma và migration sinh offline"
```

---

## Task 3: Tiện ích thuần — slug, anchor, Zod

**Files:**
- Create: `src/lib/slug.ts`, `src/lib/schemas.ts`
- Test: `src/lib/slug.test.ts`, `src/lib/schemas.test.ts`

**Interfaces:**
- Consumes: Task 2 (enum `Status`, `AppKind`)
- Produces:
  - `slugify(input: string): string`
  - `toAnchor(title: string): string`
  - `ensureUniqueAnchors(anchors: string[]): { ok: true } | { ok: false; duplicate: string }`
  - `appInputSchema`, `featureInputSchema`, `sectionInputSchema`, `docPageInputSchema`, `localeInputSchema` (Zod), cùng kiểu suy ra `AppInput` v.v.

- [ ] **Step 1: Viết test cho slug và anchor**

```ts
// src/lib/slug.test.ts
import { describe, it, expect } from "vitest";
import { slugify, toAnchor, ensureUniqueAnchors } from "./slug";

describe("slugify", () => {
  it("bỏ dấu tiếng Việt", () => {
    expect(slugify("Chạy thử trong 5 phút")).toBe("chay-thu-trong-5-phut");
  });
  it("xử lý đ và Đ", () => {
    expect(slugify("Đăng nhập")).toBe("dang-nhap");
  });
  it("gộp khoảng trắng và ký tự lạ thành một gạch nối", () => {
    expect(slugify("Biến   môi  trường!!")).toBe("bien-moi-truong");
  });
  it("không để gạch nối thừa ở hai đầu", () => {
    expect(slugify("  --Là gì--  ")).toBe("la-gi");
  });
  it("chuỗi rỗng trả về rỗng", () => {
    expect(slugify("   ")).toBe("");
  });
});

describe("ensureUniqueAnchors", () => {
  it("chấp nhận danh sách không trùng", () => {
    expect(ensureUniqueAnchors(["la-gi", "quick-start"])).toEqual({ ok: true });
  });
  it("bắt được anchor trùng — trùng thì mục lục nhảy sai chỗ", () => {
    expect(ensureUniqueAnchors(["la-gi", "la-gi"])).toEqual({ ok: false, duplicate: "la-gi" });
  });
});

describe("toAnchor", () => {
  it("dùng lại slugify", () => {
    expect(toAnchor("Tính năng")).toBe("tinh-nang");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/slug.test.ts`
Expected: FAIL — không import được `./slug`.

- [ ] **Step 3: Cài đặt `src/lib/slug.ts`**

Dùng `String.prototype.normalize("NFD")` để tách dấu, rồi bỏ dải `\u0300-\u036f`. Xử lý riêng `đ`/`Đ` **trước** khi normalize vì NFD không tách được chúng.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/slug.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 5: Viết test cho Zod schema**

```ts
// src/lib/schemas.test.ts
import { describe, it, expect } from "vitest";
import { appInputSchema, sectionInputSchema } from "./schemas";

describe("appInputSchema", () => {
  it("từ chối slug có chữ hoa hoặc khoảng trắng", () => {
    expect(appInputSchema.safeParse({ slug: "Web Store Apps", kind: "CORE", status: "DRAFT" }).success).toBe(false);
  });
  it("nhận slug hợp lệ", () => {
    const r = appInputSchema.safeParse({ slug: "web-store-apps", kind: "CORE", status: "DRAFT" });
    expect(r.success).toBe(true);
  });
  it("techStack mặc định là mảng rỗng", () => {
    const r = appInputSchema.parse({ slug: "a", kind: "SATELLITE", status: "DRAFT" });
    expect(r.techStack).toEqual([]);
  });
});

describe("sectionInputSchema", () => {
  it("thân bài phải có discriminator type", () => {
    expect(sectionInputSchema.safeParse({ anchor: "a", title: "T", body: { content: "x" } }).success).toBe(false);
    expect(sectionInputSchema.safeParse({ anchor: "a", title: "T", body: { type: "markdown", content: "x" } }).success).toBe(true);
  });
});
```

- [ ] **Step 6: Chạy test, xác nhận fail, rồi cài đặt `src/lib/schemas.ts`**

```bash
npm i zod
```

`body` dùng `z.discriminatedUnion("type", [z.object({ type: z.literal("markdown"), content: z.string() })])` — union một nhánh là cố ý, để thêm `blocks` sau này không phải sửa chỗ gọi.

- [ ] **Step 7: Kiểm tra**

Run: `npx vitest run src/lib/ --maxWorkers=1` → Expected: PASS
Run: `npx tsc --noEmit` → Expected: không lỗi

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tiện ích slug/anchor và schema kiểm tra đầu vào"
```

---

## Task 4: Fallback ngôn ngữ và dựng mục lục

**Files:**
- Create: `src/server/content/resolve.ts`, `src/server/content/tags.ts`
- Test: `src/server/content/resolve.test.ts`

**Interfaces:**
- Consumes: Task 3 (`ensureUniqueAnchors`)
- Produces:
  - `type Translated<T> = { value: T; locale: string; isFallback: boolean }`
  - `resolveTranslation<T extends { locale: string }>(rows: T[], want: string, fallback: string): Translated<T> | null`
  - `buildToc(sections: { anchor: string; title: string }[]): { anchor: string; title: string }[]`
  - `assertSingleDefaultLocale(locales: { code: string; isDefault: boolean; enabled: boolean }[]): void` — ném lỗi nếu vi phạm
  - `tags.app(slug)`, `tags.doc(slug)`, `tags.nav()`, `tags.appsList()`, `tags.searchIndex()`

- [ ] **Step 1: Viết test**

```ts
// src/server/content/resolve.test.ts
import { describe, it, expect } from "vitest";
import { resolveTranslation, assertSingleDefaultLocale } from "./resolve";

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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run src/server/content/resolve.test.ts`
Expected: FAIL — không import được `./resolve`.

- [ ] **Step 3: Cài đặt `resolve.ts` và `tags.ts`**

`tags.ts` chỉ là hàm sinh chuỗi thuần: `app: (slug) => \`app:${slug}\`` v.v. Tách riêng để `mutations.ts` và `queries.ts` không bao giờ gõ tay tên tag lệch nhau.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx vitest run src/server/content/resolve.test.ts --maxWorkers=1`
Expected: PASS, 8 test.

- [ ] **Step 5: Kiểm tra kiểu và commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: fallback ngôn ngữ, dựng mục lục và cache tag"
```

---

## Task 5: Kết xuất Markdown an toàn

**Files:**
- Create: `src/lib/markdown.ts`
- Test: `src/lib/markdown.test.ts`

**Interfaces:**
- Consumes: không
- Produces: `renderMarkdown(md: string): Promise<string>` — trả HTML đã sanitize, khối mã đã tô màu.

- [ ] **Step 1: Cài phụ thuộc**

```bash
npm i unified remark-parse remark-gfm remark-rehype rehype-sanitize rehype-stringify rehype-pretty-code shiki
```

- [ ] **Step 2: Viết test**

```ts
// src/lib/markdown.test.ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("dựng tiêu đề và đoạn văn", async () => {
    expect(await renderMarkdown("## Tính năng\n\nNội dung.")).toContain("<h2");
  });

  it("loại bỏ thẻ script — nội dung hôm nay một người viết, mai nhiều người", async () => {
    const html = await renderMarkdown('Xin chào <script>alert(1)</script>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("loại bỏ handler nội tuyến", async () => {
    expect(await renderMarkdown('<img src="x" onerror="alert(1)">')).not.toContain("onerror");
  });

  it("chặn liên kết javascript:", async () => {
    expect(await renderMarkdown("[bấm](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("giữ bảng GFM", async () => {
    const html = await renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table");
  });

  it("tô màu khối mã", async () => {
    const html = await renderMarkdown("```bash\nnpm install\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("npm install");
  });

  it("giữ nguyên dấu tiếng Việt", async () => {
    expect(await renderMarkdown("Biến môi trường của ứng dụng")).toContain("Biến môi trường của ứng dụng");
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: FAIL.

- [ ] **Step 4: Cài đặt `renderMarkdown`**

Thứ tự pipeline bắt buộc: `remarkParse` → `remarkGfm` → `remarkRehype` → `rehypePrettyCode` → **`rehypeSanitize`** → `rehypeStringify`. Sanitize phải chạy **sau** khi tô màu; đảo thứ tự sẽ khiến sanitize xoá sạch thẻ `<span>` mà shiki vừa tạo. Mở rộng schema mặc định để cho phép `className` và `style` trên `span`/`code`/`pre`.

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx vitest run src/lib/markdown.test.ts --maxWorkers=1`
Expected: PASS, 7 test.

- [ ] **Step 6: Kiểm tra và commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: kết xuất markdown có sanitize và tô màu mã"
```

---

## Task 6: Chỉ mục tìm kiếm

**Files:**
- Create: `src/lib/search-index.ts`, `src/lib/fuzzy.ts`
- Create: `src/app/api/search-index/[locale]/route.ts`
- Test: `src/lib/search-index.test.ts`, `src/lib/fuzzy.test.ts`

**Interfaces:**
- Consumes: Task 4 (`tags.searchIndex`)
- Produces:
  - `type SearchDoc = { href: string; title: string; kind: "app" | "doc"; text: string }`
  - `buildSearchIndex(input: {...}): SearchDoc[]`
  - `stripMarkdown(md: string): string`
  - `fuzzyMatch(query: string, docs: SearchDoc[], limit?: number): SearchDoc[]`
  - Route `GET /api/search-index/[locale]` trả `SearchDoc[]`

- [ ] **Step 1: Viết test cho `stripMarkdown` và `buildSearchIndex`**

```ts
// src/lib/search-index.test.ts
import { describe, it, expect } from "vitest";
import { stripMarkdown, buildSearchIndex } from "./search-index";

describe("stripMarkdown", () => {
  it("bỏ ký hiệu tiêu đề và nhấn mạnh", () => {
    expect(stripMarkdown("## Tính năng\n\n**đậm** và *nghiêng*")).toBe("Tính năng đậm và nghiêng");
  });
  it("bỏ khối mã — lệnh shell làm nhiễu kết quả tìm", () => {
    expect(stripMarkdown("Chạy:\n\n```bash\nnpm install\n```\n\nXong.")).toBe("Chạy: Xong.");
  });
  it("giữ chữ trong liên kết, bỏ URL", () => {
    expect(stripMarkdown("[GitHub](https://github.com/a/b)")).toBe("GitHub");
  });
});

describe("buildSearchIndex", () => {
  const input = {
    apps: [{ slug: "web-store-apps", name: "Web Store Apps",
             sections: [{ title: "Là gì", body: "Giao diện của IDMS." }] }],
    docs: [{ slug: "tich-hop-oauth", title: "Tích hợp OAuth",
             sections: [{ title: "Luồng", body: "Năm bước." }] }],
    locale: "vi",
  };

  it("sinh href có tiền tố locale", () => {
    const idx = buildSearchIndex(input);
    expect(idx.map(d => d.href)).toEqual(["/vi/apps/web-store-apps", "/vi/docs/tich-hop-oauth"]);
  });

  it("dùng tên hiển thị làm tiêu đề, không dùng slug", () => {
    expect(buildSearchIndex(input)[0].title).toBe("Web Store Apps");
  });

  it("gộp nội dung mọi mục vào một chuỗi tìm được", () => {
    expect(buildSearchIndex(input)[0].text).toContain("Giao diện của IDMS");
    expect(buildSearchIndex(input)[0].text).toContain("Là gì");
  });
});
```

- [ ] **Step 2: Viết test cho `fuzzyMatch`**

```ts
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
```

- [ ] **Step 3: Chạy cả hai test, xác nhận fail, rồi cài đặt**

`fuzzyMatch` dùng lại cách bỏ dấu của `slugify` (Task 3) để tìm không dấu hoạt động — đây là yêu cầu thật với người dùng Việt gõ nhanh không bỏ dấu.

- [ ] **Step 4: Viết route handler**

```ts
// src/app/api/search-index/[locale]/route.ts
import { unstable_cache } from "next/cache";
import { tags } from "@/server/content/tags";
import { getSearchIndex } from "@/server/content/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const load = unstable_cache(() => getSearchIndex(locale), ["search-index", locale], {
    tags: [tags.searchIndex()],
  });
  return Response.json(await load());
}
```

> Chỉ mục **không** sinh lúc build. Sinh lúc build sẽ khiến kết quả tìm lệch với nội dung cho tới lần deploy sau, phá vỡ lời hứa "sửa là thấy ngay".

- [ ] **Step 5: Kiểm tra và commit**

```bash
npx vitest run src/lib/ --maxWorkers=1
npx tsc --noEmit
git add -A
git commit -m "feat: chỉ mục tìm kiếm có cache tag và so khớp không dấu"
```

---

## Task 7: Đa ngôn ngữ

**Files:**
- Create: `src/i18n/locales.generated.ts`, `src/i18n/request.ts`, `src/i18n/messages/vi.json`, `src/i18n/messages/en.json`
- Create: `src/middleware.ts`, `scripts/generate-locales.ts`
- Modify: `package.json` (thêm script `prebuild`)
- Test: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: Task 2 (`prisma`, `hasDatabase`)
- Produces: `locales: readonly string[]`, `defaultLocale: string` từ `locales.generated.ts`. Middleware định tuyến `/` → `/vi`.

- [ ] **Step 1: Cài next-intl và viết `locales.generated.ts` khởi điểm**

```bash
npm i next-intl
```

```ts
// src/i18n/locales.generated.ts — SINH TỰ ĐỘNG, đừng sửa tay
export const locales = ["vi", "en"] as const;
export const defaultLocale = "vi";
```

- [ ] **Step 2: Viết test tính toàn vẹn của chuỗi giao diện**

```ts
// src/i18n/messages.test.ts
import { describe, it, expect } from "vitest";
import vi from "./messages/vi.json";
import en from "./messages/en.json";
import { locales, defaultLocale } from "./locales.generated";

const flatten = (o: any, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? flatten(v, `${p}${k}.`) : [`${p}${k}`]);

describe("chuỗi giao diện", () => {
  it("vi và en có đúng cùng bộ khoá — thiếu khoá là deploy ra bản trống chữ", () => {
    expect(flatten(en).sort()).toEqual(flatten(vi).sort());
  });
  it("không giá trị nào rỗng", () => {
    for (const msgs of [vi, en]) {
      for (const key of flatten(msgs)) {
        const val = key.split(".").reduce<any>((a, k) => a[k], msgs);
        expect(val, key).not.toBe("");
      }
    }
  });
  it("locale mặc định nằm trong danh sách locale", () => {
    expect(locales).toContain(defaultLocale);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail, rồi viết hai file messages**

Khoá tối thiểu: `nav.ecosystem`, `nav.apps`, `nav.guides`, `nav.api`, `search.placeholder`, `search.empty`, `app.features`, `app.techStack`, `app.viewRepo`, `app.privateRepo`, `toc.title`, `fallback.notice`, `notFound.title`, `notFound.body`, `admin.save`, `admin.saved`, `admin.preview`, `admin.addFeature`, `admin.addSection`, `admin.missingTranslation`, `admin.signIn`, `admin.signOut`, `error.retry`.

- [ ] **Step 4: Viết `scripts/generate-locales.ts`**

Đọc bảng `Locale` (nếu `DATABASE_URL` có) và ghi đè `locales.generated.ts`. Không có DB thì **giữ nguyên file cũ** và in cảnh báo — không được ghi đè bằng mảng rỗng.

Thêm vào `package.json`: `"prebuild": "tsx scripts/generate-locales.ts"`.

- [ ] **Step 5: Viết middleware**

```ts
// src/middleware.ts
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/i18n/locales.generated";

export default createMiddleware({ locales, defaultLocale, localePrefix: "always" });
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
```

`localePrefix: "always"` là cố ý: SSG sinh URL tường minh, `hreflang` sạch, không có route mơ hồ giữa `/apps` và `/[locale]`.

- [ ] **Step 6: Kiểm tra và commit**

```bash
npx vitest run src/i18n --maxWorkers=1
npx tsc --noEmit
npm run build
git add -A
git commit -m "feat: đa ngôn ngữ với next-intl và danh sách locale sinh lúc build"
```

---

## Task 8: Tầng xác thực

**Files:**
- Create: `src/server/auth/index.ts`, `src/server/auth/providers/credentials.ts`, `src/server/auth/rate-limit.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Test: `src/server/auth/rate-limit.test.ts`, `src/server/auth/boundary.test.ts`

**Interfaces:**
- Consumes: không
- Produces:
  - `type SessionUser = { id: string; email: string; name?: string; roles: string[] }`
  - `getCurrentUser(): Promise<SessionUser | null>`
  - `requireAdmin(): Promise<SessionUser>` — `redirect("/admin/login")` nếu không phải admin
  - `signOut(): Promise<void>`
  - `checkRateLimit(key: string, now?: number): { allowed: boolean; retryAfterSec: number }`

- [ ] **Step 1: Cài Auth.js**

```bash
npm i next-auth@beta bcryptjs
npm i -D @types/bcryptjs
```

- [ ] **Step 2: Viết test giới hạn tần suất**

```ts
// src/server/auth/rate-limit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimit } from "./rate-limit";

beforeEach(() => __resetRateLimit());

describe("checkRateLimit", () => {
  it("cho phép 5 lần đầu", () => {
    for (let i = 0; i < 5; i++) expect(checkRateLimit("1.2.3.4", 0).allowed).toBe(true);
  });
  it("chặn lần thứ 6", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", 0);
    expect(checkRateLimit("1.2.3.4", 0).allowed).toBe(false);
  });
  it("mở lại sau 15 phút", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.2.3.4", 0);
    expect(checkRateLimit("1.2.3.4", 15 * 60_000 + 1).allowed).toBe(true);
  });
  it("đếm riêng theo từng IP", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.1.1.1", 0);
    expect(checkRateLimit("2.2.2.2", 0).allowed).toBe(true);
  });
  it("báo còn bao lâu mới thử lại được", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.2.3.4", 0);
    expect(checkRateLimit("1.2.3.4", 60_000).retryAfterSec).toBe(840);
  });
});
```

- [ ] **Step 3: Viết test ranh giới kiến trúc**

```ts
// src/server/auth/boundary.test.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

describe("ranh giới kiến trúc", () => {
  it("không component nào import prisma trực tiếp", () => {
    for (const f of walk("src/components")) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/from ["'].*server\/db["']|@prisma\/client/);
    }
  });
  it("không component nào import Auth.js trực tiếp", () => {
    for (const f of walk("src/components")) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/next-auth/);
    }
  });
  it("chỉ src/server/media biết SDK S3", () => {
    for (const f of [...walk("src/components"), ...walk("src/app")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/@aws-sdk\/client-s3/);
    }
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận fail, rồi cài đặt**

`rate-limit.ts` dùng `Map` trong bộ nhớ, cửa sổ trượt 15 phút, ngưỡng 5. Nhận `now` làm tham số để test được mà không cần đồng hồ giả.

`providers/credentials.ts` so khớp `ADMIN_EMAIL` và `bcrypt.compare` với `ADMIN_PASSWORD_HASH`. **Không bao giờ so sánh mật khẩu thô.** Cookie: `httpOnly`, `secure`, `sameSite: "lax"`.

`index.ts` chỉ tái xuất ba hàm. Không tái xuất bất cứ thứ gì của Auth.js.

- [ ] **Step 5: Kiểm tra và commit**

```bash
npx vitest run src/server/auth --maxWorkers=1
npx tsc --noEmit
git add -A
git commit -m "feat: tầng xác thực tách khỏi Auth.js, giới hạn tần suất đăng nhập"
```

---

## Task 9: Tầng lưu ảnh

**Files:**
- Create: `src/server/media/index.ts`, `src/server/media/mime.ts`
- Test: `src/server/media/mime.test.ts`

**Interfaces:**
- Consumes: Task 2 (`prisma`)
- Produces:
  - `detectImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml" | null`
  - `uploadImage(file: { bytes: Uint8Array; filename: string; alt?: string }): Promise<Media>`
  - `deleteImage(id: string): Promise<void>`
  - `listImages(): Promise<Media[]>`

- [ ] **Step 1: Cài SDK**

```bash
npm i @aws-sdk/client-s3
```

- [ ] **Step 2: Viết test nhận dạng định dạng bằng magic bytes**

```ts
// src/server/media/mime.test.ts
import { describe, it, expect } from "vitest";
import { detectImageMime } from "./mime";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(32).fill(0)]);

describe("detectImageMime", () => {
  it("nhận PNG", () => {
    expect(detectImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });
  it("nhận JPEG", () => {
    expect(detectImageMime(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
  });
  it("nhận WebP qua RIFF....WEBP", () => {
    const b = new Uint8Array(32);
    b.set([0x52, 0x49, 0x46, 0x46], 0);
    b.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectImageMime(b)).toBe("image/webp");
  });
  it("nhận SVG", () => {
    expect(detectImageMime(new TextEncoder().encode('<svg xmlns="..."></svg>'))).toBe("image/svg+xml");
  });
  it("từ chối tệp thực thi đổi tên thành .png — không tin đuôi file", () => {
    expect(detectImageMime(bytes(0x4d, 0x5a, 0x90))).toBeNull();
  });
  it("từ chối HTML trá hình", () => {
    expect(detectImageMime(new TextEncoder().encode("<html><script>"))).toBeNull();
  });
  it("từ chối tệp rỗng", () => {
    expect(detectImageMime(new Uint8Array(0))).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail, rồi cài đặt**

`uploadImage` phải: gọi `detectImageMime` trước tiên và ném lỗi nếu `null`; từ chối tệp > 5 MB; đặt `pathname` ngẫu nhiên (`crypto.randomUUID()`) chứ không dùng tên tệp người dùng gửi lên; ghi bản ghi `Media` sau khi `PutObject` thành công.

- [ ] **Step 4: Kiểm tra và commit**

```bash
npx vitest run src/server/media --maxWorkers=1
npx tsc --noEmit
git add -A
git commit -m "feat: tầng lưu ảnh R2, nhận dạng định dạng bằng magic bytes"
```

---

## Task 10: Truy vấn và ghi dữ liệu

**Files:**
- Create: `src/server/content/queries.ts`, `src/server/content/mutations.ts`
- Test: `src/server/content/queries.db.test.ts`

**Interfaces:**
- Consumes: Task 2 (`prisma`, `hasDatabase`), Task 4 (`resolveTranslation`, `tags`), Task 6 (`buildSearchIndex`)
- Produces:
  - `listApps(locale): Promise<AppCard[]>` với `AppCard = { slug; name; tagline; kind; status; isRepoPrivate; techStack; integration: "core"|"connected"|"planned"|"standalone"|"private" }`
  - `getApp(slug, locale): Promise<AppDetail | null>`
  - `getDocPage(slug, locale): Promise<DocPageDetail | null>`
  - `listNav(locale): Promise<NavGroup[]>`
  - `getSearchIndex(locale): Promise<SearchDoc[]>`
  - `getStaticSlugs(): Promise<{ apps: string[]; docs: string[] }>` — trả `{apps:[],docs:[]}` khi `!hasDatabase()`
  - `saveApp`, `saveFeatures`, `saveSections`, `saveDocPage`, `setLocaleEnabled` — mỗi hàm gọi `revalidateTag` tương ứng

- [ ] **Step 1: Viết test tích hợp, có cổng bỏ qua khi thiếu DB**

```ts
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
```

- [ ] **Step 2: Chạy test, xác nhận nhóm cần DB bị bỏ qua và nhóm còn lại fail**

Run: `npx vitest run src/server/content/queries.db.test.ts`
Expected: 3 skipped, 1 failed.

- [ ] **Step 3: Cài đặt `queries.ts`**

Mỗi hàm đọc bọc trong `unstable_cache` với tag từ `tags.ts`. Chỉ trả app/doc có `status === "PUBLISHED"` trừ khi tham số `includeDrafts` bật (dùng cho chế độ xem thử).

- [ ] **Step 4: Cài đặt `mutations.ts`**

Bảng revalidate bắt buộc, theo spec §8.3:

| Thay đổi | Tag phải gọi |
|---|---|
| Nội dung một app | `app:<slug>`, `search-index` |
| Tên / thứ tự / trạng thái publish | thêm `nav`, `apps-list` |
| Nội dung một trang docs | `doc:<slug>`, `search-index` |

Trước khi ghi `Section`, gọi `ensureUniqueAnchors` (Task 3) và ném lỗi tiếng Việt dễ hiểu nếu trùng. Bắt `P2002` của Prisma và đổi thành thông báo "Slug này đã có ứng dụng khác dùng."

- [ ] **Step 5: Kiểm tra và commit**

```bash
npx vitest run src/server/content --maxWorkers=1
npx tsc --noEmit
git add -A
git commit -m "feat: tầng truy vấn và ghi nội dung kèm revalidate theo tag"
```

---

## Task 11: Component giao diện dùng chung

**Files:**
- Create: `src/components/ui/{Badge,Chip,Callout,CodeBlock,DataTable,WireDiagram}.tsx`
- Test: `src/components/ui/WireDiagram.test.tsx`, `src/components/ui/Badge.test.tsx`

**Interfaces:**
- Consumes: Task 1 (token CSS)
- Produces:
  - `<Badge kind="core"|"connected"|"planned"|"standalone"|"private">`
  - `<Chip>`, `<Callout tone="note"|"warning">`, `<CodeBlock html>`, `<DataTable>`
  - `<WireDiagram items={{ name, desc, integration }[]} coreLabel />`

**Bắt buộc đọc `docs/design/design-rules.md` trước khi viết task này.** Mockup tham chiếu: `docs/design/mockups/index.html`, class `.m-wire*`, `.m-badge`, `.b-*`.

- [ ] **Step 1: Viết test cho WireDiagram — kiểu nét mang thông tin**

```tsx
// src/components/ui/WireDiagram.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WireDiagram } from "./WireDiagram";

const items = [
  { name: "Web Store Apps",     desc: "Đăng nhập",  integration: "core" as const },
  { name: "Match CV",           desc: "Đối chiếu",  integration: "planned" as const },
  { name: "Calculate Badminton",desc: "Chia tiền",  integration: "standalone" as const },
];

describe("WireDiagram", () => {
  it("hiện tên hiển thị, không hiện slug", () => {
    render(<WireDiagram items={items} coreLabel="IDMS" />);
    expect(screen.getByText("Calculate Badminton")).toBeInTheDocument();
    expect(screen.queryByText("app-calculate-badminton")).toBeNull();
  });

  it("nét liền cho đã nối, nét đứt cho dự kiến, không nét cho độc lập", () => {
    const { container } = render(<WireDiagram items={items} coreLabel="IDMS" />);
    const leads = container.querySelectorAll("[data-integration]");
    expect(leads[0].getAttribute("data-integration")).toBe("core");
    expect(leads[1].getAttribute("data-integration")).toBe("planned");
    expect(leads[2].getAttribute("data-integration")).toBe("standalone");
  });

  it("luôn kèm chú giải — kiểu nét vô nghĩa nếu không giải thích", () => {
    render(<WireDiagram items={items} coreLabel="IDMS" />);
    expect(screen.getByRole("list", { name: /chú giải/i })).toBeInTheDocument();
  });

  it("danh sách rỗng vẫn dựng được, không đổ vỡ", () => {
    const { container } = render(<WireDiagram items={[]} coreLabel="IDMS" />);
    expect(container.querySelectorAll("[data-integration]")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Viết test cho Badge**

```tsx
// src/components/ui/Badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("gắn data-kind để CSS chọn màu trạng thái", () => {
    render(<Badge kind="private">Repo riêng tư</Badge>);
    expect(screen.getByText("Repo riêng tư").getAttribute("data-kind")).toBe("private");
  });
  it("không viết mã màu trực tiếp trong style nội tuyến", () => {
    const { container } = render(<Badge kind="core">Lõi</Badge>);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail, rồi cài đặt**

Màu lấy qua `data-kind` + CSS attribute selector, **không** map trong JS. Nhờ vậy đổi màu trạng thái chỉ sửa `tokens.css`.

`CodeBlock` nhận HTML đã tô màu từ `renderMarkdown` và bọc trong `<div style="overflow-x:auto">`.

- [ ] **Step 4: Kiểm tra và commit**

```bash
npx vitest run src/components/ui --maxWorkers=1
npx tsc --noEmit
git add -A
git commit -m "feat: component giao diện dùng chung theo quy tắc thiết kế"
```

---

## Task 12: Trang chủ công khai

**Files:**
- Create: `src/app/[locale]/(public)/layout.tsx`, `src/app/[locale]/(public)/page.tsx`
- Create: `src/components/docs/{TopBar,SearchDialog,AppCard}.tsx`
- Test: `src/components/docs/AppCard.test.tsx`

**Interfaces:**
- Consumes: Task 10 (`listApps`, `getDocPage`, `getStaticSlugs`), Task 11 (`WireDiagram`, `Badge`, `Chip`), Task 7 (next-intl)
- Produces: layout công khai gồm `TopBar` + `SearchDialog`, dùng lại ở Task 13.

- [ ] **Step 1: Viết test cho AppCard**

```tsx
// src/components/docs/AppCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AppCard } from "./AppCard";

const base = {
  slug: "app-manage-gym", name: "Manage Gym", tagline: "Nhật ký tập luyện",
  kind: "SATELLITE" as const, techStack: ["Next.js 16"], integration: "planned" as const,
  isRepoPrivate: false,
};

describe("AppCard", () => {
  it("tên hiển thị là tiêu đề, slug chỉ là chữ phụ", () => {
    render(<AppCard app={base} locale="vi" />);
    expect(screen.getByRole("heading")).toHaveTextContent("Manage Gym");
    expect(screen.getByRole("heading")).not.toHaveTextContent("app-manage-gym");
  });

  it("repo riêng tư thì không dựng liên kết GitHub chết", () => {
    render(<AppCard app={{ ...base, isRepoPrivate: true }} locale="vi" />);
    expect(screen.queryByRole("link", { name: /github/i })).toBeNull();
  });

  it("liên kết trỏ tới đường dẫn có tiền tố locale", () => {
    render(<AppCard app={base} locale="en" />);
    expect(screen.getByRole("link", { name: /Manage Gym/ }))
      .toHaveAttribute("href", "/en/apps/app-manage-gym");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail, rồi cài đặt component**

- [ ] **Step 3: Viết `page.tsx`**

```tsx
export async function generateStaticParams() {
  const { locales } = await import("@/i18n/locales.generated");
  return locales.map((locale) => ({ locale }));
}
```

Bố cục theo mockup màn 01: TopBar → hero (eyebrow mono + h1 + lede + `WireDiagram` + chú giải) → lưới thẻ ứng dụng.

- [ ] **Step 4: Kiểm tra build và commit**

```bash
npx vitest run src/components/docs --maxWorkers=1
npx tsc --noEmit
npm run build
git add -A
git commit -m "feat: trang chủ với sơ đồ đấu nối hệ sinh thái"
```

---

## Task 13: Trang ứng dụng và trang hướng dẫn

**Files:**
- Create: `src/app/[locale]/(public)/apps/page.tsx`, `src/app/[locale]/(public)/apps/[slug]/page.tsx`
- Create: `src/app/[locale]/(public)/docs/[slug]/page.tsx`
- Create: `src/app/[locale]/not-found.tsx`, `src/app/[locale]/error.tsx`
- Create: `src/components/docs/{DocsShell,Sidebar,Toc,AppHero,FeatureGrid,SectionBody,FallbackNotice}.tsx`
- Test: `src/components/docs/Toc.test.tsx`, `src/components/docs/FallbackNotice.test.tsx`

**Interfaces:**
- Consumes: Task 10, Task 11, Task 5 (`renderMarkdown`)
- Produces: `<DocsShell sidebar main toc>` dùng chung cho cả trang app lẫn trang hướng dẫn.

- [ ] **Step 1: Viết test cho Toc**

```tsx
// src/components/docs/Toc.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Toc } from "./Toc";

describe("Toc", () => {
  it("dựng liên kết neo từ anchor của mục", () => {
    render(<Toc items={[{ anchor: "la-gi", title: "Là gì" }]} title="Trong trang" />);
    expect(screen.getByRole("link", { name: "Là gì" })).toHaveAttribute("href", "#la-gi");
  });
  it("không mục nào thì không dựng khung rỗng", () => {
    const { container } = render(<Toc items={[]} title="Trong trang" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Viết test cho FallbackNotice**

```tsx
// src/components/docs/FallbackNotice.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FallbackNotice } from "./FallbackNotice";

describe("FallbackNotice", () => {
  it("báo rõ đang đọc bản ngôn ngữ khác", () => {
    render(<FallbackNotice shownLocale="vi" wantedLocale="en" label="Chưa có bản tiếng Anh" />);
    expect(screen.getByText("Chưa có bản tiếng Anh")).toBeInTheDocument();
  });
  it("không hiện gì khi đúng ngôn ngữ", () => {
    const { container } = render(<FallbackNotice shownLocale="vi" wantedLocale="vi" label="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail, rồi cài đặt component**

- [ ] **Step 4: Viết ba trang**

`generateStaticParams` gọi `getStaticSlugs()`; trả `[]` khi chưa có DB. Để `dynamicParams` mặc định `true` — nhờ vậy **ứng dụng mới tạo trong CMS có trang ngay mà không cần redeploy**.

Metadata: phát `alternates.languages` cho mọi locale đang bật cộng `x-default` trỏ locale mặc định.

Slug không tồn tại hoặc chưa publish → `notFound()`.

- [ ] **Step 5: Kiểm tra và commit**

```bash
npx vitest run src/components --maxWorkers=1
npx tsc --noEmit
npm run build
git add -A
git commit -m "feat: trang ứng dụng và trang hướng dẫn ba cột"
```

---

## Task 14: Đăng nhập và khung quản trị

**Files:**
- Create: `src/app/[locale]/(admin)/admin/layout.tsx`, `.../admin/page.tsx`, `.../admin/login/page.tsx`, `.../admin/apps/page.tsx`
- Create: `src/components/admin/{AdminShell,LoginForm,AppsTable}.tsx`
- Create: `src/app/[locale]/(admin)/admin/actions.ts`
- Test: `e2e/admin-auth.spec.ts`

**Interfaces:**
- Consumes: Task 8 (`requireAdmin`, `getCurrentUser`, `checkRateLimit`), Task 10 (`listApps`)
- Produces: `AdminShell` dùng lại ở Task 15 và 16.

- [ ] **Step 1: Viết e2e kiểm tra ranh giới bảo mật**

```ts
// e2e/admin-auth.spec.ts
import { test, expect } from "@playwright/test";

test("chưa đăng nhập thì /admin chuyển sang trang đăng nhập", async ({ page }) => {
  await page.goto("/vi/admin/apps");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("server action từ chối người chưa đăng nhập — bảo vệ layout không bảo vệ action", async ({ request }) => {
  const res = await request.post("/vi/admin/apps", {
    headers: { "Next-Action": "saveApp", "Content-Type": "text/plain;charset=UTF-8" },
    data: '[{"slug":"hacked","kind":"CORE","status":"PUBLISHED"}]',
  });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(await res.text()).not.toContain("hacked");
});
```

- [ ] **Step 2: Cài đặt `layout.tsx` gọi `requireAdmin()`**

- [ ] **Step 3: Cài đặt `actions.ts`**

**Mọi hàm mở đầu bằng `await requireAdmin()`.** Không có ngoại lệ, kể cả hàm chỉ đọc.

```ts
"use server";
import { requireAdmin } from "@/server/auth";
import { appInputSchema } from "@/lib/schemas";
import * as content from "@/server/content/mutations";

export async function saveApp(raw: unknown) {
  await requireAdmin();                       // luôn là dòng đầu tiên
  const input = appInputSchema.parse(raw);
  return content.saveApp(input);
}
```

- [ ] **Step 4: Cài đặt trang đăng nhập theo mockup màn 06**

Gồm dòng chân trang ghi ý định đổi sang IDMS. Gọi `checkRateLimit` trước khi thử xác thực.

- [ ] **Step 5: Kiểm tra và commit**

```bash
npx tsc --noEmit
npm run build
git add -A
git commit -m "feat: đăng nhập quản trị và khung CMS"
```

---

## Task 15: Trình soạn nội dung

**Files:**
- Create: `src/app/[locale]/(admin)/admin/apps/[id]/page.tsx`
- Create: `src/components/admin/{AppEditor,LocaleSwitch,TranslationMeter,SortableList,MarkdownEditor,SectionRow,FeatureRow}.tsx`
- Create: `src/app/[locale]/(public)/apps/[slug]/preview/route.ts`
- Test: `src/components/admin/TranslationMeter.test.tsx`, `src/components/admin/SortableList.test.tsx`

**Interfaces:**
- Consumes: Task 14 (`AdminShell`, actions), Task 10 (`getApp`), Task 5 (`renderMarkdown`)
- Produces: trình soạn hoàn chỉnh theo mockup màn 04.

- [ ] **Step 1: Viết test cho TranslationMeter**

```tsx
// src/components/admin/TranslationMeter.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TranslationMeter } from "./TranslationMeter";

describe("TranslationMeter", () => {
  it("cho biết còn thiếu bao nhiêu mục — việc khó nhất khi song ngữ là biết mình thiếu gì", () => {
    render(<TranslationMeter locale="en" done={3} total={8} />);
    expect(screen.getByText(/EN thiếu 3\/8/i)).toBeInTheDocument();
  });
  it("đủ bản dịch thì không cảnh báo", () => {
    render(<TranslationMeter locale="en" done={8} total={8} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
```

- [ ] **Step 2: Viết test cho SortableList (dùng fireEvent, không dùng userEvent)**

```tsx
// src/components/admin/SortableList.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SortableList } from "./SortableList";

const items = [{ id: "a", label: "Là gì" }, { id: "b", label: "Quick start" }];

describe("SortableList", () => {
  it("đổi chỗ được bằng bàn phím — kéo thả không dùng được nếu chỉ có bàn phím", () => {
    const onReorder = vi.fn();
    render(<SortableList items={items} onReorder={onReorder} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Là gì/ }), { key: "ArrowDown" });
    expect(onReorder).toHaveBeenCalledWith(["b", "a"]);
  });

  it("xoá một mục thì gọi lại với danh sách còn lại", () => {
    const onRemove = vi.fn();
    render(<SortableList items={items} onReorder={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByRole("button", { name: /xoá/i })[0]);
    expect(onRemove).toHaveBeenCalledWith("a");
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail, rồi cài đặt**

Bốn quyết định UX bắt buộc, theo spec §8.2:
1. Nút chuyển ngôn ngữ **một chỗ duy nhất trên đầu trang**, không phải cặp ô vi/en cạnh mỗi trường.
2. `TranslationMeter` đặt ngay cạnh nút chuyển.
3. Khối "Thông tin chung" (không theo ngôn ngữ) tách khỏi ba khối theo ngôn ngữ.
4. Feature và Section kéo thả được, và **phải sắp xếp được bằng bàn phím**.

- [ ] **Step 4: Viết route xem thử bản nháp**

`/[locale]/apps/[slug]/preview` — `export const dynamic = "force-dynamic"`, đọc thẳng DB kể cả `status=DRAFT`, chỉ chấp nhận khi **vừa** có session admin **vừa** khớp `PREVIEW_SECRET`.

- [ ] **Step 5: Kiểm tra và commit**

```bash
npx vitest run src/components/admin --maxWorkers=1
npx tsc --noEmit
npm run build
git add -A
git commit -m "feat: trình soạn nội dung ứng dụng, kéo thả và đo độ hoàn thiện bản dịch"
```

---

## Task 16: Thư viện ảnh, trang hướng dẫn, ngôn ngữ, seed

**Files:**
- Create: `src/app/[locale]/(admin)/admin/media/page.tsx`, `.../admin/docs/page.tsx`, `.../admin/docs/[id]/page.tsx`, `.../admin/locales/page.tsx`
- Create: `src/components/admin/{MediaLibrary,UploadDropzone}.tsx`
- Create: `prisma/seed.ts`
- Test: `e2e/content-roundtrip.spec.ts`

**Interfaces:**
- Consumes: Task 9 (`uploadImage`, `listImages`), Task 15 (`AppEditor` dùng lại cho `DocPage`)
- Produces: seed 6 ứng dụng + 4 trang hướng dẫn + 2 locale.

- [ ] **Step 1: Viết e2e cho lời hứa trung tâm của hệ thống**

```ts
// e2e/content-roundtrip.spec.ts
import { test, expect } from "@playwright/test";

test.skip(!process.env.DATABASE_URL_TEST, "cần DATABASE_URL_TEST");

test("sửa nội dung trong CMS thì trang công khai đổi mà không cần deploy", async ({ page }) => {
  await page.goto("/vi/admin/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');

  await page.goto("/vi/admin/apps/web-store-apps");
  await page.fill('input[name="tagline"]', "Tagline vừa đổi lúc kiểm thử");
  await page.click('button:has-text("Lưu")');
  await expect(page.getByText("Đã lưu")).toBeVisible();

  await page.goto("/vi/apps/web-store-apps");
  await expect(page.getByText("Tagline vừa đổi lúc kiểm thử")).toBeVisible();
});

test("tên ứng dụng hiển thị dạng viết hoa đầu từ, không phải slug", async ({ page }) => {
  await page.goto("/vi");
  await expect(page.getByRole("heading", { name: "Web Store Apps" })).toBeVisible();
  await expect(page.getByText("web-store-apps", { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 2: Viết `prisma/seed.ts`**

Sáu ứng dụng theo bảng spec §15. Cặp client/api là **một** bản ghi (`repoUrl` + `apiRepoUrl`), không phải hai.

| slug | tên hiển thị | kind | trạng thái |
|---|---|---|---|
| `web-store-apps` | Web Store Apps | CORE | PUBLISHED |
| `match-cv` | Match CV | SATELLITE | PUBLISHED |
| `app-manage-gym` | Manage Gym | SATELLITE | PUBLISHED |
| `app-calculate-badminton` | Calculate Badminton | SATELLITE | PUBLISHED |
| `app-AI-study-coach` | AI Study Coach | SATELLITE | PUBLISHED |
| `shorten-link` | Shorten Link | SATELLITE | DRAFT, `isRepoPrivate: true`, không nội dung |

Trang hướng dẫn: `home`, `ecosystem-overview`, `oauth-integration-guide`, `add-new-app-guide`.
Locale: `vi` (mặc định, bật), `en` (bật).

Nội dung seed lấy từ README công khai — **sơ bộ, có thể thiếu hoặc sai ở phần quick start**. Ghi chú này phải nằm trong đầu file seed để người sau không tưởng đó là nội dung đã kiểm chứng.

- [ ] **Step 3: Cài đặt các trang quản trị còn lại theo mockup màn 05**

- [ ] **Step 4: Kiểm tra toàn bộ**

```bash
npx vitest run --maxWorkers=1
npx tsc --noEmit
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: thư viện ảnh, quản trị trang hướng dẫn và dữ liệu seed"
```

---

## Task 17: Tài liệu vận hành

**Files:**
- Modify: `README.md`
- Create: `docs/operations.md`

- [ ] **Step 1: Viết `docs/operations.md`**

Ghi lại chính xác các bước người vận hành phải tự làm vì cần thông tin đăng nhập mà kế hoạch này không có:

1. Tạo project Neon → lấy `DATABASE_URL`; tạo branch `test` → `DATABASE_URL_TEST`
2. Tạo bucket R2 + API token → bốn biến `R2_*`
3. Sinh `ADMIN_PASSWORD_HASH`: `node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'mật-khẩu'`
4. Sinh `AUTH_SECRET` và `PREVIEW_SECRET`: `openssl rand -base64 32`
5. `npx prisma migrate deploy` rồi `npx prisma db seed`
6. Khai biến trên Vercel, deploy

- [ ] **Step 2: Cập nhật README với hướng dẫn chạy local**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: hướng dẫn vận hành và thiết lập môi trường"
```

---

## Tự soát kế hoạch

**Phủ spec:** §5 cấu trúc thư mục → Task 1–16 · §6 data model → Task 2 · §6.4 hai bất biến → Task 3 (anchor), Task 4 (locale mặc định) · §7.1 route công khai → Task 12–13 · §7.2 route quản trị → Task 14–16 · §7.3 tìm kiếm → Task 6 · §8 CMS → Task 14–15 · §9 i18n → Task 7 · §10 auth → Task 8, 14 · §11 ảnh → Task 9, 16 · §12 xử lý lỗi → Task 5 (sanitize), 10 (P2002), 13 (notFound) · §13 kiểm thử → rải khắp · §14 biến môi trường → Task 1, 17 · §15 seed → Task 16.

**Chỗ chưa phủ được và lý do:** chạy migration thật, chạy seed thật, và bộ e2e đầy đủ đều cần thông tin đăng nhập Neon và R2 mà kế hoạch này không có. Mã được viết và kiểm tra kiểu đầy đủ; phần thực thi nằm ở Task 17 dưới dạng hướng dẫn vận hành.

**Nhất quán tên gọi:** `requireAdmin` (không phải `assertAdmin`) · `resolveTranslation` · `getStaticSlugs` · `tags.app/doc/nav/appsList/searchIndex` · `detectImageMime` · `buildSearchIndex` · `ensureUniqueAnchors`. Kiểm tra lại thấy khớp giữa khối Interfaces và mã ví dụ ở mọi task.
