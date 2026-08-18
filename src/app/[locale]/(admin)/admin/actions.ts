"use server";

import { z } from "zod";

import type { MediaItem } from "@/components/admin/media";
import {
  appInputSchema,
  docPageInputSchema,
  featureInputSchema,
  sectionInputSchema,
  statusSchema,
} from "@/lib/schemas";
import { renderMarkdown } from "@/lib/markdown";
import { requireAdmin, signOut } from "@/server/auth";
import { navKindValues } from "@/server/content/nav";
import * as content from "@/server/content/mutations";
import { MAX_IMAGE_BYTES, deleteImage, listImages, uploadImage } from "@/server/media";

/**
 * Server action của CMS.
 *
 * **Mọi hàm trong file này mở đầu bằng `await requireAdmin()`.** Không ngoại lệ.
 *
 * Lý do, chép lại từ CLAUDE.md cái bẫy số 1: Server Action là một endpoint HTTP
 * riêng biệt. `POST /vi/admin/apps` kèm header `Next-Action` gọi thẳng vào hàm
 * dưới đây mà **không** chạy layout nào. `(protected)/layout.tsx` có gọi
 * `requireAdmin()` cũng chỉ bảo vệ phần kết xuất trang; xoá dòng
 * `requireAdmin()` khỏi một hàm ở đây là mở một endpoint ghi dữ liệu cho toàn
 * bộ Internet, và giao diện vẫn trông như cũ nên không có gì để phát hiện.
 * `e2e/admin-auth.spec.ts` canh đúng chỗ này.
 *
 * Đầu vào đi qua Zod trước khi tới tầng nội dung: action nhận `unknown` vì dữ
 * liệu đến từ mạng, không phải từ mã của ta.
 */

/** Phần theo ngôn ngữ khi lưu một ứng dụng. */
const appTranslationSchema = z.object({
  locale: z.string().min(2),
  name: z.string().min(1),
  tagline: z.string().optional(),
  summary: z.string().optional(),
});

/**
 * `appInputSchema` cộng hai trường mà tầng ghi cần: `id` để sửa đúng bản ghi
 * (nhờ vậy slug đổi được), và `translation` để ứng dụng vừa tạo có tên ngay —
 * app không có bản dịch nào thì không trang công khai nào hiện nó.
 */
const saveAppSchema = appInputSchema.extend({
  id: z.string().min(1).optional(),
  translation: appTranslationSchema.optional(),
});

const setAppStatusSchema = z.object({
  id: z.string().min(1),
  status: statusSchema,
});

const reorderAppsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function saveApp(raw: unknown): Promise<content.SavedApp> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = saveAppSchema.parse(raw);
  return content.saveApp(input);
}

export async function setAppStatus(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = setAppStatusSchema.parse(raw);
  await content.setAppStatus(input.id, input.status);
}

export async function reorderApps(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = reorderAppsSchema.parse(raw);
  await content.reorderApps(input.ids);
}

/** Mã ngôn ngữ. Không kiểm với `locales.generated.ts`: bảng `Locale` là nguồn sự thật. */
const localeCodeSchema = z.string().min(2);

/**
 * Tiêu đề **theo ngôn ngữ đang lưu**, nên được phép rỗng ở đây.
 *
 * `featureInputSchema`/`sectionInputSchema`/`docPageInputSchema` đòi `title` không
 * rỗng vì chúng mô tả một bản dịch **đã có**. Lúc lưu thì tiêu đề rỗng lại mang
 * nghĩa khác hẳn: ngôn ngữ này chưa dịch mục đó. Tầng ghi giữ nguyên mục và giữ
 * nguyên bản dịch của các ngôn ngữ khác (xem `planContentSave` trong
 * `src/server/content/resolve.ts`), nên chặn ở đây là chặn đúng việc dịch dần mà
 * `TranslationMeter` tồn tại để đo.
 */
const translatedTitle = z.string();

/**
 * Một dòng trong danh sách gửi lên: `id` vắng mặt là mục vừa thêm trong lần soạn
 * này. `order` không cần gửi — tầng ghi lấy thứ tự từ vị trí trong mảng, vì kéo
 * thả trong CMS là thứ tự hiển thị thật (spec §8.2.4).
 */
const saveFeaturesSchema = z.object({
  appSlug: z.string().min(1),
  locale: localeCodeSchema,
  features: z.array(
    featureInputSchema.extend({ id: z.string().min(1).optional(), title: translatedTitle }),
  ),
});

/**
 * `Section` dùng chung cho App và DocPage, nên chủ sở hữu phải nói rõ là bên nào.
 * Trang hướng dẫn dùng đúng action này qua nhánh `docSlug`.
 */
