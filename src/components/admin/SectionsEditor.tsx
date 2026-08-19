"use client";

import { useTranslations } from "next-intl";

import { AdminBlock } from "./AdminShell";
import type { MediaItem } from "./media";
import { SectionRow } from "./SectionRow";
import { SortableList, type SortableItem } from "./SortableList";
import styles from "./SectionsEditor.module.css";

/**
 * Khối "Mục nội dung" — dùng chung cho ứng dụng và trang hướng dẫn.
 *
 * `Section` trong data model đã dùng chung cho `App` và `DocPage`, và
 * `saveSections` nhận `owner: {appSlug} | {docSlug}`, nên khối giao diện này là
 * chỗ duy nhất còn lại bị dính cứng vào một bên. Tách ra khỏi `AppEditor` thay vì
 * thêm prop `owner` cho `AppEditor` là chọn có lý do:
 *
 * - Trang hướng dẫn **không có** khối Tính năng, không có `kind`, `techStack`,
 *   `repoUrl`, và không có ba trạng thái tích hợp. Truyền `owner` vào `AppEditor`
 *   sẽ biến nó thành một component có hai nửa, mà mỗi lần render chỉ dùng một nửa
 *   — cùng loại thiết kế đã sinh ra khiếm khuyết (A) ở tầng ghi.
 * - Phần thật sự dùng chung chỉ là **danh sách mục**: kéo thả, mở/đóng, anchor,
 *   ô soạn markdown. Đó đúng là ranh giới của component này.
 *
 * Component **không giữ state**: nó nhận cả danh sách và gọi `onChange` với danh
 * sách mới. Nơi gọi vẫn là nguồn sự thật duy nhất, vì nó là nơi bấm Lưu và cũng
 * là nơi đếm độ hoàn thiện bản dịch.
 */

/**
 * Bản nháp một mục nội dung phía trình duyệt.
 *
 * `key` là định danh phía trình duyệt, luôn có; `id` là định danh trong DB, chỉ
 * mục đã lưu mới có. Kéo thả và xoá dùng `key` để mục vừa thêm cũng sắp xếp được
 * trước khi lưu lần đầu.
 *
 * `text` khuyết khoá ở ngôn ngữ chưa dịch — không phải chuỗi rỗng, mà là **không
 * có khoá** — đúng như `getAppForEditor` trả về.
 */
export type SectionDraft = {
  key: string;
  id?: string;
  /** Không theo ngôn ngữ: `#anchor` phải giống nhau ở mọi bản dịch. */
  anchor: string;
  text: Record<string, { title: string; body: string }>;
};

/** Anchor hợp lệ — cùng biểu thức với `slugSchema` trong `src/lib/schemas.ts`. */
export const ANCHOR_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Khoá cho mục vừa thêm.
 *
 * `crypto.randomUUID` chỉ có trong ngữ cảnh bảo mật (https hoặc localhost), nên
 * có nhánh dự phòng: chạy sau proxy http mà nút "Thêm mục" ném
 * `undefined is not a function` thì cả trang soạn thảo coi như hỏng.
 */
export function newDraftKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export type SectionsEditorProps = {
  sections: SectionDraft[];
  onChange: (next: SectionDraft[]) => void;
  /** Ngôn ngữ đang sửa. */
  locale: string;
  /** Ngôn ngữ site đang phục vụ — để ghi chú "Thiếu bản EN" cạnh từng dòng. */
  locales: readonly string[];
  /** Server action kết xuất markdown cho tab xem trước. */
  renderPreview?: (markdown: string) => Promise<string>;
  /** Server action liệt kê ảnh; vắng mặt thì ô soạn không có nút Ảnh. */
  listMedia?: () => Promise<MediaItem[]>;
};

