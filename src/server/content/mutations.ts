import { revalidateTag } from "next/cache";

import { ensureUniqueAnchors } from "@/lib/slug";
import type { AppInput, DocPageInput, FeatureInput, SectionInput } from "@/lib/schemas";
import { prisma } from "@/server/db";
import { assertNavInvariants, wouldCreateCycle, type NavKind, type NavRow } from "./nav";
import { loadDefaultLocale, readNavRows, type Status } from "./queries";
import { assertSingleDefaultLocale, planContentSave, resolveTranslation } from "./resolve";
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
  /** Ngôn ngữ của **tiêu đề và mô tả** trong danh sách; cấu trúc thì dùng chung. */
  locale: string;
  /**
   * Cấu trúc **đầy đủ** theo đúng thứ tự hiển thị. Mục vắng mặt là mục bị xoá;
   * mục có tiêu đề rỗng chỉ là mục chưa dịch sang `locale` — xem `planContentSave`.
   */
  features: FeatureItemInput[];
};

/**
 * Ghi cấu trúc danh sách tính năng của một app, cộng bản dịch của **một** ngôn ngữ.
 *
 * Thứ tự lấy từ vị trí trong mảng, không lấy từ `order` gửi lên: kéo thả trong
 * CMS là thứ tự hiển thị thật (spec §8.2.4), và hai nguồn thứ tự song song thì
 * sớm muộn cũng lệch nhau.
 *
 * Tiêu đề rỗng **không** xoá mục: nó gỡ đúng bản dịch của `locale` và để nguyên
 * bản dịch của mọi ngôn ngữ khác. Nhờ vậy dịch dần sang ngôn ngữ thứ hai là việc
 * làm được — trước đây gửi danh sách còn mục chưa dịch là xoá sạch những mục đó.
 */
