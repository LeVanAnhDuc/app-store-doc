# app-store-doc

Trang tài liệu cho hệ sinh thái ứng dụng của [@LeVanAnhDuc](https://github.com/LeVanAnhDuc), kèm trang quản trị nội dung.

Mỗi ứng dụng có một mục riêng — là gì, chạy thử thế nào, cách dùng, tính năng — cộng các trang tổng quan hệ sinh thái và hướng dẫn tích hợp OAuth. Nội dung sửa được qua CMS, không cần deploy lại.

> **Trạng thái:** đang thiết kế. Chưa có mã ứng dụng.

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

- **[Thiết kế hệ thống](docs/superpowers/specs/2026-08-17-app-store-doc-design.md)** — kiến trúc, data model, i18n, auth, kiểm thử
- **[Mockup giao diện](docs/design/mockups/index.html)** — sáu màn hình, mở trực tiếp bằng trình duyệt

## Stack dự kiến

Next.js 16 · Prisma 7 · PostgreSQL (Neon) · Auth.js · next-intl · Cloudflare R2 · Vercel
