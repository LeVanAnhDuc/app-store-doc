# Ducker

> Tên hiển thị của dự án là **Ducker**. Kho mã trên GitHub vẫn giữ slug `app-store-doc` — slug chỉ xuất hiện ở vai phụ.

Trang tài liệu cho hệ sinh thái ứng dụng của [@LeVanAnhDuc](https://github.com/LeVanAnhDuc), kèm trang quản trị nội dung.

Mỗi ứng dụng có một mục riêng — là gì, chạy thử thế nào, cách dùng, tính năng — cộng các trang tổng quan hệ sinh thái và hướng dẫn tích hợp OAuth. Nội dung sửa được qua CMS, không cần deploy lại.

> **Trạng thái:** mã ứng dụng đã hoàn thành — 108 test xanh (6 test skip vì thiếu `DATABASE_URL_TEST`), `tsc --noEmit` sạch, `next build` chạy được ở chế độ không có DB.
> **Chưa chạy migration thật, chưa seed thật, chưa deploy.** Ba việc đó cần thông tin đăng nhập Neon, Cloudflare R2 và Vercel mà quá trình xây dựng không có. Các bước để làm nằm trong [`docs/operations.md`](docs/operations.md).

## Chạy local

Cần Node 20+ và npm.

```bash
npm install                # postinstall tự chạy `prisma generate`
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
npm run dev                # http://localhost:3000 → chuyển sang /vi
```

Không có `DATABASE_URL` thì trang vẫn dựng được nhưng **không có nội dung**: `generateStaticParams` trả `[]`, mọi truy vấn ném lỗi ở lần chạm DB đầu tiên. Muốn thấy nội dung thật, làm mục 1 và 5 của [`docs/operations.md`](docs/operations.md) rồi điền `DATABASE_URL` vào `.env`.

### Scripts

| Lệnh | Việc |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prebuild` sinh `src/i18n/locales.generated.ts` từ bảng `Locale`, rồi `next build` |
| `npm start` | Chạy bản đã build |
| `npm test` | Vitest chế độ watch |
| `npm run test:run` | Vitest một lượt, `--maxWorkers=1` (song song hay flaky trên Windows) |
| `npm run typecheck` | `tsc --noEmit` — **vitest không typecheck**, luôn chạy lệnh này riêng |
| `npm run lint` | ESLint |
| `npm run e2e` | Playwright. Tự dựng server bằng `npm start`, nên phải `npm run build` trước |

Bốn lệnh chạy được mà không cần thông tin đăng nhập nào: `test:run`, `typecheck`, `lint`, `build`. Test cần Postgres nằm trong `*.db.test.ts` và **tự skip** khi thiếu `DATABASE_URL_TEST` — suite xanh trong trạng thái đó không chứng minh gì về tầng truy vấn. Cách chạy chúng: [`docs/operations.md`](docs/operations.md) mục 7.

### Biến môi trường

`.env.example` liệt kê đủ. Ba cái dễ sai nhất:

- `ADMIN_PASSWORD_HASH` là **hash bcrypt**, không phải mật khẩu thô.
- `.env` chỉ được Next tự nạp. **Prisma CLI 7 và vitest không đọc `.env`** — với chúng phải đặt biến trong chính phiên shell.
- `PREVIEW_SECRET` thiếu thì trang xem trước bản nháp **đóng**, không mở.

Giải thích từng biến, lệnh sinh giá trị, và cách lấy chúng từ Neon/R2: [`docs/operations.md`](docs/operations.md).

## Hệ sinh thái

| Repo | Vai trò |
|---|---|
| [`web-store-apps`](https://github.com/LeVanAnhDuc/web-store-apps) · [`api-web-store-apps`](https://github.com/LeVanAnhDuc/api-web-store-apps) | IDMS — máy chủ định danh OAuth 2.0/OIDC và cổng đăng nhập |
| [`client-web-app-match-cv`](https://github.com/LeVanAnhDuc/client-web-app-match-cv) · [`api-web-app-match-cv`](https://github.com/LeVanAnhDuc/api-web-app-match-cv) | Đối chiếu CV với mô tả công việc |
| [`app-manage-gym`](https://github.com/LeVanAnhDuc/app-manage-gym) | Nhật ký tập luyện |
| [`app-AI-study-coach`](https://github.com/LeVanAnhDuc/app-AI-study-coach) | Trợ lý học tập |
| [`app-calculate-badminton`](https://github.com/LeVanAnhDuc/app-calculate-badminton) | Chia tiền sân cầu lông |
| `client-web-app-shorten-link` | Rút gọn liên kết (repo riêng tư) |

Tính đến 17.08.2026, chưa ứng dụng vệ tinh nào thực sự nối vào IDMS.

## Tài liệu

| Việc | Tài liệu |
|---|---|
| **Quay lại dự án — đang làm tới đâu, còn nợ gì** | **[`docs/status.md`](docs/status.md) — mở file này trước** |
| Vì sao mọi thứ thành ra như thế — quyết định, cách làm việc, bẫy đã trả giá | [`docs/session-log.md`](docs/session-log.md) |
| **Dựng hạ tầng, deploy, chạy test cần DB** | **[`docs/operations.md`](docs/operations.md)** |
| **Dựng bất kỳ giao diện nào** | **[`docs/design/design-rules.md`](docs/design/design-rules.md) — bắt buộc** |
| Giao diện đã được duyệt | [`docs/design/mockups/v3/index.html`](docs/design/mockups/v3/index.html) — **v3 là bản đang dùng**; `mockups/index.html` và `v2/` là ảnh chụp lịch sử của quyết định cũ |
| Kiến trúc, data model, i18n, auth, kiểm thử | [spec 17.08](docs/superpowers/specs/2026-08-17-app-store-doc-design.md) — bản gốc · [spec 18.08](docs/superpowers/specs/2026-08-18-ducker-navigation-tree-design.md) — **thay thế §6, §7, §8, §9.3** của bản gốc |
| Kế hoạch thực thi từng task | [`docs/superpowers/plans/2026-08-17-app-store-doc.md`](docs/superpowers/plans/2026-08-17-app-store-doc.md) |
| Quy ước khi sửa mã trong repo này | [`CLAUDE.md`](CLAUDE.md) |

## Nội dung seed là bản nháp

`prisma/seed.ts` viết từ README công khai của các repo, không từ mã nguồn. Phần "Chạy thử trong 5 phút" có thể sai số cổng hoặc tên script. Sau lần deploy đầu, **nguồn sự thật là DB** — sửa qua CMS, đừng sửa `seed.ts`.

## Stack

Next.js 16 · Prisma 7 · PostgreSQL (Neon) · Auth.js · next-intl · Cloudflare R2 · Vercel
