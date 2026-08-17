/**
 * Bề mặt công khai của tầng xác thực.
 *
 * Phần còn lại của ứng dụng **chỉ** biết ba hàm dưới đây và kiểu `SessionUser`.
 * Không tái xuất bất cứ thứ gì của Auth.js — không `auth`, không `handlers`,
 * không `signIn`. Nhờ vậy đổi sang IDMS OAuth chỉ là thêm
 * `providers/idms-oauth.ts` rồi sửa đúng một dòng ở file này.
 */
export type { SessionUser } from "./types";

export { getCurrentUser, requireAdmin, signOut } from "./providers/credentials";
