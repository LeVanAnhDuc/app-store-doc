import { revalidateTag } from "next/cache";

import { ensureUniqueAnchors } from "@/lib/slug";
import type { AppInput, DocPageInput, FeatureInput, SectionInput } from "@/lib/schemas";
import { prisma } from "@/server/db";
import { assertSingleDefaultLocale } from "./resolve";
import { tags } from "./tags";

/**
 * Ghi nội dung và làm mới cache. Cùng với `queries.ts`, đây là nơi duy nhất
 * chạm Prisma.
 *
 * **Bảng revalidate bắt buộc (spec §8.3):**
 *
 * | Thay đổi | Tag |
 * |---|---|
 * | Nội dung một app | `app:<slug>`, `search-index` |
 * | Tên / thứ tự / trạng thái publish | thêm `nav`, `apps-list` |
 * | Nội dung một trang docs | `doc:<slug>`, `search-index` |
 *
 * Gọi thiếu một tag nghĩa là người dùng sửa nội dung xong, bấm Lưu, thấy toast
 * "Đã lưu", rồi mở trang công khai và không thấy gì đổi — không có lỗi, không có
 * log, không có gì để lần. Vì vậy mọi hàm dưới đây gọi `revalidateTag` ngay sau
 * khi transaction cam kết, và khi slug đổi thì làm mới **cả tag cũ lẫn tag mới**:
 * bỏ sót tag cũ sẽ để lại một trang ma phục vụ nội dung đã bị dời đi.
 *
 * Kiểm quyền **không** nằm ở đây. Server action gọi `requireAdmin()` ở dòng đầu
 * (spec §10.2); tầng nội dung không được biết tới Auth.js.
 */

const DUPLICATE_APP_SLUG = "Slug này đã có ứng dụng khác dùng.";
const DUPLICATE_DOC_SLUG = "Slug này đã có trang tài liệu khác dùng.";

/**
 * Nhận diện lỗi trùng khoá duy nhất của Prisma.
 *
 * So sánh `code` thay vì `instanceof PrismaClientKnownRequestError`: lớp lỗi đi
 * kèm client được sinh ra, nên `instanceof` sai âm tính khi lỗi đi qua ranh giới
 * bundle — mà sai âm tính ở đây nghĩa là để lộ mã `P2002` cho người dùng cuối
 * (spec §12).
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Đánh dấu một cache tag là hết hạn.
 *
 * Next 16 đổi `revalidateTag` thành hai tham số: tham số thứ hai là hồ sơ
 * `cacheLife` cho biết được phép phục vụ bản cũ thêm bao lâu. `"max"` là giá trị
 * chính tài liệu Next chỉ định để giữ nguyên hành vi một-tham-số cũ, tức là làm
 * mới mọi mục mang tag bất kể chúng được cache với thời hạn nào.
 *
 * Không dùng `updateTag`: nó chỉ chạy được bên trong Server Action và ném lỗi ở
 * route handler, trong khi tầng nội dung phải gọi được từ cả hai chỗ.
 */
function revalidate(tag: string): void {
  revalidateTag(tag, "max");
}

/** Đổi lỗi trùng khoá thành câu tiếng Việt; mọi lỗi khác giữ nguyên để không nuốt mất. */
async function withFriendlySlugError<T>(run: () => Promise<T>, message: string): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Ứng dụng
// ---------------------------------------------------------------------------

/** Phần theo ngôn ngữ của một ứng dụng. */
export type AppTranslationInput = {
  locale: string;
  name: string;
  tagline?: string | null;
  summary?: string | null;
};

/**
 * `id` vắng mặt nghĩa là tạo mới. Có `id` thì sửa đúng bản ghi đó, nên slug đổi
 * được — không định danh bằng slug vì như vậy sẽ không bao giờ đổi được slug.
 */
export type SaveAppInput = AppInput & {
  id?: string;
  translation?: AppTranslationInput;
};

