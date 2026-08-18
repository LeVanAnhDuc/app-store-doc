import { z } from "zod";

/**
 * Toàn bộ Zod schema kiểm tra đầu vào của server action.
 *
 * Giá trị enum viết thẳng chứ không import từ `@prisma/client`: schema này phải
 * kiểm được đầu vào ở cả phía trình duyệt lẫn trong test, nơi Prisma Client có
 * thể chưa được sinh. Danh sách khớp đúng spec §6.
 */
export const statusValues = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const appKindValues = ["CORE", "SATELLITE"] as const;

export const statusSchema = z.enum(statusValues);
export const appKindSchema = z.enum(appKindValues);

/** Slug chỉ chứa chữ thường, số và một gạch nối ngăn giữa — khớp `slugify`. */
const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch nối.");

/** Liên kết ngoài luôn là URL tuyệt đối; để trống thì bỏ hẳn trường. */
const externalUrlSchema = z.url().optional();

export const appInputSchema = z.object({
  slug: slugSchema,
  kind: appKindSchema,
  status: statusSchema,
  order: z.number().int().default(0),
  // Ảnh logo có thể là URL R2 tuyệt đối hoặc đường dẫn tĩnh trong repo.
  logoUrl: z.string().optional(),
  repoUrl: externalUrlSchema,
  apiRepoUrl: externalUrlSchema,
  demoUrl: externalUrlSchema,
  // Repo private thì ẩn liên kết và hiện badge thay vì để link 404 (spec §6.3).
  isRepoPrivate: z.boolean().default(false),
  // Chạy độc lập, không backend, không dự kiến nối IDMS. Người viết nội dung bật
  // tay: hệ thống không tự suy diễn trạng thái tích hợp (spec §2, R7).
  isStandalone: z.boolean().default(false),
  techStack: z.array(z.string()).default([]),
});

/**
 * `title` bắt buộc ở đây là hợp đồng của **một bản dịch đã có**.
 *
 * Khi lưu một danh sách nội dung thì tiêu đề rỗng lại có nghĩa "ngôn ngữ này
 * chưa dịch mục đó", nên `admin/actions.ts` nới đúng trường này ở lược đồ đường
 * truyền. Xem `planContentSave` trong `src/server/content/resolve.ts`.
 */
export const featureInputSchema = z.object({
  order: z.number().int().default(0),
  icon: z.string().optional(), // tên icon lucide
  title: z.string().min(1),
  description: z.string().optional(),
});

/**
 * Union một nhánh là **cố ý**: hôm nay chỉ có `markdown`, nhưng chỗ gọi đã phải
 * `switch` theo `type` ngay từ đầu, nên thêm nhánh `blocks` sau này không phải
 * sửa nơi nào khác (spec §6.1).
 */
export const sectionBodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), content: z.string() }),
]);

export const sectionInputSchema = z.object({
  order: z.number().int().default(0),
  // Anchor là cấu trúc, dùng chung cho mọi ngôn ngữ, nên luôn bắt buộc hợp lệ.
  anchor: slugSchema,
  title: z.string().min(1),
  body: sectionBodySchema,
});

export const docPageInputSchema = z.object({
  slug: slugSchema,
  order: z.number().int().default(0),
  status: statusSchema,
  title: z.string().min(1),
  description: z.string().optional(),
});

export const localeInputSchema = z.object({
  code: z.string().min(2),
  label: z.string().min(1),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  order: z.number().int().default(0),
});

export type AppInput = z.infer<typeof appInputSchema>;
export type FeatureInput = z.infer<typeof featureInputSchema>;
export type SectionBody = z.infer<typeof sectionBodySchema>;
export type SectionInput = z.infer<typeof sectionInputSchema>;
export type DocPageInput = z.infer<typeof docPageInputSchema>;
export type LocaleInput = z.infer<typeof localeInputSchema>;