export async function saveFeatures(input: SaveFeaturesInput): Promise<void> {
  const { appSlug, locale, features } = input;

  await prisma.$transaction(async (tx) => {
    const app = await tx.app.findUnique({ where: { slug: appSlug }, select: { id: true } });
    if (!app) throw new Error(`Không tìm thấy ứng dụng có slug "${appSlug}".`);

    const existing = await tx.feature.findMany({
      where: { appId: app.id },
      select: { id: true },
    });
    const plan = planContentSave(features, existing.map((row) => row.id));

    if (plan.foreignIds.length) {
      throw new Error(
        `Danh sách gửi lên có tính năng không thuộc ứng dụng "${appSlug}" ` +
          `(${plan.foreignIds.join(", ")}). Hãy tải lại trang soạn thảo rồi thử lại.`,
      );
    }

    if (plan.removedIds.length) {
      await tx.feature.deleteMany({ where: { appId: app.id, id: { in: plan.removedIds } } });
    }

    for (const planned of plan.items) {
      const feature = planned.item;
      const row = planned.id
        ? await tx.feature.update({
            where: { id: planned.id },
            data: { order: planned.order, icon: feature.icon ?? null },
            select: { id: true },
          })
        : await tx.feature.create({
            data: { appId: app.id, order: planned.order, icon: feature.icon ?? null },
            select: { id: true },
          });

      if (planned.translated) {
        await tx.featureTranslation.upsert({
          where: { featureId_locale: { featureId: row.id, locale } },
          create: {
            featureId: row.id,
            locale,
            title: feature.title.trim(),
            description: feature.description ?? null,
          },
          update: { title: feature.title.trim(), description: feature.description ?? null },
        });
      } else {
        // Chỉ gỡ bản dịch của đúng ngôn ngữ này. `deleteMany` chứ không `delete`:
        // ngôn ngữ chưa từng được dịch thì không có gì để gỡ, và đó là chuyện
        // bình thường, không phải lỗi.
        await tx.featureTranslation.deleteMany({ where: { featureId: row.id, locale } });
      }
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
  /** Ngôn ngữ của **tiêu đề và thân bài**; anchor và thứ tự thì dùng chung. */
  locale: string;
  /**
   * Cấu trúc **đầy đủ** theo đúng thứ tự hiển thị. Mục vắng mặt là mục bị xoá;
   * mục có tiêu đề rỗng chỉ là mục chưa dịch sang `locale`.
   */
  sections: SectionItemInput[];
};

/**
 * Ghi cấu trúc mục nội dung của một app hoặc một trang tài liệu, cộng bản dịch
 * của **một** ngôn ngữ.
 *
 * Anchor trùng bị chặn **trước khi** ghi: trùng anchor thì trang vẫn render bình
 * thường, chỉ có mục lục và liên kết `#` nhảy sai chỗ — lỗi im lặng mà chỉ người
 * đọc phát hiện ra (spec §6.4). Anchor là cấu trúc nên nó bắt buộc ở mọi lần
 * lưu, kể cả khi mục chưa có bản dịch nào.
 *
 * Tiêu đề rỗng gỡ đúng bản dịch của `locale` và giữ nguyên các ngôn ngữ khác.
 * Thân bài đi cùng tiêu đề: một mục không có tiêu đề thì không có dòng mục lục
 * và không có thẻ tiêu đề, nên nó không phải "bản dịch một nửa" mà là **chưa có
 * bản dịch**.
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

    const existing = await tx.section.findMany({ where: link, select: { id: true } });
    const plan = planContentSave(sections, existing.map((row) => row.id));

    if (plan.foreignIds.length) {
      throw new Error(
        "Danh sách gửi lên có mục nội dung không thuộc trang này " +
          `(${plan.foreignIds.join(", ")}). Hãy tải lại trang soạn thảo rồi thử lại.`,
      );
    }

    if (plan.removedIds.length) {
      await tx.section.deleteMany({ where: { ...link, id: { in: plan.removedIds } } });
    }

    for (const planned of plan.items) {
      const section = planned.item;
      const row = planned.id
        ? await tx.section.update({
            where: { id: planned.id },
            data: { order: planned.order, anchor: section.anchor },
            select: { id: true },
          })
        : await tx.section.create({
            data: { ...link, order: planned.order, anchor: section.anchor },
            select: { id: true },
          });

      if (planned.translated) {
        await tx.sectionTranslation.upsert({
          where: { sectionId_locale: { sectionId: row.id, locale } },
          create: { sectionId: row.id, locale, title: section.title.trim(), body: section.body },
          update: { title: section.title.trim(), body: section.body },
        });
      } else {
        await tx.sectionTranslation.deleteMany({ where: { sectionId: row.id, locale } });
      }
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

/**
 * Ghi khối không theo ngôn ngữ của một trang tài liệu, cộng bản dịch của `locale`.
 *
 * `title` rỗng theo đúng quy ước của `saveFeatures`/`saveSections`: ngôn ngữ đó
 * chưa có bản dịch, nên bản dịch của nó được gỡ và các ngôn ngữ khác giữ nguyên.
 * Trang không còn bản dịch nào ở ngôn ngữ mặc định sẽ không hiện trên site công
 * khai (`resolveTranslation` trả `null`) — đó là hiện trạng đúng, không phải lỗi.
 */
export async function saveDocPage(input: SaveDocPageInput): Promise<SavedDocPage> {
  const { id, locale, title, description, ...general } = input;

  const data = {
    slug: general.slug,
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

        if (title.trim() === "") {
          await tx.docPageTranslation.deleteMany({ where: { docPageId: page.id, locale } });
        } else {
          await tx.docPageTranslation.upsert({
            where: { docPageId_locale: { docPageId: page.id, locale } },
            create: {
              docPageId: page.id,
              locale,
              title: title.trim(),
              description: description ?? null,
            },
            update: { title: title.trim(), description: description ?? null },
          });
        }

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

/**
 * Đặt một ngôn ngữ làm mặc định.
 *
 * Mặc định là đích của toàn bộ cơ chế fallback, nên hai điều kiện phải đúng cùng
 * lúc và cùng nằm trong một transaction: đúng **một** dòng `isDefault`, và dòng
 * đó đang **bật**. `assertSingleDefaultLocale` kiểm cả hai ngay trước khi cam kết
 * — hỏng thì transaction cuộn lại và DB không bao giờ ở trạng thái sai.
 *
 * Ngôn ngữ đang tắt bị từ chối thẳng thay vì tự bật giúp: tự bật là làm hai việc
 * người dùng chỉ yêu cầu một, mà việc thứ hai thì đổi cả site công khai.
 */
export async function setDefaultLocale(code: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.locale.findUnique({
      where: { code },
      select: { code: true, enabled: true, isDefault: true },
    });
    if (!target) throw new Error(`Không tìm thấy ngôn ngữ có mã "${code}".`);
    if (!target.enabled) {
      throw new Error(
        `Ngôn ngữ "${code}" đang tắt nên không đặt làm mặc định được. ` +
          "Bật nó lên trước, rồi đặt làm mặc định.",
      );
    }
    if (target.isDefault) return; // Đã là mặc định: không ghi gì, không lỗi gì.

    // Hạ mọi mặc định cũ trước khi dựng mặc định mới: làm ngược thứ tự sẽ có một
    // khoảnh khắc hai dòng cùng `isDefault`.
    await tx.locale.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await tx.locale.update({ where: { code }, data: { isDefault: true } });

    const rows = await tx.locale.findMany({
      select: { code: true, isDefault: true, enabled: true },
    });
    assertSingleDefaultLocale(rows);
  });

  // Đổi mặc định là đổi đích fallback của **mọi** trang ở **mọi** ngôn ngữ, nên
  // ba tag cache theo locale đều phải hết hạn. Định tuyến thì vẫn cần một lần
  // redeploy: `locales.generated.ts` mang `defaultLocale` cho middleware (§9.3).
  revalidate(tags.nav());
  revalidate(tags.appsList());
  revalidate(tags.searchIndex());
}

/**
 * Sắp lại thứ tự ngôn ngữ. `codes` là danh sách **đầy đủ** theo đúng thứ tự mới;
 * `order` lấy từ vị trí trong mảng, cùng quy ước `reorderApps` và `saveFeatures`.
 *
 * Nhận **mã** chứ không nhận id: khoá chính của `Locale` là `code`. Bảng này
 * không có cột `id` nào để nhầm.
 *
 * Kiểm đủ số lượng trước khi ghi, cùng lý do `reorderApps`: gửi lên thiếu một mã
 * nghĩa là bảng phía trình duyệt đã cũ, và ghi tiếp sẽ để lại hai ngôn ngữ cùng
 * `order` — mà `order` trùng thì thứ tự rơi về `code` chứ không phải thứ tự người
 * vận hành vừa xếp.
 *
 * Thứ tự **không** đụng tới bất biến "đúng một mặc định và nó đang bật": hàm này
 * không ghi `isDefault` lẫn `enabled`, và vị trí trong danh sách không mang ý
 * nghĩa nào với cơ chế fallback. Vẫn gọi `assertSingleDefaultLocale` trước khi
 * cam kết, cùng lối `setLocaleEnabled`: quy tắc ở đây là **mọi** lượt ghi vào
 * bảng `Locale` đều rời transaction với bảng ở trạng thái hợp lệ, chứ không phải
 * "lượt ghi nào có khả năng phá thì mới kiểm" — quy tắc thứ hai đòi người viết
 * hàm ghi tiếp theo phải tự nhận ra mình thuộc loại nào.
 */
export async function reorderLocales(codes: string[]): Promise<void> {
  const unique = new Set(codes);
  if (unique.size !== codes.length) {
    throw new Error("Danh sách thứ tự có ngôn ngữ bị lặp. Hãy tải lại trang rồi thử lại.");
  }

  await prisma.$transaction(async (tx) => {
    const rows = await tx.locale.findMany({
      select: { code: true, isDefault: true, enabled: true },
    });

    if (rows.length !== codes.length) {
      throw new Error(
        `Danh sách thứ tự có ${codes.length} ngôn ngữ nhưng cơ sở dữ liệu có ${rows.length}. ` +
          "Có người vừa thêm hoặc xoá ngôn ngữ — hãy tải lại trang rồi sắp lại.",
      );
    }

    const known = new Set(rows.map((row) => row.code));
    const unknown = codes.filter((code) => !known.has(code));
    if (unknown.length > 0) {
      throw new Error(
        `Danh sách thứ tự có ngôn ngữ không tồn tại (${unknown.join(", ")}). ` +
          "Hãy tải lại trang rồi thử lại.",
      );
    }

    for (const [index, code] of codes.entries()) {
      await tx.locale.update({ where: { code }, data: { order: index } });
    }

    assertSingleDefaultLocale(rows);
  });

  // Ba tag y như `setLocaleEnabled`. Hôm nay **chưa** tag nào phụ thuộc vào thứ
  // tự ngôn ngữ — chỗ thứ tự này hiện ra là nút chuyển ngôn ngữ, mà nút đó đọc
  // `locales.generated.ts` sinh lúc prebuild, nên nó đổi ở lần deploy kế tiếp
  // chứ không đổi vì một lượt revalidate. Vẫn làm mới cả ba vì thiếu một tag là
  // lỗi im lặng không có gì để lần, còn thừa một tag chỉ tốn một lượt dựng lại
  // — cùng cân nhắc đã ghi ở `revalidateNav`.
  revalidate(tags.nav());
  revalidate(tags.appsList());
  revalidate(tags.searchIndex());
}

// ---------------------------------------------------------------------------
// Cây điều hướng
// ---------------------------------------------------------------------------

/**
 * Cửa hẹp của một transaction, đủ cho mọi hàm ghi cây. Khai bằng `Pick` chứ không
 * import kiểu `TransactionClient` của Prisma, cùng lối `resolveSectionOwner`.
 */
type NavTxClient = Pick<typeof prisma, "navNode" | "navNodeTranslation" | "locale">;

/** Nhãn của một nút chứa ở một ngôn ngữ. Chuỗi rỗng nghĩa là gỡ nhãn của ngôn ngữ đó. */
export type NavNodeLabelInput = { locale: string; label: string };

export type CreateNavNodeInput = {
  parentId?: string | null;
  kind: NavKind;
  status?: Status;
  appId?: string | null;
  docPageId?: string | null;
  labels?: NavNodeLabelInput[];
  /** Vị trí trong danh sách anh em; vắng mặt là thêm vào cuối. */
  index?: number;
};

export type UpdateNavNodeInput = {
  id: string;
  status?: Status;
  labels?: NavNodeLabelInput[];
  /** Đổi ứng dụng nút trỏ tới. `null` biến nút thành nút chứa. */
  appId?: string | null;
  /** Đổi trang tài liệu nút trỏ tới. `null` biến nút thành nút chứa. */
  docPageId?: string | null;
};

export type MoveNavNodeInput = { id: string; parentId: string | null; index: number };

export type ReorderSiblingsInput = { parentId: string | null; ids: string[] };

/**
 * Không trả kiểu `NavNode` của Prisma: tầng gọi vào đây (server action, trình
 * soạn) không được biết tới Prisma, và một kiểu sinh ra sẽ kéo cả `@prisma/client`
 * lên tới component.
 */
export type SavedNavNode = {
  id: string;
  parentId: string | null;
  order: number;
  kind: NavKind;
  status: Status;
};

/** `kind` và cột trỏ phải khớp — cùng ràng buộc mà CHECK `nav_node_kind_matches_target` ép. */
type NavTarget = { kind: NavKind; appId: string | null; docPageId: string | null };

const BOTH_TARGETS =
  "Một nút chỉ gắn được một thứ: hoặc một ứng dụng, hoặc một trang tài liệu. " +
  "Gắn cả hai thì không biết bấm vào nó sẽ mở trang nào.";

/**
 * Kiểm `kind` khớp cột trỏ **trước** khi ghi, để lỗi là câu tiếng Việt chứ không
 * phải thông báo vi phạm CHECK constraint của Postgres lọt ra tận giao diện.
 */
function navTargetFor(kind: NavKind, appId: string | null, docPageId: string | null): NavTarget {
  if (kind === "CONTAINER") {
    if (appId !== null || docPageId !== null) {
      throw new Error(
        "Nút chứa không mang nội dung — nó chỉ gom nhánh con và làm nhiệm vụ mở đóng (spec §3.2). " +
          'Muốn nhánh này có một trang giới thiệu thì thêm một nút DOC tên "Tổng quan" làm con đầu tiên.',
      );
    }
    return { kind, appId: null, docPageId: null };
  }

  if (kind === "APP") {
    if (docPageId !== null) throw new Error(BOTH_TARGETS);
    if (appId === null) {
      throw new Error(
        "Nút loại APP phải gắn một ứng dụng. Nút không gắn gì mà vẫn là lá thì hiện ra một " +
          "mục bấm vào không đi đâu cả — hãy chọn ứng dụng, hoặc đổi nút này thành nút chứa.",
      );
    }
    return { kind, appId, docPageId: null };
  }

  if (appId !== null) throw new Error(BOTH_TARGETS);
  if (docPageId === null) {
    throw new Error(
      "Nút loại DOC phải gắn một trang tài liệu. Nút không gắn gì mà vẫn là lá thì hiện ra một " +
        "mục bấm vào không đi đâu cả — hãy chọn trang, hoặc đổi nút này thành nút chứa.",
    );
  }
  return { kind, appId: null, docPageId };
}

/** Nút đích mới khi người dùng đổi nội dung nút trỏ tới; `null` là không đổi gì. */
function retargetFor(input: UpdateNavNodeInput): NavTarget | null {
  if (input.appId === undefined && input.docPageId === undefined) return null;

  const appId = input.appId ?? null;
  const docPageId = input.docPageId ?? null;
  const kind: NavKind = appId !== null ? "APP" : docPageId !== null ? "DOC" : "CONTAINER";

  return navTargetFor(kind, appId, docPageId);
}

/**
 * Đổi lỗi trùng khoá trên `appId`/`docPageId` thành câu tiếng Việt: bất biến I4.
 *
 * `@unique` là thứ *ép* I4, nhưng để `P2002` lọt ra giao diện thì người dùng chỉ
 * thấy một mã lỗi và không biết mình vừa làm gì sai — trong khi nguyên nhân thì
 * rất cụ thể: nội dung này đã nằm ở một nút khác.
 */
async function withFriendlyNavLinkError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? "");
    const what = target.includes("docPageId") ? "Trang tài liệu" : "Ứng dụng";

    throw new Error(
      `${what} này đã nằm ở một nút khác trong cây điều hướng. ` +
        "Mỗi ứng dụng và mỗi trang tài liệu chỉ được gắn vào đúng MỘT nút: gắn hai chỗ thì " +
        "nó hiện hai lần trong sidebar và chỉ mục tìm kiếm đếm đôi. " +
        "Hãy chuyển nút đang giữ nó sang chỗ mới thay vì tạo nút thứ hai.",
    );
  }
}

