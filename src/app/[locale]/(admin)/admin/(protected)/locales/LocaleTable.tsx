"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { OrderControls, type OrderMove } from "@/components/ui/OrderControls";
import type { AdminLocaleRow } from "@/server/content/queries";
import styles from "./LocaleTable.module.css";

/**
 * Bảng ngôn ngữ: sắp thứ tự, bật/tắt và đặt mặc định.
 *
 * Hai bất biến của spec §6.4 — **đúng một** ngôn ngữ mặc định, và ngôn ngữ đó phải
 * đang **bật** — được canh ở hai lớp, và lớp dưới mới là lớp thật:
 *
 * 1. Ở đây: nút "Tắt" của ngôn ngữ mặc định bị vô hiệu hoá kèm câu giải thích, để
 *    người dùng không phải bấm rồi mới biết là không được.
 * 2. Trong `assertSingleDefaultLocale`, bên trong transaction của tầng ghi. Server
 *    action là endpoint HTTP riêng nên mọi thứ canh ở trình duyệt đều bỏ qua được;
 *    lỗi từ tầng ghi hiện nguyên văn ở ô thông báo dưới bảng.
 *
 * Thứ tự **không** đụng tới hai bất biến đó: nó chỉ quyết định danh sách nút chuyển
 * ngôn ngữ xếp từ trái sang phải như thế nào, nên mọi dòng đều sắp lại được, kể cả
 * dòng mặc định và dòng đang tắt.
 */
export type LocaleTableProps = {
  rows: AdminLocaleRow[];
  setEnabled: (input: { code: string; enabled: boolean }) => Promise<void>;
  setDefault: (input: { code: string }) => Promise<void>;
  /** Server action sắp lại thứ tự. `codes` là danh sách đầy đủ theo thứ tự mới. */
  reorder: (input: { codes: string[] }) => Promise<void>;
};

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Chuyển một phần tử từ `from` sang `to`, trả mảng mới.
 *
 * Rút ra rồi chèn lại, **không** hoán đổi hai ô: với hai vị trí liền nhau hai cách
 * cho cùng kết quả, nhưng "đưa lên đầu" thì không — hoán đổi sẽ ném phần tử đầu
 * xuống đúng chỗ vừa rời đi thay vì đẩy cả khối ở giữa xuống một bậc.
 */
function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

export function LocaleTable({ rows, setEnabled, setDefault, reorder }: LocaleTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Thứ tự giữ trong state cục bộ để bảng nhảy ngay khi bấm, nhưng nguồn sự thật
  // vẫn là máy chủ: dữ liệu mới từ `router.refresh()` ghi đè state cục bộ. Cùng
  // lối `AppsTable`.
  const [order, setOrder] = useState<AdminLocaleRow[]>(rows);
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
        setNotice({ tone: "error", text: t("admin.locales.failed", { reason: reasonOf(error) }) });
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
    run(() => reorder({ codes: next.map((row) => row.code) }), t("admin.locales.orderSaved"));
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>{t("admin.locales.hint")}</p>
      <p className={styles.hint}>{t("admin.locales.orderHint")}</p>

      <DataTable label={t("admin.locales.tableLabel")}>
        <thead>
          <tr>
            <th scope="col">{t("admin.locales.colOrder")}</th>
            <th scope="col">{t("admin.locales.colCode")}</th>
            <th scope="col">{t("admin.locales.colLabel")}</th>
            <th scope="col">{t("admin.locales.colState")}</th>
            <th scope="col">{t("admin.locales.colRouting")}</th>
            <th scope="col">{t("admin.apps.colActions")}</th>
          </tr>
        </thead>
        <tbody>
          {order.map((row, index) => (
            <tr key={row.code}>
              <td>
                {/*
                  Cùng bộ nút với bảng ứng dụng và trình soạn cây: bốn ký hiệu như
                  nhau, luật mờ ở hai đầu như nhau. Bộ nút **không** bị vô hiệu
                  trong lúc `pending` — mỗi lần bấm gửi đi *cả* danh sách mã theo
                  thứ tự cục bộ mới nhất, nên bấm ba lần liên tiếp thì lượt ghi
                  cuối vẫn mang đúng thứ tự cuối.

                  Nhãn dựng theo từng dòng để mỗi nút có tên gọi riêng; ở đây tên
                  đó là **mã** ngôn ngữ chứ không phải tên gọi, vì mã là thứ vừa
                  ngắn vừa chắc chắn có — `label` do người vận hành nhập.
                */}
                <OrderControls
                  index={index}
                  total={order.length}
                  onMove={(to) => moveTo(index, to)}
                  labels={{
                    top: t("admin.locales.orderTop", { code: row.code }),
                    up: t("admin.locales.orderUp", { code: row.code }),
                    down: t("admin.locales.orderDown", { code: row.code }),
                    bottom: t("admin.locales.orderBottom", { code: row.code }),
                  }}
                />
              </td>

              <td className={styles.code}>{row.code}</td>
              <td>{row.label}</td>

              <td>
                <div className={styles.states}>
                  <Badge kind={row.enabled ? "connected" : "planned"}>
                    {row.enabled ? t("admin.locales.on") : t("admin.locales.off")}
                  </Badge>
                  {row.isDefault ? (
                    <Badge kind="core">{t("admin.locales.isDefault")}</Badge>
                  ) : null}
                </div>
              </td>

              <td>
                {row.routed ? (
                  <span className={styles.routed}>{t("admin.locales.routed")}</span>
                ) : (
                  <span className={styles.notRouted}>{t("admin.locales.notRouted")}</span>
                )}
              </td>

              <td>
                <div className={styles.actions}>
                  <button
                    className={styles.action}
                    type="button"
                    disabled={pending || (row.isDefault && row.enabled)}
                    // Tắt ngôn ngữ mặc định làm fallback trỏ tới ngôn ngữ không
                    // hiển thị: chặn ngay, kèm lý do đọc được.
                    title={
                      row.isDefault && row.enabled ? t("admin.locales.cannotDisable") : undefined
                    }
                    onClick={() =>
                      run(
                        () => setEnabled({ code: row.code, enabled: !row.enabled }),
                        row.enabled
                          ? t("admin.locales.turnedOff", { code: row.code })
                          : t("admin.locales.turnedOn", { code: row.code }),
                      )
                    }
                  >
                    {row.enabled ? t("admin.locales.turnOff") : t("admin.locales.turnOn")}
                  </button>

                  <button
                    className={styles.action}
                    type="button"
                    disabled={pending || row.isDefault || !row.enabled}
                    title={!row.enabled ? t("admin.locales.cannotDefault") : undefined}
                    onClick={() =>
                      run(
                        () => setDefault({ code: row.code }),
                        t("admin.locales.defaultSet", { code: row.code }),
                      )
                    }
                  >
                    {t("admin.locales.makeDefault")}
                  </button>
                </div>

                {row.isDefault && row.enabled ? (
                  <p className={styles.rowNote}>{t("admin.locales.cannotDisable")}</p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
      <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
        {notice?.text ?? ""}
      </p>
    </div>
  );
}
