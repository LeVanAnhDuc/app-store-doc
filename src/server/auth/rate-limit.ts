/**
 * Giới hạn tần suất đăng nhập: 5 lần / 15 phút, đếm riêng theo từng khoá (IP).
 *
 * Cửa sổ trượt lưu trong bộ nhớ tiến trình. Đủ cho một tài khoản quản trị duy
 * nhất; khi nào có nhiều instance thì thay `Map` bằng Redis mà không đổi chữ ký.
 *
 * `now` là tham số chứ không phải `Date.now()` cứng bên trong, để test tua thời
 * gian được mà không cần đồng hồ giả.
 */

/** Độ dài cửa sổ trượt, tính bằng mili giây. */
const WINDOW_MS = 15 * 60_000;

/** Số lần thử tối đa trong một cửa sổ. */
const MAX_ATTEMPTS = 5;

/** Khoá → mốc thời gian của các lần thử còn nằm trong cửa sổ, tăng dần. */
const attempts = new Map<string, number[]>();

export type RateLimitResult = {
  /** `false` nghĩa là đã vượt ngưỡng, phải từ chối yêu cầu. */
  allowed: boolean;
  /** Số giây còn lại tới khi thử lại được. Bằng 0 khi `allowed`. */
  retryAfterSec: number;
};

/**
 * Ghi nhận một lần thử và cho biết có được phép hay không.
 *
 * Lần thử bị chặn **không** được ghi lại, nếu không kẻ tấn công cứ gõ liên tục
 * là tự kéo dài thời gian khoá của chính mình vô hạn.
 */
export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - WINDOW_MS;
  const recent = (attempts.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    const oldest = recent[0];
    const retryAfterSec = Math.max(0, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  attempts.set(key, recent);
  return { allowed: true, retryAfterSec: 0 };
}

/** Xoá toàn bộ bộ đếm. Chỉ dùng trong test để các case không dính vào nhau. */
export function __resetRateLimit(): void {
  attempts.clear();
}
