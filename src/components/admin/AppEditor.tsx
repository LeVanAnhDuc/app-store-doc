"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge, type StatusKind } from "@/components/ui/Badge";
import type { AppKind, EditorApp, Status } from "@/server/content/queries";
import { AdminBar, AdminBlock, AdminBody, AdminScope, AdminTitle } from "./AdminShell";
import { FeatureRow } from "./FeatureRow";
import { LocaleSwitch } from "./LocaleSwitch";
import type { MediaItem } from "./media";
import { MediaPicker } from "./MediaPicker";
import {
  SectionsEditor,
  invalidAnchorIndexes,
  newDraftKey,
  sectionsPayload,
  type SectionDraft,
} from "./SectionsEditor";
import { SortableList, type SortableItem } from "./SortableList";
import { TranslationMeter } from "./TranslationMeter";
import styles from "./AppEditor.module.css";

/**
 * Trang soạn nội dung một ứng dụng — mockup màn 04.
 *
 * Bốn quyết định UX của spec §8.2 nằm trong bố cục, không phải trong tuỳ chọn:
 *
 * 1. **Một nút chuyển ngôn ngữ duy nhất**, trên thanh đầu trang (`LocaleSwitch`).
 * 2. **`TranslationMeter` ngay cạnh nó**, đếm theo từng tính năng và từng mục.
 * 3. **Khối "Thông tin chung" tách khỏi các khối theo ngôn ngữ.** Đổi ngôn ngữ
 *    thì khối đầu không nhúc nhích — đó là câu trả lời nhìn thấy được cho "sửa
 *    slug ở bản EN thì bản VI có đổi không".
 * 4. **Tính năng và mục nội dung sắp xếp được bằng chuột *và* bàn phím**
 *    (`SortableList`).
 *
 * Bản nháp nằm trong state của component, không trong URL: đổi ngôn ngữ hay mở
 * một mục không tải lại trang nên không mất phần đang gõ.
 */

export type AppEditorProps = {
  /** Ngôn ngữ của đường dẫn quản trị — cũng là ngôn ngữ mở sẵn để sửa. */
  locale: string;
  /** Ngôn ngữ site đang phục vụ. */
  locales: readonly string[];
  defaultLocale: string;
  app: EditorApp;
  /** Đường về bảng danh sách. */
  backHref: string;
  /** Đã kèm token; `null` khi chưa cấu hình `PREVIEW_SECRET`. */
  previewHref: string | null;

  saveApp: (raw: unknown) => Promise<{ id: string; slug: string }>;
  saveFeatures: (raw: unknown) => Promise<void>;
  saveSections: (raw: unknown) => Promise<void>;
  renderPreview: (raw: unknown) => Promise<string>;
  /** Server action liệt kê ảnh, cho nút Ảnh và ô chọn logo. */
  listMedia: () => Promise<MediaItem[]>;
};

// ---------------------------------------------------------------------------
// Bản nháp phía trình duyệt
// ---------------------------------------------------------------------------

/** Khối không theo ngôn ngữ. Số và mảng giữ dạng chuỗi vì ô nhập là chuỗi. */
type GeneralDraft = {
  slug: string;
  kind: AppKind;
  status: Status;
  logoUrl: string;
  repoUrl: string;
  apiRepoUrl: string;
  demoUrl: string;
  /** Cách nhau bằng dấu phẩy; tách lúc lưu. */
  techStack: string;
  isRepoPrivate: boolean;
  isStandalone: boolean;
};

type ContentDraft = { name: string; tagline: string; summary: string };

/**
 * `key` là định danh phía trình duyệt, luôn có; `id` là định danh trong DB, chỉ
 * mục đã lưu mới có. Kéo thả và xoá dùng `key` để mục vừa thêm cũng sắp xếp được
 * trước khi lưu lần đầu.
 */
