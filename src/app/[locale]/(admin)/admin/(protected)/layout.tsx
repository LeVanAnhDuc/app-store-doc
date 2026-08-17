import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/server/auth";
import { getAdminCounts } from "@/server/content/queries";
import { signOutAction } from "../actions";

/**
 * Lớp bảo vệ của CMS và khung giao diện dùng chung.
 *
 * `requireAdmin()` ở đây là **lớp thứ hai**, không phải lớp duy nhất: nó chỉ
 * chặn việc *xem* trang. Mỗi server action ghi dữ liệu tự gọi `requireAdmin()`
 * ở dòng đầu (xem `../actions.ts`) vì action là endpoint HTTP riêng và không
 * chạy qua layout nào.
 *
 * Nhóm `(protected)` không thêm đoạn nào vào URL: `page.tsx` ở đây là `/admin`,
 * `apps/page.tsx` là `/admin/apps`. Nó tồn tại chỉ để `login/` — nằm ngoài nhóm
 * — không bị lớp kiểm quyền này bao lấy.
 */

/**
 * CMS không bao giờ được phục vụ từ bản đã dựng sẵn: người vừa bấm Lưu phải thấy
 * dữ liệu mới. `requireAdmin()` đọc cookie nên Next đã coi cây này là động, khai
 * báo thêm ở đây để ý định không phụ thuộc vào chi tiết cài đặt của tầng auth.
 */
export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await requireAdmin();
  const counts = await getAdminCounts();

  return (
    <AdminShell
      locale={locale}
      counts={counts}
      email={user.email}
      signOutAction={signOutAction}
    >
      {children}
    </AdminShell>
  );
}
