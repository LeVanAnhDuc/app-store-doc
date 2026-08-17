/**
 * Nhận dạng định dạng ảnh bằng magic bytes — thuần, không phụ thuộc.
 *
 * Không bao giờ tin đuôi tệp hay `Content-Type` do trình duyệt gửi lên: cả hai đều
 * do người tải lên đặt. Một tệp thực thi đổi tên thành `logo.png` vẫn là tệp thực thi.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

/** Số byte đầu đọc thử khi dò SVG. SVG là văn bản nên phải soi nội dung, không có magic byte. */
const SVG_SCAN_BYTES = 1024;

// BOM viết bằng mã số thay vì ký tự thật: ký tự vô hình trong mã nguồn rất dễ bị xoá nhầm khi sửa file.
const BOM_CODE_POINT = 0xfeff;

/** So khớp một dãy byte tại vị trí `offset`; thiếu byte thì coi như không khớp. */
function matchesAt(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP"

/**
 * SVG không có magic byte. Bỏ qua khoảng trắng, BOM, khai báo XML, chú thích và
 * DOCTYPE ở đầu tệp rồi mới đòi thẻ mở phải đúng là `<svg`.
 *
 * Đòi `<svg` nằm ngay đầu (chứ không dò cả tệp) là cố ý: `<html><script>` có thể
 * chứa chuỗi `<svg` ở giữa, và một tệp HTML được phục vụ từ tên miền của mình là
 * lỗ hổng XSS chứ không phải ảnh.
 */
function looksLikeSvg(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;

  let head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, SVG_SCAN_BYTES));
  if (head.charCodeAt(0) === BOM_CODE_POINT) head = head.slice(1);

  // Lặp cho tới khi không cắt được gì nữa: các phần đầu có thể xen kẽ nhau.
  for (;;) {
    const before = head;
    head = head
      .replace(/^\s+/, "")
      .replace(/^<\?xml[\s\S]*?\?>/i, "")
      .replace(/^<!--[\s\S]*?-->/, "")
      .replace(/^<!DOCTYPE[^>]*>/i, "");
    if (head === before) break;
  }

  // Ký tự ngay sau `<svg` phải kết thúc tên thẻ, nếu không `<svgfoo>` cũng lọt.
  return /^<svg[\s>/]/i.test(head);
}

/**
 * Trả về kiểu MIME thật của ảnh, hoặc `null` nếu byte đầu vào không phải một trong
 * bốn định dạng được phép. Tệp rỗng luôn trả `null`.
 */
export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length === 0) return null;

  if (matchesAt(bytes, PNG_SIGNATURE)) return "image/png";
  if (matchesAt(bytes, JPEG_SIGNATURE)) return "image/jpeg";

  // WebP là container RIFF: "RIFF" ở offset 0, độ dài 4 byte, rồi "WEBP" ở offset 8.
  // Thiếu vế thứ hai thì đó là RIFF bất kỳ (WAV, AVI), không phải ảnh.
  if (matchesAt(bytes, RIFF_SIGNATURE, 0) && matchesAt(bytes, WEBP_SIGNATURE, 8)) {
    return "image/webp";
  }

  if (looksLikeSvg(bytes)) return "image/svg+xml";

  return null;
}

/** Đuôi tệp suy ra từ MIME đã nhận dạng, không lấy từ tên tệp người dùng gửi lên. */
export function extensionForMime(mime: ImageMime): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
  }
}
