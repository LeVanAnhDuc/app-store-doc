"use server";

import { z } from "zod";

import {
  appInputSchema,
  featureInputSchema,
  sectionInputSchema,
  statusSchema,
} from "@/lib/schemas";
import { renderMarkdown } from "@/lib/markdown";
import { requireAdmin, signOut } from "@/server/auth";
import * as content from "@/server/content/mutations";

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
 * Một dòng trong danh sách gửi lên: `id` vắng mặt là mục vừa thêm trong lần soạn
 * này. `order` không cần gửi — tầng ghi lấy thứ tự từ vị trí trong mảng, vì kéo
 * thả trong CMS là thứ tự hiển thị thật (spec §8.2.4).
 */
const saveFeaturesSchema = z.object({
  appSlug: z.string().min(1),
  locale: localeCodeSchema,
  features: z.array(featureInputSchema.extend({ id: z.string().min(1).optional() })),
});

/**
 * `Section` dùng chung cho App và DocPage, nên chủ sở hữu phải nói rõ là bên nào.
 * Nhánh `docSlug` chưa có trang nào gọi tới; nó nằm đây vì tầng ghi đã nhận cả
 * hai, và Task 16 dùng lại đúng action này cho trang hướng dẫn.
 */
const sectionOwnerSchema = z.union([
  z.object({ appSlug: z.string().min(1) }),
  z.object({ docSlug: z.string().min(1) }),
]);

const saveSectionsSchema = z.object({
  owner: sectionOwnerSchema,
  locale: localeCodeSchema,
  sections: z.array(sectionInputSchema.extend({ id: z.string().min(1).optional() })),
});

/**
 * Ghi đè danh sách tính năng của một ứng dụng.
 *
 * Danh sách là **đầy đủ**: mục nào không có trong đó thì bị xoá. Trình soạn nội
 * dung vì vậy luôn gửi cả danh sách, kể cả những mục nó không sửa.
 */
export async function saveFeatures(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = saveFeaturesSchema.parse(raw);
  await content.saveFeatures(input);
}

/** Ghi đè danh sách mục nội dung. Cùng quy ước "danh sách đầy đủ" như trên. */
export async function saveSections(raw: unknown): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  const input = saveSectionsSchema.parse(raw);
  await content.saveSections(input);
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
