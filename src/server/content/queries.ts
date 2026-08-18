import { unstable_cache } from "next/cache";

import { defaultLocale as fallbackLocaleOfLastResort, locales } from "@/i18n/locales.generated";
import { appKindValues, sectionBodySchema, statusValues, type SectionBody } from "@/lib/schemas";
import { buildSearchIndex, type SearchDoc, type SearchIndexInput } from "@/lib/search-index";
import { hasDatabase, prisma } from "@/server/db";
import { buildNavTree, type NavKind, type NavRow, type NavTreeNode } from "./nav";
import { assertSingleDefaultLocale, buildToc, resolveTranslation } from "./resolve";
import { tags } from "./tags";

/**
 * Đọc nội dung đã publish. Đây là một trong hai file duy nhất chạm Prisma
 * (file kia là `mutations.ts`); component gọi vào đây chứ không gọi Prisma.
 *
 * Ba quy ước xuyên suốt:
 *
 * 1. **Mọi hàm đọc bọc `unstable_cache`** với tag lấy từ `tags.ts`. Không gõ tay
 *    tên tag: lệch một ký tự thì sửa nội dung trong CMS xong trang công khai
 *    không đổi, mà chẳng có gì báo lỗi.
 * 2. **Thiếu `DATABASE_URL` thì trả rỗng, không ném lỗi.** Kế hoạch này được
 *    thực thi khi chưa có DB; `next build` phải chạy được. Trang rỗng thì thấy
 *    ngay, còn build đổ vỡ thì chặn mọi việc khác.
 * 3. **Không bao giờ bịa nhãn từ slug.** Thiếu cả bản dịch mặc định thì bỏ qua
 *    bản ghi (danh sách) hoặc trả `null` (trang chi tiết) để trang gọi
 *    `notFound()`. "web-store-apps" hiện ra chỗ đáng lẽ là "Web Store Apps"
 *    trông như dữ liệu thật nên sẽ lọt qua mọi vòng kiểm tra.
 */

/**
 * Slug dành riêng cho nội dung trang chủ.
 *
 * `/[locale]/docs/home` **không** tồn tại: `docs/[slug]/page.tsx` gọi `notFound()`
 * cho slug này, và `getNavTree`/`getStaticSlugs` loại nó khỏi sidebar. Trang chủ
 * `/[locale]` hiện dựng từ chuỗi giao diện cộng danh sách ứng dụng (mockup màn 01),
 * nên bản ghi `DocPage(slug="home")` là chỗ chờ sẵn cho nội dung trang chủ chứ
 * chưa được trang nào kết xuất — vì vậy seed để nó ở `DRAFT`: publish nó sẽ đưa
 * `/…/docs/home` vào chỉ mục tìm kiếm trong khi route đó cố tình 404.
 */
export const LANDING_DOC_SLUG = "home";

export type Status = (typeof statusValues)[number];
export type AppKind = (typeof appKindValues)[number];

/**
 * Trạng thái tích hợp với IDMS, dùng chung cho `Badge` và `WireDiagram`.
 * Trùng với `StatusKind` của `src/components/ui/Badge.tsx` — khai lại ở đây để
 * tầng dữ liệu không phải import ngược lên tầng giao diện.
 */
export type Integration = "core" | "connected" | "planned" | "standalone" | "private";

export type AppCard = {
  slug: string;
  name: string;
  tagline: string | null;
  kind: AppKind;
  status: Status;
  isRepoPrivate: boolean;
  techStack: string[];
  integration: Integration;
};

/** Một tính năng đã chọn xong ngôn ngữ. */
export type ResolvedFeature = {
  id: string;
  order: number;
  icon: string | null;
  title: string;
  description: string | null;
  /** Ngôn ngữ thực của nội dung bên trên. */
  locale: string;
  /** `true` khi phải lùi về locale mặc định — trang hiện badge "Chưa có bản …". */
  isFallback: boolean;
};

/** Một mục nội dung đã chọn xong ngôn ngữ. */
export type ResolvedSection = {
  id: string;
  order: number;
  anchor: string;
  title: string;
  body: SectionBody;
  locale: string;
  isFallback: boolean;
};

export type TocItem = { anchor: string; title: string };

export type AppDetail = {
  // Không theo ngôn ngữ.
  id: string;
  slug: string;
  kind: AppKind;
  status: Status;
  order: number;
  logoUrl: string | null;
  repoUrl: string | null;
  apiRepoUrl: string | null;
  demoUrl: string | null;
  isRepoPrivate: boolean;
  isStandalone: boolean;
  techStack: string[];
  integration: Integration;

  // Theo ngôn ngữ. `locale`/`isFallback` mô tả riêng khối metadata này; mỗi
  // feature và mỗi section mang cờ fallback của chính nó vì bản dịch có thể
  // hoàn thiện không đều.
  name: string;
  tagline: string | null;
  summary: string | null;
  locale: string;
  isFallback: boolean;

  features: ResolvedFeature[];
  sections: ResolvedSection[];
  /** Mục lục dựng từ `sections`, đã kiểm anchor không trùng. */
  toc: TocItem[];
};

export type DocPageDetail = {
  id: string;
  slug: string;
  order: number;
  status: Status;

  title: string;
  description: string | null;
  locale: string;
  isFallback: boolean;

  sections: ResolvedSection[];
  toc: TocItem[];
};

