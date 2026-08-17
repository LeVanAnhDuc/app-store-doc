import { unstable_cache } from "next/cache";

import { defaultLocale as fallbackLocaleOfLastResort } from "@/i18n/locales.generated";
import { appKindValues, sectionBodySchema, statusValues, type SectionBody } from "@/lib/schemas";
import { buildSearchIndex, type SearchDoc, type SearchIndexInput } from "@/lib/search-index";
import { hasDatabase, prisma } from "@/server/db";
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

/** Trang chủ `/[locale]` render `DocPage(slug="home")`, nên nó không có mục riêng trong sidebar. */
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
  group: string | null;
  order: number;
  status: Status;

  title: string;
  description: string | null;
  locale: string;
  isFallback: boolean;

  sections: ResolvedSection[];
  toc: TocItem[];
};

export type NavItem = {
  slug: string;
  title: string;
  /** Đã có tiền tố locale, dùng thẳng cho `<Link href>`. */
  href: string;
  isFallback: boolean;
};

/** Một nhóm trong sidebar. `group === null` là nhóm không tên. */
export type NavGroup = {
  group: string | null;
  items: NavItem[];
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
 */
async function loadDefaultLocale(): Promise<string> {
  const rows = await prisma.locale.findMany({
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

async function loadApps(locale: string): Promise<AppCard[]> {
  const fallback = await loadDefaultLocale();

  const rows = await prisma.app.findMany({
    where: { status: PUBLISHED },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: {
      slug: true,
      kind: true,
      status: true,
      isRepoPrivate: true,
      isStandalone: true,
      techStack: true,
      translations: { select: { locale: true, name: true, tagline: true } },
    },
  });

  return rows.flatMap((app) => {
    const translated = resolveTranslation(app.translations, locale, fallback);
    if (!translated) return [];

    return [
      {
        slug: app.slug,
        name: translated.value.name,
        tagline: translated.value.tagline,
        kind: app.kind,
        status: app.status,
        isRepoPrivate: app.isRepoPrivate,
        techStack: app.techStack,
        integration: deriveIntegration(app),
      },
    ];
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
    group: page.group,
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
// Điều hướng sidebar
// ---------------------------------------------------------------------------

async function loadNav(locale: string): Promise<NavGroup[]> {
  const fallback = await loadDefaultLocale();

  const pages = await prisma.docPage.findMany({
    where: { status: PUBLISHED, slug: { not: LANDING_DOC_SLUG } },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    select: {
      slug: true,
      group: true,
      translations: { select: { locale: true, title: true } },
    },
  });

  // Nhóm giữ đúng thứ tự xuất hiện đầu tiên, tức là theo `order` của trang nhỏ
  // nhất trong nhóm. Sắp lại theo tên nhóm sẽ khiến CMS kéo thả xong mà sidebar
  // không đổi thứ tự — người dùng không hiểu vì sao.
  const groups = new Map<string | null, NavItem[]>();

  for (const page of pages) {
    const translated = resolveTranslation(page.translations, locale, fallback);
    if (!translated) continue;

    const key = page.group ?? null;
    const items = groups.get(key) ?? [];
    items.push({
      slug: page.slug,
      title: translated.value.title,
      href: `/${locale}/docs/${page.slug}`,
      isFallback: translated.isFallback,
    });
    groups.set(key, items);
  }

  return [...groups].map(([group, items]) => ({ group, items }));
}

/** Cây điều hướng sidebar, nhóm theo `DocPage.group` và sắp theo `DocPage.order`. */
export function listNav(locale: string): Promise<NavGroup[]> {
  if (!hasDatabase()) return Promise.resolve([]);

  return unstable_cache(() => loadNav(locale), ["nav", locale], {
    tags: [tags.nav()],
  })();
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