const sectionOwnerSchema = z.union([
  z.object({ appSlug: z.string().min(1) }),
  z.object({ docSlug: z.string().min(1) }),
]);

const saveSectionsSchema = z.object({
  owner: sectionOwnerSchema,
  locale: localeCodeSchema,
  sections: z.array(
    sectionInputSchema.extend({ id: z.string().min(1).optional(), title: translatedTitle }),
  ),
});

/**
 * Ghi cấu trúc danh sách tính năng của một ứng dụng, cộng bản dịch của một ngôn ngữ.
 *
 * Danh sách là **đầy đủ** về cấu trúc: mục nào không có trong đó thì bị xoá.
 * Trình soạn nội dung vì vậy luôn gửi cả danh sách, kể cả mục nó không sửa và kể
 * cả mục chưa có bản dịch ở ngôn ngữ đang lưu.
 */
export async function saveFeatures(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = saveFeaturesSchema.parse(raw);
  await content.saveFeatures(input);
}

/** Ghi đè danh sách mục nội dung. Cùng quy ước "cấu trúc đầy đủ" như trên. */
export async function saveSections(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = saveSectionsSchema.parse(raw);
  await content.saveSections(input);
}

/**
 * `docPageInputSchema` cộng `id` (để sửa đúng bản ghi, nhờ vậy slug đổi được) và
 * `locale` (bản dịch đang lưu). `title` nới như hai action trên: rỗng là chưa dịch.
 */
const saveDocPageSchema = docPageInputSchema.extend({
  id: z.string().min(1).optional(),
  locale: localeCodeSchema,
  title: translatedTitle,
});

export async function saveDocPage(raw: unknown): Promise<content.SavedDocPage> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = saveDocPageSchema.parse(raw);
  return content.saveDocPage(input);
}

// ---------------------------------------------------------------------------
// Ngôn ngữ
// ---------------------------------------------------------------------------

const setLocaleEnabledSchema = z.object({
  code: localeCodeSchema,
  enabled: z.boolean(),
});

/**
 * Bật/tắt một ngôn ngữ.
 *
 * Bất biến "đúng một mặc định và nó đang bật" được kiểm trong transaction ở tầng
 * ghi, không kiểm ở đây: đây là một endpoint HTTP, còn tầng ghi là chỗ duy nhất
 * mọi lối ghi đều đi qua.
 */
export async function setLocaleEnabled(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = setLocaleEnabledSchema.parse(raw);
  await content.setLocaleEnabled(input.code, input.enabled);
}

/** Đặt ngôn ngữ mặc định — đích của toàn bộ cơ chế fallback. */
export async function setDefaultLocale(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = z.object({ code: localeCodeSchema }).parse(raw);
  await content.setDefaultLocale(input.code);
}

// ---------------------------------------------------------------------------
// Cây điều hướng
// ---------------------------------------------------------------------------

/**
 * Năm cửa ghi của cây, mỗi cửa mở đầu bằng `requireAdmin()` như mọi action khác.
 *
 * Sáu bất biến của cây (spec §4) **không** kiểm ở đây: chúng được kiểm trong
 * transaction của `writeNavTree`, trên trạng thái sẽ được cam kết. Kiểm ở tầng
 * này chỉ là kiểm hình dạng dữ liệu đến từ mạng.
 *
 * Nút lá đi qua **slug**, không qua id: xem `content.navTargetIds`.
 */
const navKindSchema = z.enum(navKindValues);

const navLabelsSchema = z.array(
  z.object({ locale: localeCodeSchema, label: z.string() }),
);

const createNavNodeSchema = z.object({
  parentId: z.string().min(1).nullable(),
  kind: navKindSchema,
  labels: navLabelsSchema.optional(),
  appSlug: z.string().min(1).optional(),
  docSlug: z.string().min(1).optional(),
});

export async function createNavNode(raw: unknown): Promise<{ id: string }> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = createNavNodeSchema.parse(raw);
  const target = await content.navTargetIds(input);

  const node = await content.createNavNode({
    parentId: input.parentId,
    kind: input.kind,
    ...(input.labels ? { labels: input.labels } : {}),
    ...target,
  });

  return { id: node.id };
}

const updateNavNodeSchema = z.object({
  id: z.string().min(1),
  status: statusSchema,
  labels: navLabelsSchema.optional(),
});

export async function updateNavNode(raw: unknown): Promise<{ id: string }> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = updateNavNodeSchema.parse(raw);
  const node = await content.updateNavNode(input);
  return { id: node.id };
}

export async function deleteNavNode(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = z.object({ id: z.string().min(1) }).parse(raw);
  await content.deleteNavNode(input.id);
}

const moveNavNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  index: z.number().int().min(0),
});