export type SavedApp = { id: string; slug: string };

export async function saveApp(input: SaveAppInput): Promise<SavedApp> {
  const { id, translation, ...general } = input;

  // Trường tuỳ chọn vắng mặt nghĩa là người dùng đã xoá trắng ô đó, nên phải ghi
  // `null`. Để `undefined` thì Prisma hiểu là "giữ nguyên" và ô vừa xoá lại hiện
  // về sau khi tải lại trang.
  const data = {
    slug: general.slug,
    kind: general.kind,
    status: general.status,
    order: general.order,
    isRepoPrivate: general.isRepoPrivate,
    isStandalone: general.isStandalone,
    techStack: general.techStack,
    logoUrl: general.logoUrl ?? null,
    repoUrl: general.repoUrl ?? null,
    apiRepoUrl: general.apiRepoUrl ?? null,
    demoUrl: general.demoUrl ?? null,
  };

  const result = await withFriendlySlugError(
    () =>
      prisma.$transaction(async (tx) => {
        const before = id
          ? await tx.app.findUnique({ where: { id }, select: { slug: true } })
          : null;
        if (id && !before) {
          throw new Error("Không tìm thấy ứng dụng cần sửa. Có thể nó vừa bị xoá.");
        }

        const app = id
          ? await tx.app.update({ where: { id }, data, select: { id: true, slug: true } })
          : await tx.app.create({ data, select: { id: true, slug: true } });

        if (translation) {
          await tx.appTranslation.upsert({
            where: { appId_locale: { appId: app.id, locale: translation.locale } },
            create: {
              appId: app.id,
              locale: translation.locale,
              name: translation.name,
              tagline: translation.tagline ?? null,
              summary: translation.summary ?? null,
            },
            update: {
              name: translation.name,
              tagline: translation.tagline ?? null,
              summary: translation.summary ?? null,
            },
          });
        }

        return { app, previousSlug: before?.slug ?? null };
      }),
    DUPLICATE_APP_SLUG,
  );

  // `saveApp` ghi cả tên, thứ tự lẫn trạng thái publish nên luôn rơi vào hàng
  // thứ hai của bảng §8.3: đủ bốn tag.
  revalidateApp(result.app.slug, result.previousSlug);
  revalidate(tags.nav());
  revalidate(tags.appsList());

  return result.app;
}

/**
 * Đổi riêng trạng thái publish của một ứng dụng.
 *
 * Không dùng `saveApp` cho việc này: `saveApp` ghi **toàn bộ** khối thông tin
 * chung và cố tình đổi trường vắng mặt thành `null`. Bật/tắt publish từ bảng
 * danh sách — nơi chỉ có slug, tên và trạng thái — mà đi qua `saveApp` sẽ xoá
 * sạch `repoUrl`, `techStack`, `logoUrl` của ứng dụng đó mà không báo gì.
 */
export async function setAppStatus(id: string, status: AppInput["status"]): Promise<SavedApp> {
  const app = await prisma.app.update({
    where: { id },
    data: { status },
    select: { id: true, slug: true },
  });

  // Trạng thái publish quyết định app có trong danh sách công khai hay không:
  // hàng thứ hai của bảng §8.3.
  revalidateApp(app.slug);
  revalidate(tags.nav());
  revalidate(tags.appsList());

  return app;
}

/**
 * Sắp lại thứ tự ứng dụng. `ids` là danh sách **đầy đủ** theo đúng thứ tự mới;
 * `order` lấy từ vị trí trong mảng, cùng quy ước với `saveFeatures`.
 *
 * Kiểm đủ số lượng trước khi ghi: gửi lên thiếu một id nghĩa là bảng phía trình
 * duyệt đã cũ, và ghi tiếp sẽ để lại hai ứng dụng cùng `order`.
 */
