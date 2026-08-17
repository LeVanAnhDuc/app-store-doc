"use client";

import { useTranslations } from "next-intl";

import styles from "./LocaleSwitch.module.css";

export type LocaleSwitchProps = {
  /** Ngôn ngữ site đang phục vụ, theo `locales.generated.ts`. */
  locales: readonly string[];
  /** Ngôn ngữ đang được sửa. */
  value: string;
  onChange: (locale: string) => void;
  /** Ngôn ngữ mặc định của site — bản gốc mà cơ chế fallback lùi về. */
  defaultLocale: string;
};

/**
 * Nút chuyển ngôn ngữ **một chỗ duy nhất trên đầu trang** (spec §8.2.1, mockup
 * màn 04 `.m-lang`).
 *
 * Không phải một cặp ô vi/en cạnh **mỗi** trường. Người soạn viết trọn vẹn một
 * ngôn ngữ rồi chuyển; cách này ít nhiễu hơn hẳn ngay khi có ngôn ngữ thứ ba, và
 * nó cũng khiến ranh giới "khối này không theo ngôn ngữ / khối kia có" nhìn thấy
 * được — đổi ngôn ngữ mà nửa trang trên không nhúc nhích là câu trả lời cho
 * "sửa slug ở bản EN thì bản VI có đổi không".
 *
 * Đây **không** phải điều hướng: nó không đổi URL và không tải lại trang, vì bản
 * nháp đang sửa nằm trong bộ nhớ trình duyệt. Đổi URL sẽ mất phần chưa lưu.
 */
export function LocaleSwitch({ locales, value, onChange, defaultLocale }: LocaleSwitchProps) {
  const t = useTranslations();

  return (
    <div className={styles.group} role="group" aria-label={t("admin.editor.localeLabel")}>
      {locales.map((code) => {
        const current = code === value;

        return (
          <button
            key={code}
            className={styles.item}
            type="button"
            onClick={() => onChange(code)}
            // `aria-pressed` chứ không phải `aria-current`: đây là công tắc chọn
            // chế độ soạn, không phải liên kết tới trang đang mở.
            aria-pressed={current}
            title={
              code === defaultLocale
                ? t("admin.editor.localeDefaultHint", { locale: code.toUpperCase() })
                : undefined
            }
          >
            <span aria-hidden="true">{code.toUpperCase()}</span>
            <span className={styles.srOnly}>
              {t("admin.editor.localeSwitch", { locale: code.toUpperCase() })}
            </span>
            {code === defaultLocale ? (
              <span className={styles.mark} aria-hidden="true">
                ·
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