export type ReadOptions = {
  /**
   * Cho phép đọc cả `DRAFT`/`ARCHIVED`, dùng cho chế độ xem thử (spec §8.4).
   * Bật cờ này thì **bỏ qua cache** — xem thử mà thấy bản đã cache thì vô nghĩa.
   */
  includeDrafts?: boolean;
};

/**
 * Suy ra trạng thái tích hợp từ dữ liệu người viết kiểm soát.
 *
 * Thứ tự ưu tiên: lõi → repo riêng tư → chạy độc lập → còn lại là dự kiến nối.
 *
 * Tính tới 2026-08-17 **chưa app vệ tinh nào thực sự nối IDMS** (spec §2.2), nên
 * hàm này không bao giờ trả `"connected"`. Giá trị đó vẫn nằm trong union vì
 * huy hiệu và chú giải sơ đồ đã có sẵn; ngày app đầu tiên nối xong thì thêm một
 * cờ nữa ở đây, chứ không suy diễn từ việc có `apiRepoUrl` hay không.
 */
export function deriveIntegration(app: {
  kind: AppKind;
  isRepoPrivate: boolean;
  isStandalone: boolean;
}): Integration {
  if (app.kind === "CORE") return "core";
  if (app.isRepoPrivate) return "private";
  if (app.isStandalone) return "standalone";
  return "planned";
}

/** Trạng thái được coi là công khai. */
const PUBLISHED = "PUBLISHED" as const;

/** Điều kiện lọc theo trạng thái; `includeDrafts` thì không lọc gì cả. */
function statusFilter(includeDrafts: boolean): { status?: Status } {
  return includeDrafts ? {} : { status: PUBLISHED };
}

/**
 * Đọc `SectionTranslation.body` (kiểu `Json`) về dạng đã biết.
 *
 * Trả `null` khi không nhận dạng được, để nơi gọi tự quyết: trang chi tiết ném
 * lỗi (thà lộ ra còn hơn render mục trống), chỉ mục tìm kiếm thì bỏ qua.
 */