export function SectionsEditor({
  sections,
  onChange,
  locale,
  locales,
  renderPreview,
  listMedia,
}: SectionsEditorProps) {
  const t = useTranslations();

  function patch(key: string, change: Partial<{ anchor: string; title: string; body: string }>) {
    onChange(
      sections.map((row) => {
        if (row.key !== key) return row;

        const text = row.text[locale] ?? { title: "", body: "" };
        return {
          ...row,
          anchor: change.anchor ?? row.anchor,
          text: {
            ...row.text,
            [locale]: {
              title: change.title ?? text.title,
              body: change.body ?? text.body,
            },
          },
        };
      }),
    );
  }

  /** Ngôn ngữ chưa có bản dịch của mục này, cho ghi chú bên phải mỗi dòng. */
  function missingLocalesOf(text: Record<string, { title: string }>): string[] {
    return locales.filter((code) => (text[code]?.title ?? "").trim() === "");
  }

  const items: SortableItem[] = sections.map((row) => {
    const text = row.text[locale] ?? { title: "", body: "" };
    const missing = missingLocalesOf(row.text);

    return {
      id: row.key,
      label: text.title.trim() || t("admin.editor.untitledSection"),
      meta: row.anchor ? `#${row.anchor}` : undefined,
      note: missing.length
        ? t("admin.editor.missingIn", {
            locales: missing.map((code) => code.toUpperCase()).join(", "),
          })
        : undefined,
      detail: (
        <SectionRow
          id={`section-${row.key}`}
          locale={locale}
          value={{ anchor: row.anchor, title: text.title, body: text.body }}
          onChange={(change) => patch(row.key, change)}
          renderPreview={renderPreview}
          listMedia={listMedia}
        />
      ),
    };
  });

  return (
    <AdminBlock
      heading={t("admin.editor.sectionsTitle")}
      scope={t("admin.editor.sectionsScope", { count: sections.length })}
      right={
        <button
          className={styles.add}
          type="button"
          onClick={() => onChange([...sections, { key: newDraftKey(), anchor: "", text: {} }])}
        >
          <span aria-hidden="true">＋</span> {t("admin.addSection")}
        </button>
      }
    >
      {sections.length === 0 ? (
        <p className={styles.empty}>{t("admin.editor.sectionsEmpty")}</p>
      ) : (
        <SortableList
          items={items}
          labels={{
            handle: t("admin.editor.handle"),
            handleHint: t("admin.editor.handleHint"),
            remove: t("admin.editor.remove"),
            expand: t("admin.editor.expand"),
            collapse: t("admin.editor.collapse"),
            order: {
              top: t("admin.editor.orderTop"),
              up: t("admin.editor.orderUp"),
              down: t("admin.editor.orderDown"),
              bottom: t("admin.editor.orderBottom"),
            },
          }}
          onReorder={(keys) => onChange(keys.flatMap((key) => sections.filter((r) => r.key === key)))}
          onRemove={(key) => onChange(sections.filter((row) => row.key !== key))}
        />
      )}
    </AdminBlock>
  );
}

/**
 * Danh sách gửi cho `saveSections`: cấu trúc đầy đủ, tiêu đề và thân bài của
 * đúng ngôn ngữ đang lưu.
 *
 * Mục chưa dịch ở ngôn ngữ đó vẫn **có** trong danh sách, với tiêu đề rỗng —
 * tầng ghi hiểu đó là "chưa có bản dịch" và giữ nguyên mục cùng bản dịch của các
 * ngôn ngữ khác. Bỏ mục ra khỏi danh sách mới là xoá nó.
 */
export function sectionsPayload(sections: SectionDraft[], locale: string) {
  return sections.map((row) => ({
    id: row.id,
    anchor: row.anchor.trim(),
    title: (row.text[locale]?.title ?? "").trim(),
    body: { type: "markdown" as const, content: row.text[locale]?.body ?? "" },
  }));
}

/** Mục có anchor không hợp lệ, kèm vị trí — anchor là cấu trúc nên nó luôn bắt buộc. */
export function invalidAnchorIndexes(sections: SectionDraft[]): number[] {
  return sections.flatMap((row, index) =>
    ANCHOR_PATTERN.test(row.anchor.trim()) ? [] : [index + 1],
  );
}