export async function reorderApps(ids: string[]): Promise<void> {
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Danh sách thứ tự có ứng dụng bị lặp. Hãy tải lại trang rồi thử lại.");
  }

  const slugs = await prisma.$transaction(async (tx) => {
    const total = await tx.app.count();
    if (total !== ids.length) {
      throw new Error(
        `Danh sách thứ tự có ${ids.length} ứng dụng nhưng cơ sở dữ liệu có ${total}. ` +
          "Có người vừa thêm hoặc xoá ứng dụng — hãy tải lại trang rồi sắp lại.",
      );
    }

    const rows = await tx.app.findMany({ where: { id: { in: ids } }, select: { slug: true } });
    if (rows.length !== ids.length) {
      throw new Error("Danh sách thứ tự có ứng dụng không tồn tại. Hãy tải lại trang rồi thử lại.");
    }

    for (const [index, id] of ids.entries()) {
      await tx.app.update({ where: { id }, data: { order: index } });
    }

    return rows.map((row) => row.slug);
  });

  // Thứ tự đổi làm lệch cả trang chủ, trang danh sách và sidebar.
  for (const slug of slugs) revalidate(tags.app(slug));
  revalidate(tags.searchIndex());
  revalidate(tags.nav());
  revalidate(tags.appsList());
}

/** Làm mới nội dung một app; slug đổi thì làm mới cả tag cũ. */
function revalidateApp(slug: string, previousSlug?: string | null): void {
  revalidate(tags.app(slug));
  if (previousSlug && previousSlug !== slug) revalidate(tags.app(previousSlug));
  revalidate(tags.searchIndex());
}

/** Làm mới nội dung một trang tài liệu; slug đổi thì làm mới cả tag cũ. */
function revalidateDoc(slug: string, previousSlug?: string | null): void {
  revalidate(tags.doc(slug));
  if (previousSlug && previousSlug !== slug) revalidate(tags.doc(previousSlug));
  revalidate(tags.searchIndex());
}

// ---------------------------------------------------------------------------
// Tính năng
// ---------------------------------------------------------------------------

/** `id` vắng mặt là tính năng mới thêm trong lần soạn này. */
export type FeatureItemInput = FeatureInput & { id?: string };

export type SaveFeaturesInput = {
  /** Ứng dụng sở hữu, định danh bằng slug vì đó là thứ tag cache dùng. */
  appSlug: string;
  locale: string;
  /** Danh sách **đầy đủ** theo đúng thứ tự hiển thị. Thiếu mục nào là xoá mục đó. */
  features: FeatureItemInput[];
};

/**
 * Ghi đè toàn bộ danh sách tính năng của một app.
 *
 * Thứ tự lấy từ vị trí trong mảng, không lấy từ `order` gửi lên: kéo thả trong
 * CMS là thứ tự hiển thị thật (spec §8.2.4), và hai nguồn thứ tự song song thì
 * sớm muộn cũng lệch nhau.
 */
export async function saveFeatures(input: SaveFeaturesInput): Promise<void> {
  const { appSlug, locale, features } = input;

  await prisma.$transaction(async (tx) => {
    const app = await tx.app.findUnique({ where: { slug: appSlug }, select: { id: true } });
    if (!app) throw new Error(`Không tìm thấy ứng dụng có slug "${appSlug}".`);

    const keptIds = features.map((f) => f.id).filter((id): id is string => Boolean(id));
    if (keptIds.length) {
      const owned = await tx.feature.count({ where: { appId: app.id, id: { in: keptIds } } });
      if (owned !== new Set(keptIds).size) {
        throw new Error(
          `Danh sách gửi lên có tính năng không thuộc ứng dụng "${appSlug}". ` +
            "Hãy tải lại trang soạn thảo rồi thử lại.",
        );
      }
    }

    await tx.feature.deleteMany({
      where: keptIds.length ? { appId: app.id, id: { notIn: keptIds } } : { appId: app.id },
    });

    for (const [index, feature] of features.entries()) {
      const row = feature.id
        ? await tx.feature.update({
            where: { id: feature.id },
            data: { order: index, icon: feature.icon ?? null },
            select: { id: true },
          })
        : await tx.feature.create({
            data: { appId: app.id, order: index, icon: feature.icon ?? null },
            select: { id: true },
          });

      await tx.featureTranslation.upsert({
        where: { featureId_locale: { featureId: row.id, locale } },
        create: {
          featureId: row.id,
          locale,
          title: feature.title,
          description: feature.description ?? null,
        },
        update: { title: feature.title, description: feature.description ?? null },
      });
    }
  });

  // Tính năng là nội dung của app: hàng thứ nhất của bảng §8.3.
  revalidateApp(appSlug);
}

