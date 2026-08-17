"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  AdminBar,
  AdminBlock,
  AdminBody,
  AdminScope,
  AdminTitle,
} from "@/components/admin/AdminShell";
import { LocaleSwitch } from "@/components/admin/LocaleSwitch";
import type { MediaItem } from "@/components/admin/media";
import {
  ANCHOR_PATTERN,
  SectionsEditor,
  invalidAnchorIndexes,
  sectionsPayload,
  type SectionDraft,
} from "@/components/admin/SectionsEditor";
import { TranslationMeter } from "@/components/admin/TranslationMeter";
import { Badge, type StatusKind } from "@/components/ui/Badge";
import type { EditorDocPage, Status } from "@/server/content/queries";
import styles from "./DocPageEditor.module.css";

/**
 * Trang soạn một trang hướng dẫn.
 *
 * Dùng lại nguyên bố cục và bốn quyết định UX của mockup màn 04: một nút chuyển
 * ngôn ngữ trên đầu, `TranslationMeter` ngay cạnh, khối "Thông tin chung" tách
 * khỏi khối theo ngôn ngữ, và danh sách mục kéo thả được bằng cả chuột lẫn bàn phím.
 *
 * Khối "Mục nội dung" là `SectionsEditor` — đúng cùng một component với trang soạn
 * ứng dụng, gọi đúng `saveSections` với `owner: { docSlug }`. Đó là lý do khối ấy
 * được tách ra khỏi `AppEditor`: xem ghi chú đầu `SectionsEditor.tsx`.
 *
 * Component nằm cạnh route thay vì trong `src/components/admin/`: nó có đúng một
 * nơi dùng, và đặt cạnh route thì đọc thư mục là thấy ngay trang này gồm những gì.
 */

export type DocPageEditorProps = {
  locale: string;
  locales: readonly string[];
  defaultLocale: string;
  page: EditorDocPage;
  backHref: string;

  saveDocPage: (raw: unknown) => Promise<{ id: string; slug: string }>;
  saveSections: (raw: unknown) => Promise<void>;
  renderPreview: (raw: unknown) => Promise<string>;
  listMedia: () => Promise<MediaItem[]>;
};

/** Khối không theo ngôn ngữ. Số giữ dạng chuỗi vì ô nhập là chuỗi. */
type GeneralDraft = {
  slug: string;
  group: string;
  order: string;
  status: Status;
};

type ContentDraft = { title: string; description: string };

const EMPTY_CONTENT: ContentDraft = { title: "", description: "" };

const STATUS_KIND: Record<Status, StatusKind> = {
  DRAFT: "planned",
  PUBLISHED: "connected",
  ARCHIVED: "private",
};

const STATUS_LABEL_KEY: Record<Status, string> = {
  DRAFT: "admin.publishState.draft",
  PUBLISHED: "admin.publishState.published",
  ARCHIVED: "admin.publishState.archived",
};

function generalFrom(page: EditorDocPage): GeneralDraft {
  return {
    slug: page.slug,
    group: page.group ?? "",
    order: String(page.order),
    status: page.status,
  };
}

function sectionsFrom(page: EditorDocPage): SectionDraft[] {
  return page.sections.map((section) => ({
    key: section.id,
    id: section.id,
    anchor: section.anchor,
    text: { ...section.translations },
  }));
}