function readSectionBody(value: unknown): SectionBody | null {
  const parsed = sectionBodySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Locale mặc định lấy từ bảng `Locale` — nguồn sự thật của cơ chế fallback.
 *
 * DB chưa seed thì lùi về `locales.generated.ts` thay vì ném lỗi: lúc đó chưa có
 * nội dung nào để dịch nên bất biến "đúng một mặc định" chưa có gì để bảo vệ.
 *
 * Nhận `client` để `mutations.ts` gọi được **bên trong** transaction của nó:
 * bất biến I5 cần biết locale mặc định, và đọc nó ngoài transaction thì có thể
 * thấy một giá trị khác giá trị sắp được cam kết.
 */
export async function loadDefaultLocale(
  client: Pick<typeof prisma, "locale"> = prisma,
): Promise<string> {
  const rows = await client.locale.findMany({
    select: { code: true, isDefault: true, enabled: true },
  });
  if (rows.length === 0) return fallbackLocaleOfLastResort;

  assertSingleDefaultLocale(rows);
  return rows.find((row) => row.isDefault)!.code;
}

/** Chuyển một mảng `Feature` kèm bản dịch thành danh sách đã chọn xong ngôn ngữ. */
function resolveFeatures(
  features: {
    id: string;
    order: number;
    icon: string | null;
    translations: { locale: string; title: string; description: string | null }[];
  }[],
  locale: string,
  fallback: string,
): ResolvedFeature[] {
  return features.flatMap((feature) => {
    const translated = resolveTranslation(feature.translations, locale, fallback);
    // Không có bản dịch nào: bỏ hẳn. Hiện ô trống trong lưới tính năng chỉ làm
    // người đọc tưởng giao diện hỏng.
    if (!translated) return [];

    return [
      {
        id: feature.id,
        order: feature.order,
        icon: feature.icon,
        title: translated.value.title,
        description: translated.value.description,
        locale: translated.locale,
        isFallback: translated.isFallback,
      },
    ];
  });
}

/** Như trên, cho `Section`. `ownerLabel` chỉ dùng để thông báo lỗi cho dễ lần. */
function resolveSections(
  sections: {
    id: string;
    order: number;
    anchor: string;
    translations: { locale: string; title: string; body: unknown }[];
  }[],
  locale: string,
  fallback: string,
  ownerLabel: string,
): ResolvedSection[] {
  return sections.flatMap((section) => {
    const translated = resolveTranslation(section.translations, locale, fallback);
    if (!translated) return [];

    const body = readSectionBody(translated.value.body);
    if (!body) {
      throw new Error(
        `Mục "${section.anchor}" của ${ownerLabel} có thân bài không đúng định dạng. ` +
          'Thân bài phải là JSON dạng { "type": "markdown", "content": "…" }.',
      );
    }

    return [
      {
        id: section.id,
        order: section.order,
        anchor: section.anchor,
        title: translated.value.title,
        body,
        locale: translated.locale,
        isFallback: translated.isFallback,
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Danh sách ứng dụng
// ---------------------------------------------------------------------------

/** Select đủ để dựng một `AppCard`; dùng chung với `getUnlinkedContent`. */
const appCardSelect = {
  slug: true,
  kind: true,
  status: true,
  isRepoPrivate: true,
  isStandalone: true,
  techStack: true,
  translations: { select: { locale: true, name: true, tagline: true } },
} as const;

/** Một dòng `App` thô, đúng hình dạng `appCardSelect` trả về. */
type AppCardRecord = {
  slug: string;
  kind: AppKind;
  status: Status;
  isRepoPrivate: boolean;
  isStandalone: boolean;
  techStack: string[];
  translations: { locale: string; name: string; tagline: string | null }[];
};

/**
 * `null` khi thiếu cả bản dịch mặc định — nơi gọi bỏ qua bản ghi thay vì bịa nhãn
 * từ slug (quy ước 3 ở đầu file).
 */
function toAppCard(app: AppCardRecord, locale: string, fallback: string): AppCard | null {
  const translated = resolveTranslation(app.translations, locale, fallback);
  if (!translated) return null;

  return {
    slug: app.slug,
    name: translated.value.name,
    tagline: translated.value.tagline,
    kind: app.kind,
    status: app.status,
    isRepoPrivate: app.isRepoPrivate,
    techStack: app.techStack,
    integration: deriveIntegration(app),
  };
}

async function loadApps(locale: string): Promise<AppCard[]> {
  const fallback = await loadDefaultLocale();

  const rows = await prisma.app.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: appCardSelect,
  });

  return rows.flatMap((app) => {
    const card = toAppCard(app, locale, fallback);
    return card ? [card] : [];
  });
}

/** Thẻ ứng dụng cho trang chủ và `/[locale]/apps`. Chỉ gồm app đã publish. */
export function listApps(locale: string): Promise<AppCard[]> {
  if (!hasDatabase()) return Promise.resolve([]);

  return unstable_cache(() => loadApps(locale), ["apps-list", locale], {
    tags: [tags.appsList()],
  })();
}

// ---------------------------------------------------------------------------
// Danh sách cho trang quản trị
// ---------------------------------------------------------------------------

/** Một dòng trong bảng ứng dụng của CMS. Gồm cả `DRAFT` và `ARCHIVED`. */
export type AdminAppRow = {
  id: string;
  slug: string;
  kind: AppKind;
  status: Status;
  order: number;
  /** Tên hiển thị theo `locale` đang xem; `null` khi ngôn ngữ đó chưa có bản dịch. */
  name: string | null;
  /** Ngôn ngữ site đang phục vụ nhưng ứng dụng này chưa có bản dịch. */
  missingLocales: string[];
};

/**
 * Toàn bộ ứng dụng cho CMS, **không lọc theo trạng thái và không qua cache**.
 *
 * Hai điểm khác `listApps` là lý do hàm này tồn tại chứ không phải thêm tham số
 * vào hàm kia:
 *
 * 1. Trang quản trị phải thấy `DRAFT` — đó chính là thứ màn Tổng quan báo cáo.
 * 2. Bọc `unstable_cache` ở đây sẽ khiến người vừa bấm Lưu tải lại trang và thấy
 *    bản cũ. `revalidateTag` chỉ giải quyết được nếu mọi lối ghi đều nhớ gọi
 *    đúng tag; không cache thì không có gì phải nhớ.
 *
 * `missingLocales` so với `locales.generated.ts` — đúng tập ngôn ngữ mà định
 * tuyến đang phục vụ. Đọc bảng `Locale` sẽ chính xác hơn về ý định, nhưng lệch
 * với thực tế cho tới lần redeploy kế tiếp (spec §9.3), mà màn Tổng quan là chỗ
 * nói thật về hiện trạng.
 */
export async function listAppsForAdmin(locale: string): Promise<AdminAppRow[]> {
  if (!hasDatabase()) return [];

  const rows = await prisma.app.findMany({
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      slug: true,
      kind: true,
      status: true,
      order: true,
      translations: { select: { locale: true, name: true } },
    },
  });

  return rows.map((app) => {
    const byLocale = new Map(app.translations.map((tr) => [tr.locale, tr.name]));

    return {
      id: app.id,
      slug: app.slug,
      kind: app.kind,
      status: app.status,
      order: app.order,
      // Không bịa nhãn từ slug, kể cả trong CMS: thiếu bản dịch là thông tin cần
      // thấy, không phải chỗ để lấp bằng chuỗi trông như tên thật.
      name: byLocale.get(locale) ?? null,
      missingLocales: locales.filter((code) => !byLocale.has(code)),
    };
  });
}

// ---------------------------------------------------------------------------
// Dữ liệu cho trang soạn nội dung
// ---------------------------------------------------------------------------

/** Phần theo ngôn ngữ của một ứng dụng, dạng thô để đổ vào ô nhập. */
export type EditorAppTranslation = {
  name: string;
  tagline: string;
  summary: string;
};

export type EditorFeature = {
  id: string;
  /** Không theo ngôn ngữ. */
  icon: string | null;
  /** Khoá là mã ngôn ngữ. Ngôn ngữ chưa dịch thì **không có khoá**. */
  translations: Record<string, { title: string; description: string }>;
};

export type EditorSection = {
  id: string;
  /** Không theo ngôn ngữ: `#anchor` phải giống nhau ở mọi bản dịch. */
  anchor: string;
  translations: Record<string, { title: string; body: string }>;
};

export type EditorApp = {
  id: string;
  slug: string;
  kind: AppKind;
  status: Status;
  order: number;
  logoUrl: string | null;
  repoUrl: string | null;
  apiRepoUrl: string | null;
  demoUrl: string | null;
  isRepoPrivate: boolean;
  isStandalone: boolean;
  techStack: string[];

  /** Khoá là mã ngôn ngữ; ngôn ngữ chưa có bản dịch thì không có khoá. */
  translations: Record<string, EditorAppTranslation>;
  features: EditorFeature[];
  sections: EditorSection[];
};

/**
 * Toàn bộ nội dung của một ứng dụng ở **mọi ngôn ngữ**, dạng thô, **không cache**.
 *
 * Đây là truy vấn `TranslationMeter` cần. `AdminAppRow.missingLocales` chỉ trả
 * lời "app này có `AppTranslation` ở locale đó không" — đủ cho bảng danh sách,
 * nhưng vô dụng ở trang soạn thảo: một app có tên tiếng Anh vẫn có thể còn bảy
 * mục nội dung chưa dịch, và đó mới là con số người soạn cần thấy. Vì vậy ở đây
 * đọc bản dịch của **từng tính năng và từng mục**, ở **mọi** ngôn ngữ; phép đếm
 * `1 + số tính năng + số mục` nằm trong `AppEditor` để con số còn phản ánh cả
 * phần vừa gõ mà chưa lưu.
 *
 * Không dùng `getApp` cho trang soạn thảo, vì `getApp` đã chạy fallback ngôn ngữ:
 * mở bản EN của một mục chưa dịch sẽ thấy chữ tiếng Việt nằm trong ô nhập, và
 * lần bấm Lưu kế tiếp ghi đúng chữ đó thành "bản dịch tiếng Anh". Ở đây ngôn ngữ
 * nào chưa có bản dịch thì **không có khoá** trong `translations`, nên ô nhập
 * trống đúng như hiện trạng.
 *
 * Nhận `id` hoặc `slug`: bảng danh sách liên kết bằng slug vì đó là thứ người
 * vận hành đọc được trên URL, còn tầng ghi định danh bằng `id` để slug đổi được.
 */
export async function getAppForEditor(idOrSlug: string): Promise<EditorApp | null> {
  if (!hasDatabase()) return null;

  const app = await prisma.app.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      translations: true,
      features: { orderBy: { order: "asc" }, include: { translations: true } },
      sections: { orderBy: { order: "asc" }, include: { translations: true } },
    },
  });
  if (!app) return null;

  const translations: Record<string, EditorAppTranslation> = {};
  for (const row of app.translations) {
    translations[row.locale] = {
      name: row.name,
      tagline: row.tagline ?? "",
      summary: row.summary ?? "",
    };
  }

  const features: EditorFeature[] = app.features.map((feature) => ({
    id: feature.id,
    icon: feature.icon,
    translations: Object.fromEntries(
      feature.translations.map((row) => [
        row.locale,
        { title: row.title, description: row.description ?? "" },
      ]),
    ),
  }));

  const sections: EditorSection[] = app.sections.map((section) => ({
    id: section.id,
    anchor: section.anchor,
    translations: Object.fromEntries(
      section.translations.map((row) => [
        row.locale,
        // Thân bài sai định dạng thì trả chuỗi rỗng thay vì ném lỗi: trang công
        // khai thà lộ lỗi còn hơn render mục trống, nhưng trang soạn thảo là
        // đúng chỗ để **sửa** mục hỏng, mà nó phải mở được mới sửa được.
        { title: row.title, body: readSectionBody(row.body)?.content ?? "" },
      ]),
    ),
  }));

  return {
    id: app.id,
    slug: app.slug,
    kind: app.kind,
    status: app.status,
    order: app.order,
    logoUrl: app.logoUrl,
    repoUrl: app.repoUrl,
    apiRepoUrl: app.apiRepoUrl,
    demoUrl: app.demoUrl,
    isRepoPrivate: app.isRepoPrivate,
    isStandalone: app.isStandalone,
    techStack: app.techStack,
    translations,
    features,
    sections,
  };
}