/**
 * Một nút gốc đã publish, ghép thêm vào danh sách chỉ để I6 không nổ trong lúc
 * cây còn đang được dựng. Xem `assertNavTreeValid`.
 */
const DRAFTING_SENTINEL: NavRow = {
  id: "__nut-goc-gia-dinh__",
  parentId: null,
  order: 0,
  status: "PUBLISHED",
  kind: "DOC",
  labels: [],
  href: "/",
};

/**
 * Kiểm bất biến trên trạng thái **sau** khi ghi, ngay trước lúc transaction cam kết.
 *
 * Kiểm sau chứ không kiểm trước: thứ phải hợp lệ là trạng thái sẽ tồn tại, và để
 * "kiểm trước" thì phải mô phỏng lại phép ghi trên một bản sao trong bộ nhớ — một
 * bản mô phỏng thứ hai sớm muộn cũng lệch khỏi phép ghi thật. Ném lỗi ở đây là
 * transaction cuộn lại, đúng lối `setLocaleEnabled` đã dùng cho locale mặc định.
 *
 * **I6 có một ngoại lệ, và nó là ngoại lệ bắt buộc.** Với cây chưa có nút gốc nào
 * publish, I6 khoá cứng cả hai đường: nút chứa rỗng không publish được (I2), mà lá
 * cũng không publish được khi chưa có nút gốc publish (I6) — không thao tác đơn lẻ
 * nào mở được cái khoá đó, kể cả thao tác đầu tiên trên một cây rỗng. Nên khi
 * trước lúc ghi *đã* không có cửa vào, ta ghép một nút gốc giả định vào danh sách
 * đem đi kiểm: I1, I2, I5 vẫn kiểm đủ, chỉ I6 được miễn. Cây đã có cửa vào thì I6
 * quay lại đầy đủ — không thao tác nào được phép xoá mất cái cửa cuối cùng.
 */