/** Chuỗi rỗng nghĩa là người dùng đã xoá trắng ô đó → gửi `undefined` để ghi `null`. */
function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DocPageEditor({
  locale,
  locales,
  defaultLocale,
  page,
  backHref,
  saveDocPage,
  saveSections,
  renderPreview,
  listMedia,
}: DocPageEditorProps) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editLocale, setEditLocale] = useState(
    locales.includes(locale) ? locale : defaultLocale,
  );

  const [general, setGeneral] = useState(() => generalFrom(page));
  const [content, setContent] = useState<Record<string, ContentDraft>>(() => ({
    ...page.translations,
  }));
  const [sections, setSections] = useState(() => sectionsFrom(page));
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Máy chủ là nguồn sự thật: dữ liệu mới (sau `router.refresh()`) ghi đè bản nháp.
  const [seenPage, setSeenPage] = useState(page);
  if (seenPage !== page) {
    setSeenPage(page);
    setGeneral(generalFrom(page));
    setContent({ ...page.translations });
    setSections(sectionsFrom(page));
  }

  const code = editLocale.toUpperCase();
  const current = content[editLocale] ?? EMPTY_CONTENT;
  const otherLocales = locales.filter((lc) => lc !== editLocale);

  function patchGeneral(patch: Partial<GeneralDraft>) {
    setGeneral((draft) => ({ ...draft, ...patch }));
  }

  function patchContent(patch: Partial<ContentDraft>) {
    setContent((draft) => ({
      ...draft,
      [editLocale]: { ...(draft[editLocale] ?? EMPTY_CONTENT), ...patch },
    }));
  }

  /**
   * `total = 1 + số mục`: tiêu đề trang tính là một mục, vì thiếu nó thì trang
   * không hiện được ở ngôn ngữ đó. Đếm từ state để con số đổi ngay khi gõ.
   */
  function progressOf(target: string): { done: number; total: number } {
    return {
      total: 1 + sections.length,
      done:
        ((content[target]?.title ?? "").trim() === "" ? 0 : 1) +
        sections.filter((row) => (row.text[target]?.title ?? "").trim() !== "").length,
    };
  }

  function save() {
    setNotice(null);

    const invalid: string[] = [];
    if (!ANCHOR_PATTERN.test(general.slug.trim())) invalid.push(t("admin.editor.errorSlug"));
    if (!/^-?\d+$/.test(general.order.trim())) invalid.push(t("admin.docs.errorOrder"));

    if (invalid.length > 0) {
      setNotice({
        tone: "error",
        text: t("admin.editor.notSaved", { problems: invalid.join(" · ") }),
      });
      return;
    }

    // Anchor là cấu trúc, không phải bản dịch: sai nó thì cả khối Mục nội dung
    // không gửi được, vì `saveSections` ghi cả danh sách trong một lần.
    const blockers = invalidAnchorIndexes(sections).map((index) =>
      t("admin.editor.blockAnchor", { index }),
    );

    startTransition(async () => {
      try {
        const saved = await saveDocPage({
          id: page.id,
          slug: general.slug.trim(),
          group: optional(general.group),
          order: Number(general.order.trim()),
          status: general.status,
          locale: editLocale,
          // Tiêu đề rỗng nghĩa là ngôn ngữ này chưa dịch; tầng ghi gỡ đúng bản
          // dịch đó và giữ nguyên các ngôn ngữ khác.
          title: current.title.trim(),
          description: optional(current.description),
        });

        if (blockers.length > 0) {
          // Khối Thông tin chung và bản dịch tiêu đề đã lưu xong; chỉ danh sách
          // mục là không gửi được. Nói đúng phần nào chưa lưu, và **không**
          // `router.refresh()` — làm mới lúc còn phần chưa lưu sẽ ghi đè đúng
          // phần người dùng vừa gõ.
          setNotice({
            tone: "error",
            text: t("admin.editor.savedExcept", { problems: blockers.join(" · ") }),
          });
          return;
        }

        await saveSections({
          owner: { docSlug: saved.slug },
          locale: editLocale,
          sections: sectionsPayload(sections, editLocale),
        });

        setNotice({ tone: "ok", text: t("admin.saved") });
        // Đọc lại từ DB: slug có thể vừa đổi, và mục vừa thêm giờ đã có `id`.
        router.refresh();
      } catch (error) {
        setNotice({
          tone: "error",
          text: t("admin.editor.saveFailed", { reason: reasonOf(error) }),
        });
      }
    });
  }

  return (
    <>
      <AdminBar
        actions={
          <>
            <div className={styles.trans}>
              <LocaleSwitch
                locales={locales}
                value={editLocale}
                defaultLocale={defaultLocale}
                onChange={setEditLocale}
              />
              {otherLocales.map((lc) => {
                const { done, total } = progressOf(lc);
                const upper = lc.toUpperCase();

                return (
                  <TranslationMeter
                    key={lc}
                    locale={lc}
                    done={done}
                    total={total}
                    label={t("admin.editor.meterMissing", { locale: upper, done, total })}
                    completeLabel={t("admin.editor.meterComplete", { locale: upper })}
                  />
                );
              })}
            </div>

            {/* Trang chủ chưa kết xuất bản ghi này (xem ghi chú dưới thanh), nên
                nó không có liên kết công khai. Một nút dẫn tới chỗ không hiện nội
                dung vừa soạn còn tệ hơn không có nút. */}
            {page.isLanding ? null : (
              <a
                className={styles.button}
                href={`/${locale}/docs/${page.slug}`}
                // Mở tab mới: bản nháp đang sửa nằm trong trang này, điều hướng đi
                // là mất phần chưa lưu.
                target="_blank"
                rel="noreferrer"
              >
                {t("admin.docs.openPublic")}
              </a>
            )}

            <button className={styles.primary} type="button" onClick={save} disabled={pending}>
              {pending ? t("admin.editor.saving") : t("admin.save")}
            </button>
          </>
        }
      >
        <a className={styles.back} href={backHref}>
          <span aria-hidden="true">←</span> {t("admin.nav.docs")}
        </a>
        <AdminTitle>{current.title.trim() || t("admin.docs.noTitle")}</AdminTitle>
        <AdminScope>{page.slug}</AdminScope>
        <Badge kind={STATUS_KIND[general.status]}>{t(STATUS_LABEL_KEY[general.status])}</Badge>
      </AdminBar>

      <AdminBody>
        {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
        <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
          {notice?.text ?? ""}
        </p>

        {page.isLanding ? (
          <p className={styles.landing}>{t("admin.docs.landingNote", { locale })}</p>
        ) : null}

        <AdminBlock
          heading={t("admin.editor.generalTitle")}
          scope={t("admin.editor.generalScope")}
        >
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-slug">
                {t("admin.editor.fieldSlug")}
              </label>
              <input
                className={`${styles.input} ${styles.mono}`}
                id="doc-slug"
                name="slug"
                type="text"
                value={general.slug}
                onChange={(event) => patchGeneral({ slug: event.target.value })}
                spellCheck={false}
                aria-describedby="doc-slug-hint"
              />
              <p className={styles.hint} id="doc-slug-hint">
                {t("admin.editor.fieldSlugHint")}
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-group">
                {t("admin.docs.fieldGroup")}
              </label>
              <input
                className={styles.input}
                id="doc-group"
                name="group"
                type="text"
                value={general.group}
                onChange={(event) => patchGeneral({ group: event.target.value })}
                aria-describedby="doc-group-hint"
              />
              <p className={styles.hint} id="doc-group-hint">
                {t("admin.docs.fieldGroupHint")}
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-order">
                {t("admin.docs.fieldOrder")}
              </label>
              <input
                className={`${styles.input} ${styles.mono}`}
                id="doc-order"
                name="order"
                type="number"
                value={general.order}
                onChange={(event) => patchGeneral({ order: event.target.value })}
                aria-describedby="doc-order-hint"
              />
              <p className={styles.hint} id="doc-order-hint">
                {t("admin.docs.fieldOrderHint")}
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-status">
                {t("admin.editor.fieldStatus")}
              </label>
              <select
                className={styles.input}
                id="doc-status"
                name="status"
                value={general.status}
                onChange={(event) => patchGeneral({ status: event.target.value as Status })}
              >
                {(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((status) => (
                  <option key={status} value={status}>
                    {t(STATUS_LABEL_KEY[status])}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </AdminBlock>

        <AdminBlock
          heading={t("admin.editor.contentTitle")}
          scope={t("admin.editor.contentScope", { locale: code })}
        >
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-title">
                {t("admin.editor.fieldTitle")} · {code}
              </label>
              <input
                className={styles.input}
                id="doc-title"
                name="title"
                type="text"
                value={current.title}
                onChange={(event) => patchContent({ title: event.target.value })}
              />
            </div>

            <div className={styles.wide}>
              <label className={styles.label} htmlFor="doc-description">
                {t("admin.editor.fieldDescription")} · {code}
              </label>
              <textarea
                className={styles.area}
                id="doc-description"
                name="description"
                value={current.description}
                onChange={(event) => patchContent({ description: event.target.value })}
                rows={3}
              />
            </div>
          </div>
        </AdminBlock>

        <SectionsEditor
          sections={sections}
          onChange={setSections}
          locale={editLocale}
          locales={locales}
          renderPreview={renderPreview}
          listMedia={listMedia}
        />
      </AdminBody>
    </>
  );
}
