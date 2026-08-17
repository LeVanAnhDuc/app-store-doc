"use client";

import { useTranslations } from "next-intl";

import styles from "./FeatureRow.module.css";

/** Nội dung một tính năng ở **ngôn ngữ đang sửa**, cộng `icon` dùng chung. */
export type FeatureRowValue = {
  /** Tên icon lucide. Không theo ngôn ngữ. */
  icon: string;
  title: string;
  description: string;
};

export type FeatureRowProps = {
  /** Tiền tố cho `id` của từng ô nhập; phải duy nhất trong trang. */
  id: string;
  value: FeatureRowValue;
  onChange: (patch: Partial<FeatureRowValue>) => void;
  /** Ngôn ngữ đang sửa, hiện trong nhãn để không nhầm mình đang gõ bản nào. */
  locale: string;
};

/**
 * Khối sửa một tính năng, mở ra dưới dòng trong `SortableList`.
 *
 * Tiêu đề và mô tả **theo ngôn ngữ**; icon thì không — nó là cùng một hình ở mọi
 * bản dịch. Nhãn nói rõ điều đó ngay tại chỗ, vì đây là ngoại lệ duy nhất trong
 * một khối vốn đã nằm dưới nhãn "đang sửa bản VI".
 */
export function FeatureRow({ id, value, onChange, locale }: FeatureRowProps) {
  const t = useTranslations();
  const code = locale.toUpperCase();

  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-title`}>
          {t("admin.editor.fieldTitle")} · {code}
        </label>
        <input
          className={styles.input}
          id={`${id}-title`}
          type="text"
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-icon`}>
          {t("admin.editor.fieldIcon")}
        </label>
        <input
          className={`${styles.input} ${styles.mono}`}
          id={`${id}-icon`}
          type="text"
          value={value.icon}
          onChange={(event) => onChange({ icon: event.target.value })}
          spellCheck={false}
        />
        <p className={styles.hint}>{t("admin.editor.fieldIconHint")}</p>
      </div>

      <div className={styles.wide}>
        <label className={styles.label} htmlFor={`${id}-description`}>
          {t("admin.editor.fieldDescription")} · {code}
        </label>
        <textarea
          className={styles.area}
          id={`${id}-description`}
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