export function assertNavTreeValid(before: NavRow[], after: NavRow[], defaultLocale: string): void {
  const hasEntrance = before.some((row) => row.status === "PUBLISHED" && row.parentId === null);
  assertNavInvariants(hasEntrance ? after : [...after, DRAFTING_SENTINEL], defaultLocale);
}

/**
 * Khung chung của mọi hàm ghi cây: mở transaction, đọc trạng thái trước, chạy phép
 * ghi, đọc lại, kiểm bất biến.
 *
 * Gom vào một chỗ để "kiểm bất biến trước khi cam kết" là chuyện *cấu trúc* chứ
 * không phải chuyện từng hàm phải nhớ. Hàm ghi thứ sáu do người khác thêm vào sau
 * này cũng không có cách nào bỏ sót bước kiểm.
 */
async function writeNavTree<T>(
  write: (tx: NavTxClient, before: NavRow[], defaultLocale: string) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const defaultLocale = await loadDefaultLocale(tx);
    const before = await readNavRows(tx, defaultLocale);
    const result = await write(tx, before, defaultLocale);
    const after = await readNavRows(tx, defaultLocale);
    assertNavTreeValid(before, after, defaultLocale);
    return result;
  });
}

/**
 * Làm mới cache sau khi sửa cây.
 *
 * `alsoContent` cho hai tag còn lại: spec §6 đòi thêm `apps-list` và `search-index`
 * khi đổi trạng thái publish hoặc gắn/gỡ nội dung. Hôm nay hai tag đó chưa phụ
 * thuộc vào cây, nhưng thiếu một tag là lỗi im lặng không có gì để lần, còn thừa
 * một tag chỉ tốn một lượt dựng lại.
 */
