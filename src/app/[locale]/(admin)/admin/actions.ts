"use server";

import { z } from "zod";

import { appInputSchema, statusSchema } from "@/lib/schemas";
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

/**
 * Đăng xuất. Không ghi dữ liệu, nhưng vẫn `requireAdmin()` trước: giữ đúng một
 * quy tắc "mọi action mở đầu bằng requireAdmin" thì việc thiếu nó ở bất kỳ hàm
 * nào cũng lộ ra ngay khi đọc, không cần cân nhắc từng trường hợp.
 */
export async function signOutAction(): Promise<void> {
  await requireAdmin(); // luôn là dòng đầu tiên
  await signOut();
}