export async function moveNavNode(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = moveNavNodeSchema.parse(raw);
  await content.moveNavNode(input);
}

const reorderNavSiblingsSchema = z.object({
  parentId: z.string().min(1).nullable(),
  ids: z.array(z.string().min(1)).min(1),
});

export async function reorderNavSiblings(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = reorderNavSiblingsSchema.parse(raw);
  await content.reorderSiblings(input);
}

// ---------------------------------------------------------------------------
// Ảnh
// ---------------------------------------------------------------------------

/**
 * Cắt `Media` của Prisma về đúng phần trình duyệt cần.
 *
 * Không trả nguyên bản ghi: `createdAt` là `Date`, và mọi trường khác của Prisma
 * đều là thứ trình duyệt không cần biết. Kiểu `MediaItem` khai ở
 * `src/components/admin/media.ts` — module thuần, không `"use client"` — nên cả
 * máy chủ lẫn trình duyệt dùng chung được đúng một định nghĩa.
 */
function toMediaItem(media: {
  id: string;
  url: string;
  pathname: string;
  alt: string | null;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
}): MediaItem {
  return {
    id: media.id,
    url: media.url,
    pathname: media.pathname,
    alt: media.alt,
    sizeBytes: media.sizeBytes,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
  };
}

/** Danh sách ảnh cho bộ chọn ảnh. Không ghi gì, nhưng vẫn kiểm quyền trước. */
export async function listMedia(): Promise<MediaItem[]> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const rows = await listImages();
  return rows.map(toMediaItem);
}

/**
 * Tải một ảnh lên thư viện.
 *
 * Nhận `FormData` vì đó là dạng duy nhất chuyển được tệp qua Server Action. Kiểm
 * kích thước ở đây **lần nữa** dù trình duyệt đã kiểm: action là endpoint HTTP
 * riêng, ai cũng gọi được, và trần dung lượng là thứ bảo vệ kho ảnh chứ không
 * phải thứ trang trí cho giao diện.
 *
 * `alt` mặc định là tên tệp gốc — `uploadImage` cố tình không lưu tên tệp (nó là
 * vector path traversal), nên nếu không đặt vào `alt` thì thư viện chỉ còn UUID để
 * hiện. Người soạn sửa lại `alt` ngay trong bài khi chèn ảnh.
 */
export async function uploadMedia(formData: FormData): Promise<MediaItem> {
  await requireAdmin(); // luôn là dòng đầu tiên

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Không nhận được tệp nào. Chọn lại ảnh rồi thử lần nữa.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Tệp "${file.name}" nặng ${(file.size / 1024 / 1024).toFixed(1)} MB, ` +
        `vượt giới hạn ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Hãy nén ảnh rồi tải lại.`,
    );
  }

  const media = await uploadImage({
    bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name,
    alt: file.name,
  });

  return toMediaItem(media);
}

/**
 * Xoá một ảnh khỏi kho và khỏi bảng `Media`.
 *
 * Không dò xem ảnh còn được trang nào dùng: ảnh nằm trong thân bài markdown dưới
 * dạng chuỗi, nên câu trả lời "còn ai dùng không" chỉ có thể là phỏng đoán. Giao
 * diện vì vậy hỏi lại một bước trước khi gọi tới đây.
 */
export async function deleteMedia(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = z.object({ id: z.string().min(1) }).parse(raw);
  await deleteImage(input.id);
}

/**
 * Kết xuất markdown cho tab "Xem trước" của trình soạn nội dung.
 *
 * Không ghi gì, nhưng vẫn `requireAdmin()` ở dòng đầu — vừa giữ đúng một quy tắc
 * cho mọi action, vừa để CMS không biến thành máy kết xuất markdown mở cho cả
 * Internet (shiki tô màu mã là việc tốn CPU).
 *
 * Kết xuất ở máy chủ chứ không ở trình duyệt: `renderMarkdown` kéo theo shiki và
 * toàn bộ ngữ pháp tô màu, và quan trọng hơn — tab xem trước phải chạy **đúng**
 * đường ống mà trang công khai chạy, nếu không thì nó xem trước một thứ khác.
 */
export async function renderMarkdownPreview(raw: unknown): Promise<string> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const markdown = z.string().max(200_000).parse(raw);
  return renderMarkdown(markdown);
}

/**
 * Đăng xuất. Không ghi dữ liệu, nhưng vẫn `requireAdmin()` trước: giữ đúng một
 * quy tắc "mọi action mở đầu bằng requireAdmin" thì việc thiếu nó ở bất kỳ hàm
 * nào cũng lộ ra ngay khi đọc, không cần cân nhắc từng trường hợp.
 */
export async function signOutAction(): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  await signOut();
}