// ---------------------------------------------------------------------------
// Trang hướng dẫn trong CMS
// ---------------------------------------------------------------------------

/** Một dòng trong bảng trang hướng dẫn của CMS. Gồm cả `DRAFT` và `ARCHIVED`. */
export type AdminDocRow = {
  id: string;
  slug: string;
  order: number;
  status: Status;
  /** Tiêu đề theo `locale` đang xem; `null` khi ngôn ngữ đó chưa có bản dịch. */
  title: string | null;
  missingLocales: string[];
  /** `true` với trang chủ (`slug = "home"`), trang duy nhất không có mục trong sidebar. */
  isLanding: boolean;
};

/**
 * Toàn bộ trang hướng dẫn cho CMS, **không lọc trạng thái và không qua cache** —
 * cùng hai lý do như `listAppsForAdmin`.
 *
 * Trang chủ **có** trong danh sách. Nó là `DocPage(slug="home")` nên nội dung
 * trang chủ chỉ sửa được ở đây; loại nó ra cho "gọn" nghĩa là trang chủ không bao
 * giờ sửa được qua CMS. Nó được đánh dấu `isLanding` để bảng nói rõ nó hiện ở
 * `/[locale]` chứ không phải `/[locale]/docs/home`.
 */
export async function listDocPagesForAdmin(locale: string): Promise<AdminDocRow[]> {
  if (!hasDatabase()) return [];

  const rows = await prisma.docPage.findMany({
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      slug: true,
      order: true,
      status: true,
      translations: { select: { locale: true, title: true } },
    },
  });

  return rows.map((page) => {
    const byLocale = new Map(page.translations.map((tr) => [tr.locale, tr.title]));

    return {
      id: page.id,
      slug: page.slug,
      order: page.order,
      status: page.status,
      // Không bịa nhãn từ slug, kể cả trong CMS: thiếu bản dịch là thông tin cần thấy.
      title: byLocale.get(locale) ?? null,
      missingLocales: locales.filter((code) => !byLocale.has(code)),
      isLanding: page.slug === LANDING_DOC_SLUG,
    };
  });
}

