import { defineConfig } from "prisma/config";

/**
 * Cấu hình cho Prisma CLI (Prisma 7).
 *
 * Từ Prisma 7, `datasource.url` không còn nằm trong `schema.prisma` mà khai ở đây.
 * File phải nằm ở gốc repo thì Prisma mới tự tìm thấy — để trong `prisma/` sẽ khiến
 * mọi lệnh phải truyền `--config` bằng tay.
 *
 * Cảnh báo: schema engine bắt buộc nhận tham số `--datasource`. Thiếu nó thì
 * `prisma migrate diff` **thất bại âm thầm** — in ra chuỗi rỗng và vẫn thoát mã 0,
 * sinh ra file migration 0 byte trông như thành công.
 *
 * URL dự phòng dưới đây chỉ để thoả yêu cầu tham số của engine khi chưa có
 * `DATABASE_URL`. Sinh migration bằng `--from-empty --to-schema` là hoàn toàn
 * ngoại tuyến, không mở kết nối nào.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/app_store_doc",
  },
});