type FeatureDraft = {
  key: string;
  id?: string;
  icon: string;
  text: Record<string, { title: string; description: string }>;
};

const EMPTY_CONTENT: ContentDraft = { name: "", tagline: "", summary: "" };

/** Anchor hợp lệ — cùng biểu thức với `slugSchema` trong `src/lib/schemas.ts`. */
const ANCHOR_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

const KIND_LABEL_KEY: Record<AppKind, string> = {
  CORE: "admin.kind.core",
  SATELLITE: "admin.kind.satellite",
};

function generalFrom(app: EditorApp): GeneralDraft {
  return {
    slug: app.slug,
    kind: app.kind,
    status: app.status,
    logoUrl: app.logoUrl ?? "",
    repoUrl: app.repoUrl ?? "",
    apiRepoUrl: app.apiRepoUrl ?? "",
    demoUrl: app.demoUrl ?? "",
    techStack: app.techStack.join(", "),
    isRepoPrivate: app.isRepoPrivate,
    isStandalone: app.isStandalone,
  };
}

function featuresFrom(app: EditorApp): FeatureDraft[] {
  return app.features.map((feature) => ({
    key: feature.id,
    id: feature.id,
    icon: feature.icon ?? "",
    text: { ...feature.translations },
  }));
}

function sectionsFrom(app: EditorApp): SectionDraft[] {
  return app.sections.map((section) => ({
    key: section.id,
    id: section.id,
    anchor: section.anchor,
    text: { ...section.translations },
  }));
}

/**
 * Ô địa chỉ chỉ nhận `http`/`https`.
 *
 * Kiểm ở đây chứ không chỉ ở Zod: `ZodError.message` là một khối JSON, và dán
 * khối đó vào ô thông báo thì người soạn đọc được "invalid_format" chứ không đọc
 * được mình phải sửa gì.
 */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Chuỗi rỗng nghĩa là người dùng đã xoá trắng ô đó → gửi `undefined` để ghi `null`. */
function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------