/** Phần theo ngôn ngữ của một trang hướng dẫn, dạng thô để đổ vào ô nhập. */
export type EditorDocPageTranslation = {
  title: string;
  description: string;
};

export type EditorDocPage = {
  id: string;
  slug: string;
  order: number;
  status: Status;
  isLanding: boolean;

  /** Khoá là mã ngôn ngữ; ngôn ngữ chưa có bản dịch thì không có khoá. */
  translations: Record<string, EditorDocPageTranslation>;
  sections: EditorSection[];
};

/**
 * Toàn bộ nội dung một trang hướng dẫn ở **mọi ngôn ngữ**, dạng thô, **không cache**.
 *
 * `getAppForEditor` là khuôn mẫu, và ba lý do của nó giữ nguyên ở đây: trang soạn
 * thảo phải thấy bản nháp, không được phục vụ từ cache, và **không** được chạy
 * fallback ngôn ngữ — mở bản EN của một mục chưa dịch mà thấy chữ tiếng Việt
 * trong ô nhập thì lần bấm Lưu kế tiếp ghi đúng chữ đó thành "bản dịch tiếng Anh".
 */
export async function getDocPageForEditor(idOrSlug: string): Promise<EditorDocPage | null> {
  if (!hasDatabase()) return null;

  const page = await prisma.docPage.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      translations: true,
      sections: { orderBy: { order: "asc" }, include: { translations: true } },
    },
  });
  if (!page) return null;

  const translations: Record<string, EditorDocPageTranslation> = {};
  for (const row of page.translations) {
    translations[row.locale] = { title: row.title, description: row.description ?? "" };
  }

  return {
    id: page.id,
    slug: page.slug,
    order: page.order,
    status: page.status,
    isLanding: page.slug === LANDING_DOC_SLUG,
    translations,
    sections: page.sections.map((section) => ({
      id: section.id,
      anchor: section.anchor,
      translations: Object.fromEntries(
        section.translations.map((row) => [
          row.locale,
          // Thân bài sai định dạng thì trả chuỗi rỗng thay vì ném lỗi: trang soạn
          // thảo là đúng chỗ để **sửa** mục hỏng, mà nó phải mở được mới sửa được.
          { title: row.title, body: readSectionBody(row.body)?.content ?? "" },
        ]),
      ),
    })),
  };
}

// ---------------------------------------------------------------------------
// Ngôn ngữ trong CMS
// ---------------------------------------------------------------------------

export type AdminLocaleRow = {
  code: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  order: number;
  /**
   * Định tuyến **hiện tại** có phục vụ ngôn ngữ này hay không, tức là nó có trong
   * `locales.generated.ts` chưa. Bật một ngôn ngữ mới trong DB chưa đủ để
   * `/xx/...` có trang: middleware đọc file sinh sẵn, nên cần một lần redeploy
   * (spec §9.3). Cột này để trang quản trị nói đúng hiện trạng đó.
   */
  routed: boolean;
};

/** Bảng `Locale` cho trang quản trị ngôn ngữ. Không cache, cùng lý do như trên. */
export async function listLocalesForAdmin(): Promise<AdminLocaleRow[]> {
  if (!hasDatabase()) return [];

  const rows = await prisma.locale.findMany({
    orderBy: [{ order: "asc" }, { code: "asc" }],
    select: { code: true, label: true, enabled: true, isDefault: true, order: true },
  });

  return rows.map((row) => ({ ...row, routed: locales.includes(row.code) }));
}

/**
 * Có cấu hình cơ sở dữ liệu hay không.
 *
 * Hàm đọc nội dung tự trả rỗng khi thiếu `DATABASE_URL`, nên trang không cần hỏi.
 * Thư viện ảnh thì khác: `listImages` đọc thẳng Prisma và **phải** đổ khi thiếu
 * cấu hình, vì một thư viện rỗng trông y như thư viện chưa có ảnh. Trang hỏi hàm
 * này để nói ra nguyên nhân thay vì để lỗi máy chủ ném ra một trang trắng.
 *
 * Bọc lại ở đây thay vì cho trang `import { hasDatabase } from "@/server/db"`:
 * `src/server/content` là cửa duy nhất của tầng dữ liệu, và giữ đúng cửa đó thì
 * không có trang nào chạm `db.ts`.
 */
export function hasContentDatabase(): boolean {
  return hasDatabase();
}

/** Số đếm cho cột điều hướng bên trái của CMS. */
export type AdminCounts = {
  nav: number;
  apps: number;
  docs: number;
  media: number;
  locales: number;
};