function revalidateNav(options: { alsoContent?: boolean } = {}): void {
  revalidate(tags.nav());
  if (options.alsoContent) {
    revalidate(tags.appsList());
    revalidate(tags.searchIndex());
  }
}

/** Anh em cùng cha, sắp đúng thứ tự hiển thị. `order` trùng thì theo `id` như `buildNavTree`. */
function orderedSiblings(rows: NavRow[], parentId: string | null): NavRow[] {
  return rows
    .filter((row) => row.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Vị trí chèn hợp lệ trong một danh sách `length` phần tử (chèn được cả vào cuối). */
function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.min(Math.max(Math.trunc(index), 0), length);
}

/**
 * Ghi lại `order` thành 0..n-1 theo đúng thứ tự `ids`.
 *
 * `order` liên tục không phải chuyện thẩm mỹ: bộ nút thứ tự ở trình soạn tính
 * "lên một bậc" bằng chỉ số, nên một lỗ hổng trong dãy làm nút nhảy hai bậc.
 */
async function renumberSiblings(tx: NavTxClient, ids: string[]): Promise<void> {
  for (const [index, id] of ids.entries()) {
    await tx.navNode.update({ where: { id }, data: { order: index } });
  }
}

/** Ghi nhãn từng ngôn ngữ; nhãn rỗng gỡ đúng bản dịch đó và giữ nguyên các ngôn ngữ khác. */
async function writeNavLabels(
  tx: NavTxClient,
  nodeId: string,
  labels: NavNodeLabelInput[],
): Promise<void> {
  for (const { locale, label } of labels) {
    const value = label.trim();
    if (value === "") {
      await tx.navNodeTranslation.deleteMany({ where: { nodeId, locale } });
      continue;
    }
    await tx.navNodeTranslation.upsert({
      where: { nodeId_locale: { nodeId, locale } },
      create: { nodeId, locale, label: value },
      update: { label: value },
    });
  }
}

function navNodeNotFound(id: string): Error {
  return new Error(`Không tìm thấy nút điều hướng "${id}". Có thể nó vừa bị xoá.`);
}

/**
 * Đổi slug thành id cho hai cột trỏ của nút lá.
 *
 * Trình soạn ở trình duyệt chỉ biết slug: id là khoá nội bộ của DB, và đưa nó ra
 * tận HTML rồi nhận lại qua mạng là thêm một thứ phải kiểm mà không đổi lấy gì.
 * Tra ở đây vì tầng nội dung là nơi duy nhất chạm Prisma.
 *
 * Không tìm thấy thì ném lỗi chứ không lặng lẽ tạo một nút không gắn gì —
 * `navTargetFor` sẽ chặn nút đó, nhưng thông điệp lúc ấy nói về `kind`, không nói
 * về cái slug mà người dùng vừa chọn.
 */
export async function navTargetIds(input: {
  appSlug?: string;
  docSlug?: string;
}): Promise<{ appId?: string; docPageId?: string }> {
  if (input.appSlug !== undefined) {
    const app = await prisma.app.findUnique({
      where: { slug: input.appSlug },
      select: { id: true },
    });
    if (!app) {
      throw new Error(
        `Không tìm thấy ứng dụng có slug "${input.appSlug}". ` +
          "Có thể nó vừa bị xoá hoặc vừa đổi slug — hãy tải lại trang rồi chọn lại.",
      );
    }
    return { appId: app.id };
  }

  if (input.docSlug !== undefined) {
    const doc = await prisma.docPage.findUnique({
      where: { slug: input.docSlug },
      select: { id: true },
    });
    if (!doc) {
      throw new Error(
        `Không tìm thấy trang tài liệu có slug "${input.docSlug}". ` +
          "Có thể nó vừa bị xoá hoặc vừa đổi slug — hãy tải lại trang rồi chọn lại.",
      );
    }
    return { docPageId: doc.id };
  }

  return {};
}

/** Thêm một nút vào cây. Vắng `index` thì nút mới nằm cuối danh sách anh em. */
export async function createNavNode(input: CreateNavNodeInput): Promise<SavedNavNode> {
  const target = navTargetFor(input.kind, input.appId ?? null, input.docPageId ?? null);
  const parentId = input.parentId ?? null;
  const status: Status = input.status ?? "DRAFT";

  const node = await withFriendlyNavLinkError(() =>
    writeNavTree(async (tx, before) => {
      if (parentId !== null && !before.some((row) => row.id === parentId)) {
        throw navNodeNotFound(parentId);
      }

      const siblings = orderedSiblings(before, parentId).map((row) => row.id);
      const position = clampIndex(input.index ?? siblings.length, siblings.length);

      const created = await tx.navNode.create({
        data: { parentId, status, order: position, ...target },
        select: { id: true },
      });

      siblings.splice(position, 0, created.id);
      await renumberSiblings(tx, siblings);

      if (input.labels?.length) await writeNavLabels(tx, created.id, input.labels);

      return { id: created.id, parentId, order: position, kind: target.kind, status };
    }),
  );

  revalidateNav({ alsoContent: true });
  return node;
}

/**
 * Sửa trạng thái, nhãn hoặc nội dung một nút đã có.
 *
 * Đổi `appId`/`docPageId` cũng đổi `kind` theo — hai thứ đó phải khớp nhau, và bắt
 * người dùng gửi lên cả hai chỉ để chúng khớp là mời gọi trạng thái sai.
 */
export async function updateNavNode(input: UpdateNavNodeInput): Promise<SavedNavNode> {
  const target = retargetFor(input);

  const node = await withFriendlyNavLinkError(() =>
    writeNavTree(async (tx, before) => {
      if (!before.some((row) => row.id === input.id)) throw navNodeNotFound(input.id);

      const updated = await tx.navNode.update({
        where: { id: input.id },
        data: { ...(input.status ? { status: input.status } : {}), ...(target ?? {}) },
        select: { id: true, parentId: true, order: true, kind: true, status: true },
      });

      if (input.labels?.length) await writeNavLabels(tx, input.id, input.labels);

      return updated;
    }),
  );

  revalidateNav({ alsoContent: Boolean(input.status) || target !== null });
  return node;
}

/**
 * Xoá một nút. Chỉ xoá được nút không còn con.
 *
 * `onDelete: Restrict` trên quan hệ tự tham chiếu đã chặn ở tầng DB, nhưng chặn ở
 * đây trước để người dùng đọc được câu giải thích thay vì một mã lỗi Prisma.
 */
export async function deleteNavNode(id: string): Promise<void> {
  const removed = await writeNavTree(async (tx, before) => {
    const node = before.find((row) => row.id === id);
    if (!node) throw navNodeNotFound(id);

    const children = before.filter((row) => row.parentId === id);
    if (children.length > 0) {
      throw new Error(
        `Nút này còn ${children.length} nút con nên chưa xoá được. ` +
          "Xoá cha trước sẽ làm cả nhánh con mất đường vào trong khi nội dung vẫn nằm nguyên " +
          "trong cơ sở dữ liệu — không ai kịp nhận ra. Hãy chuyển hoặc xoá từng nút con trước.",
      );
    }

    await tx.navNode.delete({ where: { id } });

    const siblings = orderedSiblings(before, node.parentId)
      .filter((row) => row.id !== id)
      .map((row) => row.id);
    await renumberSiblings(tx, siblings);

    return node;
  });

  revalidateNav({ alsoContent: removed.kind !== "CONTAINER" });
}

/**
 * Đổi cha và vị trí của một nút trong đúng một thao tác.
 *
 * `index` là vị trí **sau khi** nút đã rời chỗ cũ, nên kéo một nút xuống trong
 * cùng một nhóm anh em không bị lệch một bậc. Sau khi chèn, cả danh sách anh em ở
 * chỗ mới **và** chỗ cũ đều được đánh số lại 0..n-1.
 */
export async function moveNavNode(input: MoveNavNodeInput): Promise<void> {
  await writeNavTree(async (tx, before) => {
    const node = before.find((row) => row.id === input.id);
    if (!node) throw navNodeNotFound(input.id);

    if (input.parentId !== null && !before.some((row) => row.id === input.parentId)) {
      throw navNodeNotFound(input.parentId);
    }

    if (wouldCreateCycle(before, input.id, input.parentId)) {
      throw new Error(
        "Không đưa một nút vào bên trong chính hậu duệ của nó được — cây sẽ có chu trình, " +
          "và cả nhánh đó biến mất khỏi điều hướng dù dữ liệu vẫn còn. " +
          "Hãy chuyển nhánh con ra ngoài trước, rồi mới chuyển nút này.",
      );
    }

    const siblings = orderedSiblings(before, input.parentId)
      .filter((row) => row.id !== input.id)
      .map((row) => row.id);
    const position = clampIndex(input.index, siblings.length);
    siblings.splice(position, 0, input.id);

    await tx.navNode.update({
      where: { id: input.id },
      data: { parentId: input.parentId, order: position },
    });
    await renumberSiblings(tx, siblings);

    // Chỗ cũ giờ hụt một nút: vá lại dãy để "lên một bậc" ở đó vẫn đúng một bậc.
    if (node.parentId !== input.parentId) {
      await renumberSiblings(
        tx,
        orderedSiblings(before, node.parentId)
          .filter((row) => row.id !== input.id)
          .map((row) => row.id),
      );
    }
  });

  revalidateNav();
}

/**
 * Sắp lại thứ tự anh em cùng cha. `ids` là danh sách **đầy đủ** theo thứ tự mới.
 *
 * Kiểm đủ số lượng trước khi ghi, cùng lý do `reorderApps`: gửi lên thiếu một id
 * nghĩa là cây phía trình duyệt đã cũ, và ghi tiếp sẽ để lại hai nút cùng `order`.
 */
export async function reorderSiblings(input: ReorderSiblingsInput): Promise<void> {
  const unique = new Set(input.ids);
  if (unique.size !== input.ids.length) {
    throw new Error("Danh sách thứ tự có nút bị lặp. Hãy tải lại trang rồi thử lại.");
  }

  await writeNavTree(async (tx, before) => {
    const current = orderedSiblings(before, input.parentId).map((row) => row.id);
    if (current.length !== input.ids.length || current.some((id) => !unique.has(id))) {
      throw new Error(
        `Danh sách thứ tự có ${input.ids.length} nút nhưng nút cha đang có ${current.length}. ` +
          "Có người vừa thêm hoặc xoá nút — hãy tải lại trang rồi sắp lại.",
      );
    }

    await renumberSiblings(tx, input.ids);
  });

  revalidateNav();
}

// ---------------------------------------------------------------------------
// Xoá nội dung: chốt lỗ hổng I2 của cascade
// ---------------------------------------------------------------------------

/** Một nút chứa vừa bị hạ xuống nháp. `label` là nhãn ở locale mặc định, `null` nếu chưa có. */
export type DemotedContainer = { id: string; label: string | null };

export type DeletedContent = {
  slug: string;
  /**
   * Nút chứa vừa bị hạ xuống nháp vì cascade lấy mất con publish cuối cùng của nó.
   * Rỗng là chuyện thường; không rỗng thì giao diện **phải** nói ra.
   */
  demotedContainers: DemotedContainer[];
};

/**
 * Đi **lên** theo chuỗi cha, hạ mọi nút chứa vừa thành rỗng xuống nháp.
 *
 * Đi lên chứ không chỉ xét đúng một cha: hạ một nút chứa xuống nháp có thể làm
 * chính cha nó không còn con publish nào, nên dừng ở tầng đầu tiên là để lại đúng
 * cái container rỗng đã publish mà I2 cấm — chỉ lùi lên một bậc. Vòng lặp dừng
 * ngay khi gặp một nút vẫn còn con publish, nên nó không đi xa hơn mức cần.
 */
async function demoteEmptyContainers(
  tx: NavTxClient,
  startId: string | null,
  defaultLocale: string,
): Promise<DemotedContainer[]> {
  const demoted: DemotedContainer[] = [];
  let currentId = startId;

  while (currentId !== null) {
    const node = await tx.navNode.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        parentId: true,
        kind: true,
        status: true,
        translations: { select: { locale: true, label: true } },
      },
    });
    if (!node || node.kind !== "CONTAINER" || node.status !== "PUBLISHED") break;

    const publishedChildren = await tx.navNode.count({
      where: { parentId: node.id, status: "PUBLISHED" },
    });
    if (publishedChildren > 0) break;

    await tx.navNode.update({ where: { id: node.id }, data: { status: "DRAFT" } });

    const label = resolveTranslation(node.translations, defaultLocale, defaultLocale);
    demoted.push({ id: node.id, label: label?.value.label ?? null });

    currentId = node.parentId;
  }

  return demoted;
}

