"use client";

import { useTranslations } from "next-intl";

import { slugify } from "@/lib/slug";
import { MarkdownEditor } from "./MarkdownEditor";
import type { MediaItem } from "./media";
import styles from "./SectionRow.module.css";

/** Nội dung một mục ở **ngôn ngữ đang sửa**, cộng `anchor` dùng chung. */
export type SectionRowValue = {
  /** Không theo ngôn ngữ: liên kết `#anchor` phải trỏ đúng một chỗ ở mọi bản dịch. */
  anchor: string;
  title: string;
  /** Markdown thô. Thân bài lưu dạng `{ type: "markdown", content }`. */
  body: string;
};

export type SectionRowProps = {
  id: string;
  value: SectionRowValue;
  onChange: (patch: Partial<SectionRowValue>) => void;
  locale: string;
  /** Server action kết xuất markdown cho tab xem trước. */
  renderPreview?: (markdown: string) => Promise<string>;
  /** Server action liệt kê ảnh; đi tiếp xuống nút Ảnh của ô soạn markdown. */
  listMedia?: () => Promise<MediaItem[]>;
};

/**
 * Khối sửa một mục nội dung: tiêu đề, anchor, thân bài markdown.
 *
 * Anchor **không** theo ngôn ngữ và cũng không tự sinh lại khi tiêu đề đổi: nó
 * là địa chỉ công khai của mục (`/apps/x#quick-start`), và tự đổi nó sẽ phá mọi
 * liên kết ai đó đã lưu. Chỉ khi ô còn trống thì bấm "Lấy từ tiêu đề" mới điền —
 * lúc đó chưa có liên kết nào để phá.
 */
export function SectionRow({
  id,
  value,
  onChange,
  locale,
  renderPreview,
  listMedia,
}: SectionRowProps) {
  const t = useTranslations();
  const code = locale.toUpperCase();

  return (
    <div className={styles.wrap}>
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
          <label className={styles.label} htmlFor={`${id}-anchor`}>
            {t("admin.editor.fieldAnchor")}
          </label>
          <div className={styles.inline}>
            <input
              className={`${styles.input} ${styles.mono}`}
              id={`${id}-anchor`}
              type="text"
              value={value.anchor}
              onChange={(event) => onChange({ anchor: event.target.value })}
              spellCheck={false}
              aria-describedby={`${id}-anchor-hint`}
            />
            <button
              className={styles.smallButton}
              type="button"
              onClick={() => onChange({ anchor: slugify(value.title) })}
              disabled={value.title.trim() === ""}
            >
              {t("admin.editor.anchorFromTitle")}
            </button>
          </div>
          <p className={styles.hint} id={`${id}-anchor-hint`}>
            {t("admin.editor.fieldAnchorHint")}
          </p>
        </div>
      </div>

      <MarkdownEditor
        id={`${id}-body`}
        label={`${t("admin.editor.fieldBody")} · ${code}`}
        value={value.body}
        onChange={(body) => onChange({ body })}
        renderPreview={renderPreview}
        listMedia={listMedia}
      />
    </div>
  );
}
