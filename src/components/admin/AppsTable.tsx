"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Badge, type StatusKind } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import type { AdminAppRow } from "@/server/content/queries";
import styles from "./AppsTable.module.css";

/** Hai trạng thái mà bảng danh sách bật/tắt được. `ARCHIVED` chỉ đọc ở đây. */
type PublishState = "DRAFT" | "PUBLISHED";

export type AppsTableProps = {
  rows: AdminAppRow[];
  /** Server action đổi trạng thái publish. */
  setStatus: (input: { id: string; status: PublishState }) => Promise<void>;
  /** Server action sắp lại thứ tự. `ids` là danh sách đầy đủ theo thứ tự mới. */
  reorder: (input: { ids: string[] }) => Promise<void>;
};

/**
 * Ánh xạ trạng thái biên tập sang màu trạng thái.
 *
 * Dùng lại đúng năm màu trạng thái của `Badge` thay vì thêm bảng màu mới: mockup
 * màn 04 đã vẽ "Bản nháp" bằng `b-planned`, và design-rules §2 nói bốn màu này
 * *chỉ* dành cho trạng thái — trạng thái publish đúng là một trong số đó.
 */
const STATUS_KIND: Record<AdminAppRow["status"], StatusKind> = {
  DRAFT: "planned",
  PUBLISHED: "connected",
  ARCHIVED: "private",
};

const STATUS_LABEL_KEY: Record<AdminAppRow["status"], string> = {
  DRAFT: "admin.publishState.draft",
  PUBLISHED: "admin.publishState.published",
  ARCHIVED: "admin.publishState.archived",
};

/** Đổi chỗ hai phần tử liền nhau, trả mảng mới. */
function swap<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Bảng danh sách ứng dụng của CMS: sắp lại thứ tự và bật/tắt công khai.
 *
 * Thứ tự giữ trong state cục bộ để bảng nhảy ngay khi bấm, nhưng nguồn sự thật
 * vẫn là máy chủ: mỗi lần bấm gọi server action rồi `router.refresh()`. Action
 * đổ thì thông báo lỗi hiện ra và lần refresh kế tiếp kéo lại thứ tự thật —
 * không có trạng thái nào chỉ tồn tại trong trình duyệt.
 *
 * Kéo thả là việc của Task 15 (`SortableList`). Hai nút mũi tên ở đây làm được
 * cùng việc mà bàn phím dùng được ngay.
 */
export function AppsTable({ rows, setStatus, reorder }: AppsTableProps) {
  const t = useTranslations();
  // Đường dẫn trang soạn thảo cần tiền tố locale. Lấy từ next-intl thay vì thêm
  // một prop nữa: bảng đã nằm trong `NextIntlClientProvider` của nhóm quản trị.
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [order, setOrder] = useState<AdminAppRow[]>(rows);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Máy chủ là nguồn sự thật: dữ liệu mới từ `router.refresh()` ghi đè state cục bộ.
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setOrder(rows);
  }

  function run(work: () => Promise<void>, okText: string) {
    setNotice(null);
    startTransition(async () => {
      try {
        await work();
        setNotice({ tone: "ok", text: okText });
        router.refresh();
      } catch (error) {
        setNotice({ tone: "error", text: t("admin.apps.failed", { reason: reasonOf(error) }) });
      }
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;

    const next = swap(order, index, target);
    setOrder(next);
    run(() => reorder({ ids: next.map((row) => row.id) }), t("admin.apps.orderSaved"));
  }

  function togglePublish(row: AdminAppRow) {
    const status: PublishState = row.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    run(() => setStatus({ id: row.id, status }), t("admin.apps.statusSaved"));
  }

  if (order.length === 0) {
    // Màn hình trống là lời mời hành động, không phải chỗ than thở.
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t("admin.apps.emptyTitle")}</p>
        <p className={styles.emptyBody}>{t("admin.apps.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>{t("admin.apps.orderHint")}</p>

      <DataTable label={t("admin.apps.tableLabel")}>
        <thead>
          <tr>
            <th scope="col">{t("admin.apps.colOrder")}</th>
            <th scope="col">{t("admin.apps.colName")}</th>
            <th scope="col">{t("admin.apps.colKind")}</th>
            <th scope="col">{t("admin.apps.colStatus")}</th>
            <th scope="col">{t("admin.apps.colTranslations")}</th>
            <th scope="col">{t("admin.apps.colActions")}</th>
          </tr>
        </thead>
        <tbody>
          {order.map((row, index) => {
            // Nhãn cho trình đọc màn hình: thiếu bản dịch thì đành lấy slug, vì
            // nút vẫn phải có tên phân biệt được. Không dùng slug ở chỗ hiển thị.
            const label = row.name ?? row.slug;

            return (
              <tr key={row.id}>
                <td>
                  <div className={styles.moveGroup}>
                    <button
                      className={styles.move}
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={pending || index === 0}
                      aria-label={t("admin.apps.moveUp", { name: label })}
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      className={styles.move}
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={pending || index === order.length - 1}
                      aria-label={t("admin.apps.moveDown", { name: label })}
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </div>
                </td>

                <td>
                  {row.name ? (
                    <span className={styles.name}>{row.name}</span>
                  ) : (
                    <span className={styles.noName}>{t("admin.apps.noName")}</span>
                  )}
                  <span className={styles.slug}>{row.slug}</span>
                </td>

                <td>{t(`admin.kind.${row.kind === "CORE" ? "core" : "satellite"}`)}</td>

                <td>
                  <Badge kind={STATUS_KIND[row.status]}>{t(STATUS_LABEL_KEY[row.status])}</Badge>
                </td>

                <td>
                  {row.missingLocales.length === 0 ? (
                    <span className={styles.complete}>{t("admin.apps.translationsComplete")}</span>
                  ) : (
                    <span className={styles.missing}>
                      {t("admin.missingTranslation")}: {row.missingLocales.join(", ")}
                    </span>
                  )}
                </td>

                <td>
                  <div className={styles.moveGroup}>
                    {/* Liên kết bằng slug: nó là thứ người vận hành đọc được
                        trên URL. Trang soạn thảo nhận cả id lẫn slug. */}
                    <a className={styles.action} href={`/${locale}/admin/apps/${row.slug}`}>
                      {t("admin.apps.edit")}
                    </a>
                    <button
                      className={styles.action}
                      type="button"
                      onClick={() => togglePublish(row)}
                      disabled={pending}
                    >
                      {row.status === "PUBLISHED"
                        ? t("admin.apps.unpublish")
                        : t("admin.apps.publish")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
      <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
        {notice?.text ?? ""}
      </p>
    </div>
  );
}