export function AppEditor({
  locale,
  locales,
  defaultLocale,
  app,
  backHref,
  previewHref,
  saveApp,
  saveFeatures,
  saveSections,
  renderPreview,
  listMedia,
}: AppEditorProps) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /** Ngôn ngữ đang sửa. Mở sẵn ngôn ngữ của đường dẫn nếu site có phục vụ nó. */
  const [editLocale, setEditLocale] = useState(
    locales.includes(locale) ? locale : defaultLocale,
  );

  const [general, setGeneral] = useState(() => generalFrom(app));
  const [content, setContent] = useState<Record<string, ContentDraft>>(() => ({
    ...app.translations,
  }));
  const [features, setFeatures] = useState(() => featuresFrom(app));
  const [sections, setSections] = useState(() => sectionsFrom(app));
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Máy chủ là nguồn sự thật: dữ liệu mới (sau `router.refresh()`) ghi đè bản
  // nháp. Chỉ chạy khi `app` thật sự là đối tượng khác, nên phần đang gõ không
  // bị xoá giữa hai lần render thường.
  const [seenApp, setSeenApp] = useState(app);
  if (seenApp !== app) {
    setSeenApp(app);
    setGeneral(generalFrom(app));
    setContent({ ...app.translations });
    setFeatures(featuresFrom(app));
    setSections(sectionsFrom(app));
  }

  const code = editLocale.toUpperCase();
  const current = content[editLocale] ?? EMPTY_CONTENT;

  function patchGeneral(patch: Partial<GeneralDraft>) {
    setGeneral((draft) => ({ ...draft, ...patch }));
  }

  function patchContent(patch: Partial<ContentDraft>) {
    setContent((draft) => ({
      ...draft,
      [editLocale]: { ...(draft[editLocale] ?? EMPTY_CONTENT), ...patch },
    }));
  }

  // -------------------------------------------------------------------------
  // Đếm độ hoàn thiện bản dịch
  // -------------------------------------------------------------------------

  /**
   * `total = 1 + số tính năng + số mục`: khối metadata của app tính là một mục,
   * vì thiếu nó thì trang công khai của ngôn ngữ đó không hiện được gì cả.
   *
   * Đếm từ state chứ không từ dữ liệu máy chủ, để con số đổi ngay khi người soạn
   * gõ xong một tiêu đề — chỉ báo đứng yên cho tới lần lưu tiếp theo thì nó nói
   * về quá khứ, mà chỗ này tồn tại để trả lời "còn thiếu gì" ngay lúc này.
   */
  function progressOf(target: string): { done: number; total: number } {
    const total = 1 + features.length + sections.length;
    const done =
      ((content[target]?.name ?? "").trim() === "" ? 0 : 1) +
      features.filter((row) => (row.text[target]?.title ?? "").trim() !== "").length +
      sections.filter((row) => (row.text[target]?.title ?? "").trim() !== "").length;

    return { done, total };
  }

  /** Ngôn ngữ thiếu bản dịch của một mục, dùng cho ghi chú bên phải mỗi dòng. */
  function missingLocalesOf(text: Record<string, { title: string }>): string[] {
    return locales.filter((lc) => (text[lc]?.title ?? "").trim() === "");
  }

  // -------------------------------------------------------------------------
  // Tính năng và mục nội dung
  // -------------------------------------------------------------------------

  function patchFeature(key: string, patch: Partial<{ icon: string; title: string; description: string }>) {
    setFeatures((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;

        const text = row.text[editLocale] ?? { title: "", description: "" };
        return {
          ...row,
          icon: patch.icon ?? row.icon,
          text: {
            ...row.text,
            [editLocale]: {
              title: patch.title ?? text.title,
              description: patch.description ?? text.description,
            },
          },
        };
      }),
    );
  }

  /** Sắp lại theo danh sách khoá mà `SortableList` gửi về. */
  function reorderBy<T extends { key: string }>(rows: T[], keys: string[]): T[] {
    return keys.flatMap((key) => rows.filter((row) => row.key === key));
  }

  const featureItems: SortableItem[] = features.map((row) => {
    const text = row.text[editLocale] ?? { title: "", description: "" };
    const missing = missingLocalesOf(row.text);

    return {
      id: row.key,
      label: text.title.trim() || t("admin.editor.untitledFeature"),
      note: missing.length
        ? t("admin.editor.missingIn", {
            locales: missing.map((lc) => lc.toUpperCase()).join(", "),
          })
        : undefined,
      detail: (
        <FeatureRow
          id={`feature-${row.key}`}
          locale={editLocale}
          value={{ icon: row.icon, title: text.title, description: text.description }}
          onChange={(patch) => patchFeature(row.key, patch)}
        />
      ),
    };
  });

  const listLabels = {
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
  };

  // -------------------------------------------------------------------------
  // Lưu
  // -------------------------------------------------------------------------

  /**
   * Ba lời gọi ghi, ba phạm vi khác nhau:
   *
   * - `saveApp` luôn chạy (khối không theo ngôn ngữ). Kèm `translation` **chỉ khi**
   *   ngôn ngữ đang sửa đã có tên hiển thị — `name` là trường bắt buộc của một
   *   `AppTranslation`, và một app không có tên ở ngôn ngữ nào thì trang công khai
   *   của ngôn ngữ đó trống trơn.
   * - `saveFeatures` **luôn chạy**, gửi cả danh sách kể cả những mục chưa dịch
   *   sang ngôn ngữ đang sửa. Tầng ghi hiểu tiêu đề rỗng là "chưa có bản dịch cho
   *   ngôn ngữ này" và giữ nguyên mục cùng bản dịch của các ngôn ngữ khác.
   * - `saveSections` cũng vậy, chỉ dừng khi có **anchor sai** — anchor không theo
   *   ngôn ngữ, nó là địa chỉ `#` công khai của mục, nên sai nó là lỗi cấu trúc.
   *
   * Bản trước chặn cả hai danh sách khi còn mục chưa dịch, vì tầng ghi lúc đó coi
   * tiêu đề rỗng là lệnh xoá. Cả hai chỗ đã sửa: xem `planContentSave` trong
   * `src/server/content/resolve.ts`.
   */
  function save() {
    setNotice(null);

    // Sai định dạng ở khối không theo ngôn ngữ thì **không gửi gì cả**: `saveApp`
    // là lời gọi đầu tiên và nó đổ thì hai lời gọi sau cũng không chạy, nên báo
    // trước bằng câu người đọc hiểu được vẫn tốt hơn để Zod đổ ra JSON.
    const invalid: string[] = [];
    if (!ANCHOR_PATTERN.test(general.slug.trim())) invalid.push(t("admin.editor.errorSlug"));

    const urlFields: [string, string][] = [
      [t("admin.editor.fieldRepo"), general.repoUrl],
      [t("admin.editor.fieldApiRepo"), general.apiRepoUrl],
      [t("admin.editor.fieldDemo"), general.demoUrl],
    ];
    for (const [field, value] of urlFields) {
      if (value.trim() !== "" && !isHttpUrl(value)) {
        invalid.push(t("admin.editor.errorUrl", { field }));
      }
    }

    if (invalid.length > 0) {
      setNotice({
        tone: "error",
        text: t("admin.editor.notSaved", { problems: invalid.join(" · ") }),
      });
      return;
    }

    const nameMissing = current.name.trim() === "";

    // Anchor là cấu trúc, không phải bản dịch: mục nào anchor sai thì cả khối Mục
    // nội dung không gửi được, vì `saveSections` ghi cả danh sách trong một lần.
    const badAnchors = invalidAnchorIndexes(sections);
    const blockers = badAnchors.map((index) => t("admin.editor.blockAnchor", { index }));

    startTransition(async () => {
      try {
        const saved = await saveApp({
          id: app.id,
          slug: general.slug.trim(),
          kind: general.kind,
          status: general.status,
          order: app.order,
          logoUrl: optional(general.logoUrl),
          repoUrl: optional(general.repoUrl),
          apiRepoUrl: optional(general.apiRepoUrl),
          demoUrl: optional(general.demoUrl),
          isRepoPrivate: general.isRepoPrivate,
          isStandalone: general.isStandalone,
          techStack: general.techStack
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== ""),
          translation: nameMissing
            ? undefined
            : {
                locale: editLocale,
                name: current.name.trim(),
                tagline: optional(current.tagline),
                summary: optional(current.summary),
              },
        });

        // Danh sách đầy đủ, kể cả mục chưa dịch sang `editLocale`: tiêu đề rỗng
        // nghĩa là "chưa có bản dịch", không phải "xoá mục này".
        await saveFeatures({
          appSlug: saved.slug,
          locale: editLocale,
          features: features.map((row) => ({
            id: row.id,
            icon: optional(row.icon),
            title: (row.text[editLocale]?.title ?? "").trim(),
            description: optional(row.text[editLocale]?.description ?? ""),
          })),
        });

        if (blockers.length === 0) {
          await saveSections({
            owner: { appSlug: saved.slug },
            locale: editLocale,
            sections: sectionsPayload(sections, editLocale),
          });
        }

        const skipped = [
          ...(nameMissing ? [t("admin.editor.blockName", { locale: code })] : []),
          ...blockers,
        ];

        if (skipped.length === 0) {
          setNotice({ tone: "ok", text: t("admin.saved") });
          // Đọc lại từ DB: slug có thể vừa đổi, và mục vừa thêm giờ đã có `id`.
          // Chỉ làm mới khi đã lưu trọn vẹn — làm mới lúc còn phần chưa lưu sẽ
          // ghi đè đúng phần người dùng vừa gõ.
          router.refresh();
        } else {
          setNotice({
            tone: "error",
            text: t("admin.editor.savedExcept", { problems: skipped.join(" · ") }),
          });
        }
      } catch (error) {
        setNotice({ tone: "error", text: t("admin.editor.saveFailed", { reason: reasonOf(error) }) });
      }
    });
  }

  // -------------------------------------------------------------------------

  const otherLocales = locales.filter((lc) => lc !== editLocale);

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

            {previewHref ? (
              <a
                className={styles.button}
                href={previewHref}
                // Mở tab mới: bản nháp đang sửa nằm trong trang này, điều hướng
                // đi là mất phần chưa lưu.
                target="_blank"
                rel="noreferrer"
              >
                {t("admin.editor.preview")}
              </a>
            ) : (
              <span className={styles.disabledNote}>{t("admin.editor.previewUnavailable")}</span>
            )}

            <button className={styles.primary} type="button" onClick={save} disabled={pending}>
              {pending ? t("admin.editor.saving") : t("admin.save")}
            </button>
          </>
        }
      >
        <a className={styles.back} href={backHref}>
          <span aria-hidden="true">←</span> {t("admin.editor.back")}
        </a>
        <AdminTitle>{current.name.trim() || t("admin.apps.noName")}</AdminTitle>
        <AdminScope>{app.slug}</AdminScope>
        <Badge kind={STATUS_KIND[general.status]}>{t(STATUS_LABEL_KEY[general.status])}</Badge>
      </AdminBar>

      <AdminBody>
        {/* `aria-live` để người dùng bàn phím biết kết quả mà không phải đi tìm. */}
        <p className={styles.notice} data-tone={notice?.tone} role="status" aria-live="polite">
          {notice?.text ?? ""}
        </p>

        <AdminBlock
          heading={t("admin.editor.generalTitle")}
          scope={t("admin.editor.generalScope")}
        >
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-slug">
                {t("admin.editor.fieldSlug")}
              </label>
              <input
                className={`${styles.input} ${styles.mono}`}
                id="app-slug"
                name="slug"
                type="text"
                value={general.slug}
                onChange={(event) => patchGeneral({ slug: event.target.value })}
                spellCheck={false}
                aria-describedby="app-slug-hint"
              />
              <p className={styles.hint} id="app-slug-hint">
                {t("admin.editor.fieldSlugHint")}
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-kind">
                {t("admin.editor.fieldKind")}
              </label>
              <select
                className={styles.input}
                id="app-kind"
                name="kind"
                value={general.kind}
                onChange={(event) => patchGeneral({ kind: event.target.value as AppKind })}
              >
                {(["CORE", "SATELLITE"] as const).map((kind) => (
                  <option key={kind} value={kind}>
                    {t(KIND_LABEL_KEY[kind])}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-status">
                {t("admin.editor.fieldStatus")}
              </label>
              <select
                className={styles.input}
                id="app-status"
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

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-repo">
                {t("admin.editor.fieldRepo")}
              </label>
              <input
                className={`${styles.input} ${styles.mono}`}
                id="app-repo"
                name="repoUrl"
                type="url"
                value={general.repoUrl}
                onChange={(event) => patchGeneral({ repoUrl: event.target.value })}
                spellCheck={false}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-api-repo">
                {t("admin.editor.fieldApiRepo")}
              </label>
              <input
                className={`${styles.input} ${styles.mono}`}
                id="app-api-repo"
                name="apiRepoUrl"
                type="url"
                value={general.apiRepoUrl}
                onChange={(event) => patchGeneral({ apiRepoUrl: event.target.value })}
                spellCheck={false}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-demo">
                {t("admin.editor.fieldDemo")}
              </label>
              <input
                className={`${styles.input} ${styles.mono}`}
                id="app-demo"
                name="demoUrl"
                type="url"
                value={general.demoUrl}
                onChange={(event) => patchGeneral({ demoUrl: event.target.value })}
                spellCheck={false}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-logo">
                {t("admin.editor.fieldLogo")}
              </label>
              <div className={styles.inline}>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  id="app-logo"
                  name="logoUrl"
                  type="text"
                  value={general.logoUrl}
                  onChange={(event) => patchGeneral({ logoUrl: event.target.value })}
                  spellCheck={false}
                />
                {/* Ô nhập vẫn là ô nhập: logo có thể là đường dẫn tĩnh trong repo,
                    không nhất thiết là ảnh trong thư viện. Bộ chọn chỉ điền hộ. */}
                <MediaPicker
                  listMedia={listMedia}
                  onPick={(item) => patchGeneral({ logoUrl: item.url })}
                />
              </div>
            </div>

            <div className={styles.wide}>
              <label className={styles.label} htmlFor="app-tech">
                {t("admin.editor.fieldTech")}
              </label>
              <input
                className={styles.input}
                id="app-tech"
                name="techStack"
                type="text"
                value={general.techStack}
                onChange={(event) => patchGeneral({ techStack: event.target.value })}
                aria-describedby="app-tech-hint"
              />
              <p className={styles.hint} id="app-tech-hint">
                {t("admin.editor.fieldTechHint")}
              </p>
            </div>

            <div className={styles.wide}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={general.isRepoPrivate}
                  onChange={(event) => patchGeneral({ isRepoPrivate: event.target.checked })}
                />
                {t("admin.editor.fieldRepoPrivate")}
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={general.isStandalone}
                  onChange={(event) => patchGeneral({ isStandalone: event.target.checked })}
                />
                {t("admin.editor.fieldStandalone")}
              </label>
            </div>
          </div>
        </AdminBlock>

        <AdminBlock
          heading={t("admin.editor.contentTitle")}
          scope={t("admin.editor.contentScope", { locale: code })}
        >
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-name">
                {t("admin.editor.fieldName")} · {code}
              </label>
              <input
                className={styles.input}
                id="app-name"
                name="name"
                type="text"
                value={current.name}
                onChange={(event) => patchContent({ name: event.target.value })}
                aria-describedby="app-name-hint"
              />
              <p className={styles.hint} id="app-name-hint">
                {t("admin.editor.fieldNameHint")}
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="app-tagline">
                {t("admin.editor.fieldTagline")} · {code}
              </label>
              <input
                className={styles.input}
                id="app-tagline"
                name="tagline"
                type="text"
                value={current.tagline}
                onChange={(event) => patchContent({ tagline: event.target.value })}
              />
            </div>

            <div className={styles.wide}>
              <label className={styles.label} htmlFor="app-summary">
                {t("admin.editor.fieldSummary")} · {code}
              </label>
              <textarea
                className={styles.area}
                id="app-summary"
                name="summary"
                value={current.summary}
                onChange={(event) => patchContent({ summary: event.target.value })}
                rows={4}
              />
            </div>
          </div>
        </AdminBlock>

        <AdminBlock
          heading={t("admin.editor.featuresTitle")}
          scope={t("admin.editor.featuresScope", { count: features.length })}
          right={
            <button
              className={styles.add}
              type="button"
              onClick={() =>
                setFeatures((rows) => [...rows, { key: newDraftKey(), icon: "", text: {} }])
              }
            >
              <span aria-hidden="true">＋</span> {t("admin.addFeature")}
            </button>
          }
        >
          {features.length === 0 ? (
            <p className={styles.empty}>{t("admin.editor.featuresEmpty")}</p>
          ) : (
            <SortableList
              items={featureItems}
              labels={listLabels}
              onReorder={(keys) => setFeatures((rows) => reorderBy(rows, keys))}
              onRemove={(key) => setFeatures((rows) => rows.filter((row) => row.key !== key))}
            />
          )}
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
