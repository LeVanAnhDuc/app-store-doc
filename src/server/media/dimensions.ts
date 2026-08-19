import { imageSize } from "image-size";

/** Số đo pixel của một ảnh. Không bao giờ chứa 0 — xem `readImageDimensions`. */
export type ImageDimensions = { width: number; height: number };

/**
 * Đọc rộng × cao từ phần header của ảnh, hoặc `null` nếu không đọc được.
 *
 * **Không bao giờ ném.** Đây là điểm quan trọng nhất của hàm này: nó được gọi giữa
 * luồng tải ảnh lên, và một ảnh hợp lệ nhưng định dạng lạ không được phép làm hỏng
 * cả lượt tải. Số đo là thứ "biết thì hay", không phải điều kiện để nhận ảnh —
 * `Media.width`/`height` đều nullable đúng vì lý do đó.
 *
 * `image-size` ném lỗi ở ít nhất hai tình huống đã kiểm thật:
 * - dữ liệu không phải ảnh → `unsupported file type: undefined`
 * - buffer rỗng hoặc cụt → `Offset is outside the bounds of the DataView`
 *
 * Về SVG: `image-size` xử lý tốt hơn vẻ ngoài. Nó lấy `width`/`height` khi có, và
 * **suy từ `viewBox`** khi không — kể cả lúc `width="100%"`, nó bỏ qua phần trăm và
 * dùng tỉ lệ của `viewBox`. Đã kiểm cả ba trường hợp. Nhờ vậy ảnh sơ đồ xuất từ
 * Figma hay Excalidraw (thường chỉ có `viewBox`) vẫn có số đo.
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  let width: number | undefined;
  let height: number | undefined;

  try {
    ({ width, height } = imageSize(bytes));
  } catch {
    return null;
  }

  // Chặn 0 và số âm: ghi `0×0` vào DB tệ hơn ghi `null`, vì nó trông như một số đo
  // thật và không ai đi tìm nguyên nhân.
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (!width || !height || width <= 0 || height <= 0) return null;

  return { width, height };
}