// ---------------------------------------------------------------------------
// Mục nội dung
// ---------------------------------------------------------------------------

/** `Section` dùng chung cho App và DocPage, nên chủ sở hữu phải nói rõ là bên nào. */
export type SectionOwner = { appSlug: string } | { docSlug: string };

export type SectionItemInput = SectionInput & { id?: string };

export type SaveSectionsInput = {
  owner: SectionOwner;
  locale: string;
  /** Danh sách **đầy đủ** theo đúng thứ tự hiển thị. Thiếu mục nào là xoá mục đó. */
  sections: SectionItemInput[];
};

/**
 * Ghi đè toàn bộ mục nội dung của một app hoặc một trang tài liệu.
 *
 * Anchor trùng bị chặn **trước khi** ghi: trùng anchor thì trang vẫn render bình
 * thường, chỉ có mục lục và liên kết `#` nhảy sai chỗ — lỗi im lặng mà chỉ người
 * đọc phát hiện ra (spec §6.4).
 */
export async function saveSections(input: SaveSectionsInput): Promise<void> {
  const { owner, locale, sections } = input;

  const unique = ensureUniqueAnchors(sections.map((s) => s.anchor));
  if (!unique.ok) {
    throw new Error(
      `Có hai mục cùng dùng anchor "${unique.duplicate}". ` +
        "Mục lục và liên kết # sẽ nhảy sai chỗ. Hãy đổi anchor của một trong hai mục.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const link = await resolveSectionOwner(tx, owner);

    const keptIds = sections.map((s) => s.id).filter((id): id is string => Boolean(id));
    if (keptIds.length) {
      const owned = await tx.section.count({ where: { ...link, id: { in: keptIds } } });
      if (owned !== new Set(keptIds).size) {
        throw new Error(
          "Danh sách gửi lên có mục nội dung không thuộc trang này. " +
            "Hãy tải lại trang soạn thảo rồi thử lại.",
        );
      }
    }

    await tx.section.deleteMany({
      where: keptIds.length ? { ...link, id: { notIn: keptIds } } : link,
    });

    for (const [index, section] of sections.entries()) {
      const row = section.id
        ? await tx.section.update({
            where: { id: section.id },
            data: { order: index, anchor: section.anchor },
            select: { id: true },
          })
        : await tx.section.create({
            data: { ...link, order: index, anchor: section.anchor },
            select: { id: true },
          });

      await tx.sectionTranslation.upsert({
        where: { sectionId_locale: { sectionId: row.id, locale } },
        create: { sectionId: row.id, locale, title: section.title, body: section.body },
        update: { title: section.title, body: section.body },
      });
    }
  });

  if ("appSlug" in owner) revalidateApp(owner.appSlug);
  else revalidateDoc(owner.docSlug);
}

/** Khoá ngoại của chủ sở hữu, dùng chung cho `where` lẫn `data`. */
type SectionLink = { appId: string; docPageId?: undefined } | { docPageId: string; appId?: undefined };

