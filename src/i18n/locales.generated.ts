// SINH TỰ ĐỘNG bởi `scripts/generate-locales.ts` lúc `prebuild` — đừng sửa tay.
// Nguồn dữ liệu: bảng `Locale` trong cơ sở dữ liệu.
//
// File này tồn tại vì middleware chạy ở edge và không được chạm DB. Đổi lại,
// thêm một ngôn ngữ mới cần một lần redeploy; sửa nội dung thì không.
// Xem spec §9.3.

export const locales: readonly string[] = ["vi", "en"];
export const defaultLocale: string = "vi";
