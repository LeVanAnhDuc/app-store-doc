/**
 * Sinh tên cache tag. Thuần chuỗi, không phụ thuộc Next.js hay Prisma.
 *
 * Tách thành module riêng để `queries.ts` (bọc `unstable_cache`) và
 * `mutations.ts` (gọi `revalidateTag`) không bao giờ gõ tay tên tag lệch nhau.
 * Lệch một ký tự nghĩa là sửa nội dung trong CMS xong mà trang công khai không
 * đổi — đúng thứ lỗi khó lần nhất, vì không có gì báo lỗi cả.
 */
export const tags = {
  /** Nội dung của một app cụ thể. */
  app: (slug: string): string => `app:${slug}`,
  /** Nội dung của một trang tài liệu cụ thể. */
  doc: (slug: string): string => `doc:${slug}`,
  /** Cây điều hướng: dải tab trên cùng và sidebar, dựng từ `NavNode` (spec §3.1). */
  nav: (): string => "nav",
  /** Danh sách app ở `/[locale]/apps` và grid ngoài trang chủ. */
  appsList: (): string => "apps-list",
  /** Chỉ mục tìm kiếm do `GET /api/search-index/[locale]` phục vụ. */
  searchIndex: (): string => "search-index",
} as const;