/**
 * Số đếm cạnh từng mục trong cột điều hướng quản trị. Đếm **mọi** trạng thái:
 * con số ở đây nói "có bao nhiêu bản ghi để quản lý", không phải "bao nhiêu bản
 * ghi công khai".
 *
 * `docs` đếm cả trang chủ, vì `/admin/docs` liệt kê cả nó: nội dung trang chủ là
 * `DocPage(slug="home")` và chỉ sửa được ở đó. Con số cạnh mục điều hướng phải
 * bằng số dòng người dùng thấy khi bấm vào mục đó.
 */
export async function getAdminCounts(): Promise<AdminCounts> {
  if (!hasDatabase()) return { nav: 0, apps: 0, docs: 0, media: 0, locales: 0 };

  const [nav, apps, docs, media, localeCount] = await Promise.all([
    prisma.navNode.count(),
    prisma.app.count(),
    prisma.docPage.count(),
    prisma.media.count(),
    prisma.locale.count(),
  ]);

  return { nav, apps, docs, media, locales: localeCount };
}

// ---------------------------------------------------------------------------
// Trang một ứng dụng
// ---------------------------------------------------------------------------

async function loadApp(
  slug: string,
  locale: string,
  includeDrafts: boolean,
): Promise<AppDetail | null> {
  const fallback = await loadDefaultLocale();

  const app = await prisma.app.findFirst({
    where: { slug, ...statusFilter(includeDrafts) },
    include: {
      translations: true,
      features: { orderBy: { order: "asc" }, include: { translations: true } },
      sections: { orderBy: { order: "asc" }, include: { translations: true } },
    },
  });
  if (!app) return null;

  const translated = resolveTranslation(app.translations, locale, fallback);
  if (!translated) return null;

  const sections = resolveSections(app.sections, locale, fallback, `ứng dụng "${slug}"`);

  return {
    id: app.id,
    slug: app.slug,
    kind: app.kind,
    status: app.status,
    order: app.order,
    logoUrl: app.logoUrl,
    repoUrl: app.repoUrl,
    apiRepoUrl: app.apiRepoUrl,
    demoUrl: app.demoUrl,
    isRepoPrivate: app.isRepoPrivate,
    isStandalone: app.isStandalone,
    techStack: app.techStack,
    integration: deriveIntegration(app),

    name: translated.value.name,
    tagline: translated.value.tagline,
    summary: translated.value.summary,
    locale: translated.locale,
    isFallback: translated.isFallback,

    features: resolveFeatures(app.features, locale, fallback),
    sections,
    toc: buildToc(sections),
  };
}

/**
 * Trang chi tiết một ứng dụng. Trả `null` khi không có, chưa publish, hoặc
 * không có bản dịch nào — cả ba trường hợp trang gọi `notFound()`.
 */
export function getApp(
  slug: string,
  locale: string,
  opts: ReadOptions = {},
): Promise<AppDetail | null> {
  if (!hasDatabase()) return Promise.resolve(null);
  if (opts.includeDrafts) return loadApp(slug, locale, true);

  return unstable_cache(() => loadApp(slug, locale, false), ["app", slug, locale], {
    tags: [tags.app(slug)],
  })();
}

// ---------------------------------------------------------------------------
// Trang tài liệu
// ---------------------------------------------------------------------------

async function loadDocPage(
  slug: string,
  locale: string,
  includeDrafts: boolean,
): Promise<DocPageDetail | null> {
  const fallback = await loadDefaultLocale();

  const page = await prisma.docPage.findFirst({
    where: { slug, ...statusFilter(includeDrafts) },
    include: {
      translations: true,
      sections: { orderBy: { order: "asc" }, include: { translations: true } },
    },
  });
  if (!page) return null;

  const translated = resolveTranslation(page.translations, locale, fallback);
  if (!translated) return null;

  const sections = resolveSections(page.sections, locale, fallback, `trang "${slug}"`);

  return {
    id: page.id,
    slug: page.slug,
    order: page.order,
    status: page.status,

    title: translated.value.title,
    description: translated.value.description,
    locale: translated.locale,
    isFallback: translated.isFallback,

    sections,
    toc: buildToc(sections),
  };
}

/** Trang hướng dẫn. Cùng quy ước `null` như `getApp`. */
export function getDocPage(
  slug: string,
  locale: string,
  opts: ReadOptions = {},
): Promise<DocPageDetail | null> {
  if (!hasDatabase()) return Promise.resolve(null);
  if (opts.includeDrafts) return loadDocPage(slug, locale, true);

  return unstable_cache(() => loadDocPage(slug, locale, false), ["doc", slug, locale], {
    tags: [tags.doc(slug)],
  })();
}

// ---------------------------------------------------------------------------
// Cây điều hướng
// ---------------------------------------------------------------------------

/**
 * Select đủ để dựng một `NavRow`.
 *
 * Nhãn của ba loại nút nằm ở ba bảng khác nhau (spec §3.1): `CONTAINER` lấy từ
 * `NavNodeTranslation`, `APP` từ `AppTranslation.name`, `DOC` từ
 * `DocPageTranslation.title`. Đọc cả ba trong một lượt để `buildNavTree` chọn
 * ngôn ngữ bằng đúng một cơ chế (`resolveTranslation`) thay vì mỗi loại nút một
 * lối riêng.
 */
const navNodeSelect = {
  id: true,
  parentId: true,
  order: true,
  status: true,
  kind: true,
  translations: { select: { locale: true, label: true } },
  app: { select: { slug: true, translations: { select: { locale: true, name: true } } } },
  docPage: { select: { slug: true, translations: { select: { locale: true, title: true } } } },
} as const;

