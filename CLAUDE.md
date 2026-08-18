# Ducker

Trang tài liệu hệ sinh thái ứng dụng + CMS quản trị nội dung.
Tên hiển thị: **Ducker**. Slug kho mã: `app-store-doc` — không đổi.
Next.js 16 · Prisma 7 · PostgreSQL (Neon) · Auth.js · next-intl · Cloudflare R2 · Vercel

## Đọc trước khi làm

| Việc | Tài liệu |
|---|---|
| **Bắt đầu phiên mới — đang làm tới đâu, còn nợ gì** | **[`docs/status.md`](docs/status.md) — đọc trước tiên** |
| **Dựng bất kỳ giao diện nào** | **[`docs/design/design-rules.md`](docs/design/design-rules.md) — bắt buộc** |
| Kiến trúc, data model, i18n, auth | [`docs/superpowers/specs/2026-08-17-app-store-doc-design.md`](docs/superpowers/specs/2026-08-17-app-store-doc-design.md) |
| Giao diện đã được duyệt | [`docs/design/mockups/index.html`](docs/design/mockups/index.html) — mở bằng trình duyệt |

## Ba ranh giới không được vượt

Component **không bao giờ** `import prisma`, `import` Auth.js, hay `import` SDK S3. Mọi truy cập đi qua đúng một cửa:

- `src/server/content/` — nơi duy nhất chạm Prisma
- `src/server/auth/` — nơi duy nhất biết Auth.js. Chỉ lộ ra `getCurrentUser()`, `requireAdmin()`, `signOut()`
- `src/server/media/` — nơi duy nhất biết Cloudflare R2

Nhờ vậy đổi cache, đổi DB, đổi nhà cung cấp lưu trữ, đổi cơ chế auth — mỗi thứ chỉ chạm một tầng.

## Bốn cái bẫy đã biết

1. **Server Action là endpoint HTTP riêng.** Bảo vệ `layout.tsx` của `/admin` *không* bảo vệ server action. Mọi action ghi dữ liệu phải gọi `requireAdmin()` ở dòng đầu.
2. **`vitest` không typecheck.** Suite xanh không chứng minh `tsc` sạch. Luôn chạy `tsc --noEmit` riêng, và chạy `npm run build` trước khi báo hoàn thành.
3. **Vitest song song hay flaky trên máy Windows này.** Test fail dưới lần chạy song song chưa được coi là fail thật cho tới khi lặp lại với `--maxWorkers=1`. Test component dùng `fireEvent`, không dùng `userEvent.type`.
4. **Branch DB `test` chỉ có một** và `prisma migrate reset` xoá sạch. Không chạy hai suite cùng lúc.

## Tên ứng dụng

Tên hiển thị viết hoa đầu từ, có khoảng trắng: **Manage Gym**, không phải `app-manage-gym`. Slug repo chỉ xuất hiện ở vai trò phụ, chữ mono, màu `--muted`. Bảng ánh xạ đầy đủ trong `docs/design/design-rules.md` §1.

## Ngôn ngữ

Nội dung, chú thích mã, thông điệp commit: **tiếng Việt**. Định danh trong mã (biến, hàm, kiểu): **tiếng Anh**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
