"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Badge, type StatusKind } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { OrderControls, type OrderMove } from "@/components/ui/OrderControls";
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

/**
 * Chuyển một phần tử từ `from` sang `to`, trả mảng mới.
 *
 * Rút một phần tử ra rồi chèn lại, **không** hoán đổi hai ô: với hai vị trí liền
 * nhau hai cách cho cùng kết quả, nhưng "đưa lên đầu" thì không — hoán đổi phần
 * tử thứ năm với phần tử đầu sẽ ném phần tử đầu xuống vị trí thứ năm thay vì
 * đẩy cả bốn phần tử giữa xuống một bậc.
 */
function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
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
 * Thứ tự đổi bằng `OrderControls` — cùng một bộ nút với trình soạn cây và với
 * hai danh sách trong trang soạn nội dung, nên người vận hành học một lần dùng
 * được ở mọi chỗ. Bộ nút **không** bị vô hiệu trong lúc `pending`: mỗi lần bấm
 * gửi đi *cả* danh sách id theo thứ tự cục bộ mới nhất, nên bấm ba lần liên tiếp
 * thì lần ghi cuối vẫn mang đúng thứ tự cuối. Khoá nút lại chỉ đổi một chuyện
 * đúng thành một chuyện khó chịu.
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

  /** Bốn hướng của `OrderControls` quy về một chỉ số đích. */
  function moveTo(index: number, to: OrderMove) {
    const target =
      to === "top" ? 0 : to === "bottom" ? order.length - 1 : to === "up" ? index - 1 : index + 1;

    if (target === index || target < 0 || target >= order.length) return;

    const next = move(order, index, target);
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
                  {/*
                    Cùng bộ nút với trình soạn cây và với hai danh sách trong
                    trang soạn nội dung (spec §7.1): bốn ký hiệu như nhau, luật
                    mờ ở hai đầu như nhau, ngưỡng vùng bấm như nhau. Hai nút mũi
                    tên tự chế trước đây chỉ cao 24px và không có "lên đầu" /
                    "xuống cuối" — với mười ứng dụng thì đưa mục cuối lên đầu
                    tốn chín lần bấm, mỗi lần một lượt ghi máy chủ.

                    Nhãn dựng theo từng dòng để mỗi nút có tên gọi riêng: bảng
                    mười dòng mà bốn mươi nút cùng tên thì trình đọc màn hình
                    không nói được nút nào thuộc ứng dụng nào.
                  */}
                  <OrderControls
                    index={index}
                    total={order.length}
                    onMove={(to) => moveTo(index, to)}
                    labels={{
                      top: t("admin.apps.orderTop", { name: label }),
                      up: t("admin.apps.orderUp", { name: label }),
                      down: t("admin.apps.orderDown", { name: label }),
                      bottom: t("admin.apps.orderBottom", { name: label }),
                    }}
                  />
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
                  <div className={styles.actionGroup}>
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