/** Một dòng `NavNode` thô, đúng hình dạng `navNodeSelect` trả về. */
type NavNodeRecord = {
  id: string;
  parentId: string | null;
  order: number;
  status: Status;
  kind: NavKind;
  translations: { locale: string; label: string }[];
  app: { slug: string; translations: { locale: string; name: string }[] } | null;
  docPage: { slug: string; translations: { locale: string; title: string }[] } | null;
};

/**
 * Đổi một dòng thô thành `NavRow`: chọn nguồn nhãn theo loại nút, ghép href.
 *
 * `href` mang sẵn tiền tố locale để `<Link>` dùng thẳng. URL giữ **phẳng**, không
 * lồng theo cây (spec §5) — cây chỉ điều khiển cách hiển thị điều hướng.
 *
 * Nút khai `kind = APP` mà `appId` rỗng là dữ liệu CHECK constraint
 * `nav_node_kind_matches_target` đã cấm; nếu vẫn gặp thì trả nút **không nhãn**
 * để `buildNavTree` bỏ nó đi. Một mục vắng mặt thì thấy ngay, còn một liên kết
 * dẫn tới 404 thì trông như dữ liệu thật.
 */
function toNavRow(node: NavNodeRecord, locale: string): NavRow {
  const shared = {
    id: node.id,
    parentId: node.parentId,
    order: node.order,
    status: node.status,
    kind: node.kind,
  };

  if (node.kind === "APP") {
    return {
      ...shared,
      labels: (node.app?.translations ?? []).map((row) => ({
        locale: row.locale,
        value: row.name,
      })),
      href: node.app ? `/${locale}/apps/${node.app.slug}` : null,
    };
  }

  if (node.kind === "DOC") {
    return {
      ...shared,
      labels: (node.docPage?.translations ?? []).map((row) => ({
        locale: row.locale,
        value: row.title,
      })),
      href: node.docPage ? `/${locale}/docs/${node.docPage.slug}` : null,
    };
  }

  return {
    ...shared,
    labels: node.translations.map((row) => ({ locale: row.locale, value: row.label })),
    href: null,
  };
}

/**
 * Đọc **toàn bộ** cây ra danh sách phẳng, kể cả nút nháp.
 *
 * Nhận `client` thay vì dùng `prisma` trực tiếp để `mutations.ts` gọi được bằng
 * đúng transaction của nó: mọi hàm ghi phải kiểm bất biến trên trạng thái *sẽ*
 * được cam kết, mà đọc ngoài transaction thì chỉ thấy trạng thái cũ.
 */
export async function readNavRows(
  client: Pick<typeof prisma, "navNode">,
  locale: string,
): Promise<NavRow[]> {
  const nodes = await client.navNode.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: navNodeSelect,
  });

  return nodes.map((node) => toNavRow(node, locale));
}

async function loadNavTree(locale: string): Promise<NavTreeNode[]> {
  const fallback = await loadDefaultLocale();
  return buildNavTree(await readNavRows(prisma, locale), locale, fallback);
}

/**
 * Cây điều hướng công khai: nút gốc là dải tab trên cùng, con cháu của tab đang
 * mở là sidebar trái.
 *
 * Chỉ gồm nút đã publish — `buildNavTree` lo phần đó, cùng với việc bỏ nút mồ côi
 * và ném lỗi khi dữ liệu có chu trình.
 */
export function getNavTree(locale: string): Promise<NavTreeNode[]> {
  if (!hasDatabase()) return Promise.resolve([]);

  return unstable_cache(() => loadNavTree(locale), ["nav-tree", locale], {
    tags: [tags.nav()],
  })();
}

/**
 * Danh sách phẳng **không cache** cho trình soạn cây, gồm cả nút nháp.
 *
 * Trình soạn phải thấy đúng thứ nó vừa ghi. Bọc cache ở đây thì người dùng bấm
 * "Thêm nút", thấy cây cũ, kết luận là hỏng, bấm lần nữa — và lần này hỏng thật
 * vì đã có hai nút. Cùng lý do `listAppsForAdmin` không cache.
 *
 * `href` dựng theo locale **mặc định**: trong trình soạn nó chỉ là đường xem thử,
 * còn thứ quyết định cấu trúc là `parentId`, `order` và `kind`.
 */
export async function getNavRows(): Promise<NavRow[]> {
  if (!hasDatabase()) return [];

  return readNavRows(prisma, await loadDefaultLocale());
}

/** Một trang tài liệu chưa gắn vào cây. */
export type UnlinkedDoc = { slug: string; title: string };

export type UnlinkedContent = { apps: AppCard[]; docs: UnlinkedDoc[] };

/**
 * Nội dung chưa gắn vào cây — nguồn của cảnh báo "chưa có trong điều hướng" ở
 * trang quản trị (spec §5 và rủi ro R3).
 *
 * Không cache: đây là dữ liệu quản trị và nó đổi ngay mỗi lần ai đó gắn một nút.
 *
 * Gồm cả bản nháp, vì `AppCard.status` đã nói rõ trạng thái và người viết cần
 * thấy cả bài chưa publish của mình. `home` bị loại: route `/…/docs/home` cố tình
 * 404 (xem `LANDING_DOC_SLUG`) nên nhắc gắn nó vào cây là nhắc làm một việc sai.
 *
 * Tên hiển thị dựng theo locale **mặc định** — cảnh báo này nói về cấu trúc, và
 * một bài chỉ có bản dịch mặc định vẫn phải xuất hiện trong danh sách.
 */
