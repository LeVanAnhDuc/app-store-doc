/**
 * Tiện ích thuần cho slug và anchor. Không phụ thuộc vào bất cứ tầng nào khác.
 */

/** Dải dấu phụ tổ hợp mà NFD tách ra (U+0300..U+036F). */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Chuẩn hoá một chuỗi tiếng Việt thành slug ASCII an toàn cho URL.
 *
 * `đ` và `Đ` phải được thay TRƯỚC khi `normalize("NFD")`: chúng là chữ cái
 * riêng trong Unicode, không phải "d + dấu", nên NFD không tách được và bước
 * bỏ dấu phụ bên dưới sẽ bỏ sót chúng.
 */
export function slugify(input: string): string {
  return input
    .replace(/đ/g, "d") // đ
    .replace(/Đ/g, "D") // Đ
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // khoảng trắng và ký tự lạ gộp thành một gạch nối
    .replace(/^-+|-+$/g, ""); // không để gạch nối thừa ở hai đầu
}

/** Anchor của một mục dùng chung quy tắc với slug để `#...` luôn khớp mục lục. */
export function toAnchor(title: string): string {
  return slugify(title);
}

/**
 * Anchor trùng nhau khiến mục lục và liên kết `#` nhảy sai chỗ. Ràng buộc này
 * không diễn đạt được bằng schema DB (xem spec §6.4) nên phải kiểm ở đây.
 */
export function ensureUniqueAnchors(
  anchors: string[],
): { ok: true } | { ok: false; duplicate: string } {
  const seen = new Set<string>();
  for (const anchor of anchors) {
    if (seen.has(anchor)) return { ok: false, duplicate: anchor };
    seen.add(anchor);
  }
  return { ok: true };
}
