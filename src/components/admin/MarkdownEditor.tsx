"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { mediaLabel, type MediaItem } from "./media";
import { MediaPicker } from "./MediaPicker";
import styles from "./MarkdownEditor.module.css";

export type MarkdownEditorProps = {
  /** Dùng cho `htmlFor` của nhãn; phải là duy nhất trong trang. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Server action kết xuất markdown thành HTML **đã sanitize**. Vắng mặt thì
   * không có tab xem trước — thà không có tab còn hơn có một tab không chạy.
   */
  renderPreview?: (markdown: string) => Promise<string>;
  /**
   * Server action liệt kê ảnh trong thư viện. Vắng mặt thì **không có** nút Ảnh:
   * một nút mở ra bảng trống là nói dối về hiện trạng (design-rules §7).
   */
  listMedia?: () => Promise<MediaItem[]>;
};

/** Một đoạn chèn nhanh: mã markdown và cách đặt lại con trỏ sau khi chèn. */
type Snippet = { before: string; after: string; placeholder: string };

/**
 * Ô soạn markdown với tab **Soạn / Xem trước** và vài nút chèn nhanh —
 * `.m-md` / `.m-mdbar` của mockup màn 04.
 *
 * Kết xuất chạy ở **máy chủ**, qua đúng `renderMarkdown` mà trang công khai
 * dùng. Viết một bộ kết xuất riêng cho trình duyệt sẽ nhẹ hơn nhưng xem trước
 * lúc đó không còn là xem trước: nó cho thấy một thứ khác với trang thật, và
 * chênh lệch đó chỉ lộ ra sau khi đã publish.
 *
 * Nút **Ảnh** của mockup mở `MediaPicker` và chèn `![alt](url)` tại con trỏ. Nó
 * chỉ hiện khi có `listMedia`: trước Task 16 chưa có thư viện ảnh nên nút cũng
 * không tồn tại, vì nút mở ra bảng trống là nói dối về hiện trạng (design-rules §7).
 */
export function MarkdownEditor({
  id,
  label,
  value,
  onChange,
  renderPreview,
  listMedia,
}: MarkdownEditorProps) {
  const t = useTranslations();
  const area = useRef<HTMLTextAreaElement | null>(null);

  const [tab, setTab] = useState<"write" | "preview">("write");
  const [html, setHtml] = useState<string | null>(null);
  /** Markdown ứng với `html` đang giữ; lệch thì phải kết xuất lại. */
  const [renderedFrom, setRenderedFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const panelId = `${id}-panel`;

  function insert({ before, after, placeholder }: Snippet) {
    const node = area.current;
    if (!node) return;

    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;

    onChange(next);

    // Trả con trỏ về phần chữ vừa chèn, nếu không thì mỗi lần chèn người dùng
    // phải tự tìm lại chỗ đang viết.
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  /**
   * Chèn một đoạn hoàn chỉnh tại con trỏ, thay cho phần đang chọn nếu có.
   *
   * Khác `insert`: chỗ này không bọc quanh phần đang chọn mà thay hẳn nó, vì
   * `![alt](url)` không có "phần giữa" để người dùng gõ tiếp.
   */
  function insertBlock(text: string) {
    const node = area.current;
    const start = node ? node.selectionStart : value.length;
    const end = node ? node.selectionEnd : value.length;

    onChange(`${value.slice(0, start)}${text}${value.slice(end)}`);

    requestAnimationFrame(() => {
      if (!node) return;
      node.focus();
      node.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function showPreview() {
    setTab("preview");
    if (!renderPreview) return;
    if (renderedFrom === value) return;

    setError(null);
    startTransition(async () => {
      try {
        const rendered = await renderPreview(value);
        setHtml(rendered);
        setRenderedFrom(value);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <button
          className={styles.tab}
          type="button"
          onClick={() => setTab("write")}
          aria-pressed={tab === "write"}
          aria-controls={panelId}
        >
          {t("admin.editor.write")}
        </button>

        {renderPreview ? (
          <button
            className={styles.tab}
            type="button"
            onClick={showPreview}
            aria-pressed={tab === "preview"}
            aria-controls={panelId}
          >
            {t("admin.editor.previewTab")}
          </button>
        ) : null}

        <span className={styles.spacer} />

        <button
          className={styles.tool}
          type="button"
          onClick={() => insert({ before: "## ", after: "", placeholder: t("admin.editor.insertHeadingText") })}
        >
          {t("admin.editor.insertHeading")}
        </button>
        <button
          className={styles.tool}
          type="button"
          onClick={() => insert({ before: "```bash\n", after: "\n```", placeholder: "npm install" })}
        >
          {t("admin.editor.insertCode")}
        </button>
        <button
          className={styles.tool}
          type="button"
          onClick={() =>
            insert({ before: "[", after: "](https://)", placeholder: t("admin.editor.insertLinkText") })
          }
        >
          {t("admin.editor.insertLink")}
        </button>

        {listMedia ? (
          <MediaPicker
            listMedia={listMedia}
            label={t("admin.editor.insertImage")}
            onPick={(item) => {
              // `alt` là chữ thay ảnh, nên nó phải nói ảnh vẽ gì. Thư viện đặt
              // sẵn tên tệp làm `alt`; người soạn sửa lại ngay trong bài.
              insertBlock(`![${mediaLabel(item)}](${item.url})`);
            }}
          />
        ) : null}
      </div>

      <div className={styles.panel} id={panelId}>
        {/* Ô nhập vẫn nằm trong cây khi xem trước: gỡ nó ra là mất cả vị trí con
            trỏ lẫn lịch sử hoàn tác của trình duyệt. */}
        <div hidden={tab !== "write"}>
          <label className={styles.label} htmlFor={id}>
            {label}
          </label>
          <textarea
            className={styles.area}
            id={id}
            ref={area}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            rows={10}
          />
        </div>

        {tab === "preview" ? (
          <div className={styles.preview}>
            {error ? (
              <p className={styles.error}>{t("admin.editor.previewFailed", { reason: error })}</p>
            ) : pending ? (
              <p className={styles.hint}>{t("admin.editor.previewLoading")}</p>
            ) : value.trim() === "" ? (
              <p className={styles.hint}>{t("admin.editor.previewEmpty")}</p>
            ) : (
              // HTML đã đi qua `rehype-sanitize` ở máy chủ — cùng đường ống với
              // trang công khai.
              <div
                className={styles.rendered}
                dangerouslySetInnerHTML={{ __html: html ?? "" }}
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
