/**
 * Bề mặt công khai của tầng xác thực.
 *
 * Phần còn lại của ứng dụng **chỉ** biết bốn hàm dưới đây và kiểu `SessionUser`.
 * `signInWithPassword` là bổ sung của Task 14: trang đăng nhập phải xác thực
 * được mà không thấy Auth.js, và phải chạy `checkRateLimit` trước đó nên không
 * dùng được `pages.signIn` mặc định.
 * Không tái xuất bất cứ thứ gì của Auth.js — không `auth`, không `handlers`,
 * không `signIn`. Nhờ vậy đổi sang IDMS OAuth chỉ là thêm
 * `providers/idms-oauth.ts` rồi sửa đúng một dòng ở file này.
 */
export type { SessionUser } from "./types";

export {
  getCurrentUser,
  requireAdmin,
  signInWithPassword,
  signOut,
} from "./providers/credentials";
