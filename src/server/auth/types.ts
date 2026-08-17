/**
 * Kiểu dữ liệu công khai của tầng auth.
 *
 * Đặt riêng khỏi `index.ts` để `providers/*.ts` dùng được mà không tạo vòng
 * import ngược. Phần còn lại của ứng dụng chỉ nên nhập kiểu này qua
 * `@/server/auth`, không nhập thẳng từ đây.
 */
export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  roles: string[];
};
