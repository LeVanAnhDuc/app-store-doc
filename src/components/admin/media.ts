/**
 * Kiểu và hàm định dạng dùng chung cho thư viện ảnh.
 *
 * File này **không** có `"use client"`, và đó là lý do nó tồn tại tách khỏi
 * `MediaPicker.tsx`: mọi export của một module `"use client"` là tham chiếu phía
 * trình duyệt, nên trang máy chủ `import { formatBytes }` từ đó sẽ đổ ngay khi
 * gọi ("Attempted to call formatBytes() from the server"). Ở đây thì cả trang máy
 * chủ lẫn component trình duyệt đều dùng được đúng một cách tính.
 */

/**
 * Một ảnh trong thư viện, dạng đã cắt gọn để đi qua ranh giới máy chủ → trình duyệt.
 *
 * Không dùng thẳng `Media` của Prisma: nó mang `createdAt` là `Date` và buộc mọi
 * nơi dùng phải biết tới Prisma.
 *
 * `pathname` là tên tệp trên R2 (UUID + đuôi). Tên tệp gốc **không** được lưu:
 * `uploadImage` cố tình bỏ nó đi để tên người dùng gửi lên không chạm tới đường
 * dẫn lưu trữ. Nhãn đọc được vì vậy lấy từ `alt`, và trang tải ảnh đặt `alt` bằng
 * tên tệp gốc để thư viện có nhãn ngay từ đầu.
 */
export type MediaItem = {
  id: string;
  url: string;
  pathname: string;
  alt: string | null;
  sizeBytes: number;
  mimeType: string;
  /** `null` với ảnh tải qua CMS: tầng lưu ảnh không giải mã ảnh nên không đo được. */
  width: number | null;
  height: number | null;
};

/** Nhãn đọc được của một ảnh. Không bao giờ để trống: nút phải có tên. */
export function mediaLabel(item: MediaItem): string {
  return item.alt?.trim() || item.pathname;
}

/** Dung lượng dạng người đọc được. KB/MB theo 1024, một chữ số thập phân. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