async function resolveSectionOwner(
  tx: Pick<typeof prisma, "app" | "docPage">,
  owner: SectionOwner,
): Promise<SectionLink> {
  if ("appSlug" in owner) {
    const app = await tx.app.findUnique({ where: { slug: owner.appSlug }, select: { id: true } });
    if (!app) throw new Error(`Không tìm thấy ứng dụng có slug "${owner.appSlug}".`);
    return { appId: app.id };
  }

  const page = await tx.docPage.findUnique({
    where: { slug: owner.docSlug },
    select: { id: true },
  });
  if (!page) throw new Error(`Không tìm thấy trang tài liệu có slug "${owner.docSlug}".`);
  return { docPageId: page.id };
}

// ---------------------------------------------------------------------------
// Trang tài liệu
// ---------------------------------------------------------------------------

export type SaveDocPageInput = DocPageInput & { id?: string; locale: string };

export type SavedDocPage = { id: string; slug: string };

export async function saveDocPage(input: SaveDocPageInput): Promise<SavedDocPage> {
  const { id, locale, title, description, ...general } = input;

  const data = {
    slug: general.slug,
    group: general.group ?? null,
    order: general.order,
    status: general.status,
  };

  const result = await withFriendlySlugError(
    () =>
      prisma.$transaction(async (tx) => {
        const before = id
          ? await tx.docPage.findUnique({ where: { id }, select: { slug: true } })
          : null;
        if (id && !before) {
          throw new Error("Không tìm thấy trang tài liệu cần sửa. Có thể nó vừa bị xoá.");
        }

        const page = id
          ? await tx.docPage.update({ where: { id }, data, select: { id: true, slug: true } })
          : await tx.docPage.create({ data, select: { id: true, slug: true } });

        await tx.docPageTranslation.upsert({
          where: { docPageId_locale: { docPageId: page.id, locale } },
          create: { docPageId: page.id, locale, title, description: description ?? null },
          update: { title, description: description ?? null },
        });

        return { page, previousSlug: before?.slug ?? null };
      }),
    DUPLICATE_DOC_SLUG,
  );

  revalidateDoc(result.page.slug, result.previousSlug);
  // Tiêu đề, nhóm, thứ tự và trạng thái publish đều dựng nên sidebar, nên hàng
  // thứ hai của bảng §8.3 áp dụng — trừ `apps-list`, vì trang tài liệu không bao
  // giờ xuất hiện trong danh sách ứng dụng.
  revalidate(tags.nav());

  return result.page;
}

// ---------------------------------------------------------------------------
// Ngôn ngữ
// ---------------------------------------------------------------------------

/**
 * Bật/tắt một ngôn ngữ.
 *
 * Tắt locale mặc định sẽ làm sập toàn bộ cơ chế fallback (spec §6.4), nên bất
 * biến được kiểm **bên trong** transaction: `assertSingleDefaultLocale` ném lỗi
 * là transaction cuộn lại và DB không bao giờ ở trạng thái sai.
 *
 * Thêm một ngôn ngữ **mới** vẫn cần một lần redeploy vì middleware đọc
 * `locales.generated.ts` (spec §9.3); bật/tắt thì không.
 */
export async function setLocaleEnabled(code: string, enabled: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.locale.findUnique({ where: { code }, select: { code: true } });
    if (!existing) throw new Error(`Không tìm thấy ngôn ngữ có mã "${code}".`);

    await tx.locale.update({ where: { code }, data: { enabled } });

    const rows = await tx.locale.findMany({
      select: { code: true, isDefault: true, enabled: true },
    });
    assertSingleDefaultLocale(rows);
  });

  // Spec §8.3 chỉ đòi `nav`. Làm mới thêm hai tag kia vì cả danh sách app lẫn
  // chỉ mục tìm kiếm đều được cache **theo locale**: bỏ sót chúng thì ngôn ngữ
  // vừa tắt vẫn tiếp tục được phục vụ từ cache cho tới lần ghi nội dung kế tiếp.
  revalidate(tags.nav());
  revalidate(tags.appsList());
  revalidate(tags.searchIndex());
}