/**
 * Xoá một App hoặc một DocPage, rồi vá lại cây.
 *
 * **Đây là lỗ hổng của I2 mà spec §4 đòi bịt riêng.** `NavNode.app` và
 * `NavNode.docPage` dùng `onDelete: Cascade`, nên xoá nội dung sẽ xoá nút lá của
 * nó ở tầng DB — không đi qua `writeNavTree`, không qua `assertNavInvariants`,
 * không qua bất cứ dòng TypeScript nào. Nếu đó là con publish cuối cùng của một
 * nút chứa đang publish thì ta còn lại đúng thứ I2 cấm: một nút chứa rỗng đã
 * publish, bấm vào chẳng xổ ra gì.
 *
 * Nên ở đây ta **sửa** thay vì **chặn**: hạ nút chứa xuống nháp và trả danh sách
 * đã hạ để giao diện nói ra. Chặn là sai — người dùng yêu cầu xoá một ứng dụng, và
 * từ chối vì hình dạng cây sẽ buộc họ đi tháo cây trước, trong khi việc tháo cây là
 * thứ ta vừa làm hộ được. Cũng vì vậy hàm này **không** gọi `assertNavTreeValid`:
 * xoá nội dung có thể làm mất nút gốc publish cuối cùng (I6), mà chặn thì lại rơi
 * đúng vào cái bẫy vừa nói.
 */