export async function getUnlinkedContent(): Promise<UnlinkedContent> {
  if (!hasDatabase()) return { apps: [], docs: [] };

  const fallback = await loadDefaultLocale();

  const [apps, docs] = await Promise.all([
    prisma.app.findMany({
      where: { navNode: null },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: appCardSelect,
    }),
    prisma.docPage.findMany({
      where: { navNode: null, slug: { not: LANDING_DOC_SLUG } },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: { slug: true, translations: { select: { locale: true, title: true } } },
    }),
  ]);

  return {
    apps: apps.flatMap((app) => {
      const card = toAppCard(app, fallback, fallback);
      return card ? [card] : [];
    }),
    docs: docs.flatMap((doc) => {
      const translated = resolveTranslation(doc.translations, fallback, fallback);
      return translated ? [{ slug: doc.slug, title: translated.value.title }] : [];
    }),
  };
}

// ---------------------------------------------------------------------------
// Chỉ mục tìm kiếm
// ---------------------------------------------------------------------------

/** Gộp thân bài về chuỗi markdown thô; mục hỏng thì bỏ qua thay vì làm hỏng cả chỉ mục. */
function sectionsForIndex(
  sections: {
    translations: { locale: string; title: string; body: unknown }[];
  }[],
  locale: string,
  fallback: string,
): { title: string; body: string }[] {
  return sections.flatMap((section) => {
    const translated = resolveTranslation(section.translations, locale, fallback);
    if (!translated) return [];

    const body = readSectionBody(translated.value.body);
    return [{ title: translated.value.title, body: body?.content ?? "" }];
  });
}

async function loadSearchIndex(locale: string): Promise<SearchDoc[]> {
  const fallback = await loadDefaultLocale();

  const [apps, docs] = await Promise.all([
    prisma.app.findMany({
      where: { status: PUBLISHED },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: {
        slug: true,
        translations: { select: { locale: true, name: true } },
        sections: {
          orderBy: { order: "asc" },
          select: { translations: { select: { locale: true, title: true, body: true } } },
        },
      },
    }),
    prisma.docPage.findMany({
      where: { status: PUBLISHED },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: {
        slug: true,
        translations: { select: { locale: true, title: true } },
        sections: {
          orderBy: { order: "asc" },
          select: { translations: { select: { locale: true, title: true, body: true } } },
        },
      },
    }),
  ]);

  const input: SearchIndexInput = {
    locale,
    apps: apps.flatMap((app) => {
      const translated = resolveTranslation(app.translations, locale, fallback);
      if (!translated) return [];
      return [
        {
          slug: app.slug,
          name: translated.value.name,
          sections: sectionsForIndex(app.sections, locale, fallback),
        },
      ];
    }),
    docs: docs.flatMap((doc) => {
      const translated = resolveTranslation(doc.translations, locale, fallback);
      if (!translated) return [];
      return [
        {
          slug: doc.slug,
          title: translated.value.title,
          sections: sectionsForIndex(doc.sections, locale, fallback),
        },
      ];
    }),
  };

  return buildSearchIndex(input);
}

/**
 * Chỉ mục cho `GET /api/search-index/[locale]`.
 *
 * Không sinh lúc build (spec §7.3): sinh lúc build thì kết quả tìm lệch với nội
 * dung cho tới lần deploy sau, phá vỡ lời hứa "sửa là thấy ngay".
 */
export function getSearchIndex(locale: string): Promise<SearchDoc[]> {
  if (!hasDatabase()) return Promise.resolve([]);

  return unstable_cache(() => loadSearchIndex(locale), ["search-index", locale], {
    tags: [tags.searchIndex()],
  })();
}

// ---------------------------------------------------------------------------
// Slug cho generateStaticParams
// ---------------------------------------------------------------------------

async function loadStaticSlugs(): Promise<{ apps: string[]; docs: string[] }> {
  const [apps, docs] = await Promise.all([
    prisma.app.findMany({
      where: { status: PUBLISHED },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: { slug: true },
    }),
    prisma.docPage.findMany({
      where: { status: PUBLISHED, slug: { not: LANDING_DOC_SLUG } },
      orderBy: [{ order: "asc" }, { slug: "asc" }],
      select: { slug: true },
    }),
  ]);

  return { apps: apps.map((a) => a.slug), docs: docs.map((d) => d.slug) };
}

/**
 * Slug để `generateStaticParams` dựng trang tĩnh.
 *
 * **Chưa cấu hình `DATABASE_URL` thì trả rỗng, tuyệt đối không ném lỗi.** Đây là
 * thứ giữ cho `next build` chạy được khi chưa có DB. Kiểm `hasDatabase()` trước
 * cả `unstable_cache` để không chạm gì tới Prisma lẫn cache của Next.
 *
 * `dynamicParams` để mặc định `true`, nên app mới tạo trong CMS vẫn có trang
 * ngay mà không cần redeploy (spec §7.1).
 */
export function getStaticSlugs(): Promise<{ apps: string[]; docs: string[] }> {
  if (!hasDatabase()) return Promise.resolve({ apps: [], docs: [] });

  return unstable_cache(() => loadStaticSlugs(), ["static-slugs"], {
    tags: [tags.appsList(), tags.nav()],
  })();
}
