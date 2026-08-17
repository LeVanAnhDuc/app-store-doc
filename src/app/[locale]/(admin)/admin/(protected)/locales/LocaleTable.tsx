"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import type { AdminLocaleRow } from "@/server/content/queries";
import styles from "./LocaleTable.module.css";

/**
 * Bảng ngôn ngữ: bật/tắt và đặt mặc định.
 *
 * Hai bất biến của spec §6.4 — **đúng một** ngôn ngữ mặc định, và ngôn ngữ đó phải
 * đang **bật** — được canh ở hai lớp, và lớp dưới mới là lớp thật:
 *
 * 1. Ở đây: nút "Tắt" của ngôn ngữ mặc định bị vô hiệu hoá kèm câu giải thích, để
 *    người dùng không phải bấm rồi mới biết là không được.
 * 2. Trong `assertSingleDefaultLocale`, bên trong transaction của tầng ghi. Server
 *    action là endpoint HTTP riêng nên mọi thứ canh ở trình duyệt đều bỏ qua được;
 *    lỗi từ tầng ghi hiện nguyên văn ở ô thông báo dưới bảng.
 */
export type LocaleTableProps = {
  rows: AdminLocaleRow[];
  setEnabled: (input: { code: string; enabled: boolean }) => Promise<void>;
  setDefault: (input: { code: string }) => Promise<void>;
};

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function LocaleTable({ rows, setEnabled, setDefault }: LocaleTableProps) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

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

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>{t("admin.locales.hint")}</p>

      <DataTable label={t("admin.locales.tableLabel")}>
        <thead>
          <tr>
            <th scope="col">{t("admin.locales.colCode")}</th>
            <th scope="col">{t("admin.locales.colLabel")}</th>
            <th scope="col">{t("admin.locales.colState")}</th>
            <th scope="col">{t("admin.locales.colRouting")}</th>
            <th scope="col">{t("admin.apps.colActions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
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