async function deleteContentAndRepairTree(
  what: "app" | "docPage",
  id: string,
): Promise<DeletedContent> {
  return prisma.$transaction(async (tx) => {
    const defaultLocale = await loadDefaultLocale(tx);

    const node = await tx.navNode.findUnique({
      where: what === "app" ? { appId: id } : { docPageId: id },
      select: { id: true, parentId: true, _count: { select: { children: true } } },
    });

    // I1 cấm nút lá có con, nhưng nếu dữ liệu đã sai thì cascade sẽ đụng
    // `onDelete: Restrict` của quan hệ tự tham chiếu và ném ra một lỗi Prisma thô.
    if (node && node._count.children > 0) {
      throw new Error(
        "Nút điều hướng của nội dung này đang có nút con, nên xoá nội dung sẽ làm cả nhánh con " +
          "mất cha. Ứng dụng và trang tài liệu lẽ ra luôn là lá — hãy chuyển các nút con sang một " +
          "nút chứa trước, rồi xoá lại.",
      );
    }

    const found =
      what === "app"
        ? await tx.app.findUnique({ where: { id }, select: { slug: true } })
        : await tx.docPage.findUnique({ where: { id }, select: { slug: true } });

    if (!found) {
      throw new Error(
        what === "app"
          ? "Không tìm thấy ứng dụng cần xoá. Có thể nó vừa bị xoá."
          : "Không tìm thấy trang tài liệu cần xoá. Có thể nó vừa bị xoá.",
      );
    }

    if (what === "app") await tx.app.delete({ where: { id } });
    else await tx.docPage.delete({ where: { id } });

    // Nút lá vừa bị cascade lấy đi; giờ mới đọc lại cha của nó.
    const demotedContainers = await demoteEmptyContainers(
      tx,
      node?.parentId ?? null,
      defaultLocale,
    );

    return { slug: found.slug, demotedContainers };
  });
}

/** Xoá một ứng dụng cùng toàn bộ nội dung của nó, rồi vá cây theo I2. */
export async function deleteApp(id: string): Promise<DeletedContent> {
  const result = await deleteContentAndRepairTree("app", id);

  revalidateApp(result.slug);
  revalidate(tags.appsList());
  revalidate(tags.nav());

  return result;
}

/** Xoá một trang tài liệu cùng toàn bộ nội dung của nó, rồi vá cây theo I2. */
export async function deleteDocPage(id: string): Promise<DeletedContent> {
  const result = await deleteContentAndRepairTree("docPage", id);

  revalidateDoc(result.slug);
  revalidate(tags.nav());

  return result;
}
