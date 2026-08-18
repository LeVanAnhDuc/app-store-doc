import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppHero } from "@/components/docs/AppHero";
import { DocsShell } from "@/components/docs/DocsShell";
import { FeatureGrid } from "@/components/docs/FeatureGrid";
import { SectionBody } from "@/components/docs/SectionBody";
import { Sidebar } from "@/components/docs/Sidebar";
import { Toc } from "@/components/docs/Toc";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { findTrail } from "@/server/content/nav";
import { getApp, getNavTree, getStaticSlugs } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * Trang một ứng dụng — ba cột theo mockup màn 02.
 *
 * Nội dung (tính năng, các mục) do CMS sinh; thứ tự trong trang là thứ tự đã
 * kéo thả trong trang quản trị, nên ở đây chỉ đổ ra chứ không sắp lại.
 */

type PageParams = { params: Promise<{ locale: string; slug: string }> };

/**
 * `getStaticSlugs()` trả `{apps:[],docs:[]}` khi chưa có `DATABASE_URL`, nên
 * `next build` vẫn chạy. **`dynamicParams` để mặc định `true`**: ứng dụng mới
 * tạo trong CMS có trang ngay mà không cần deploy lại.
 */
export async function generateStaticParams() {
  const { apps } = await getStaticSlugs();
  return locales.flatMap((locale) => apps.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const [t, app] = await Promise.all([getTranslations({ locale }), getApp(slug, locale)]);

  if (!app) return { title: `${t("notFound.title")} — ${t("brand.name")}` };

  return {
    title: `${app.name} — ${t("brand.name")}`,
    description: app.tagline ?? app.summary ?? undefined,
    alternates: {
      // Canonical trỏ chính nó; `languages` phát đủ locale đang bật cộng
      // `x-default` trỏ locale mặc định.
      canonical: `/${locale}/apps/${slug}`,
      languages: {
        ...Object.fromEntries(locales.map((code) => [code, `/${code}/apps/${slug}`])),
        "x-default": `/${defaultLocale}/apps/${slug}`,
      },
    },
  };
}

export default async function AppPage({ params }: PageParams) {
  const { locale, slug } = await params;
  // Thiếu dòng này trang rơi về kết xuất động (ghi chú bàn giao của Task 12).
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  // Không có, chưa publish, hoặc không có bản dịch nào — cả ba đều là 404.
  const app = await getApp(slug, locale);
  if (!app) notFound();

  const currentHref = `/${locale}/apps/${slug}`;

  /**
   * Cột trái là **con cháu của tab đang mở**, không phải một danh sách tự gộp.
   *
   * Trước đây trang này tự dựng hai nhóm "Lõi" và "Ứng dụng vệ tinh" từ
   * `App.kind`, cộng thêm các nhóm tài liệu — tức là cấu trúc điều hướng nằm
   * trong mã chứ không trong CMS. Giờ `findTrail` cho biết trang này nằm ở nhánh
   * nào, và sidebar chỉ là nhánh đó.
   *
   * Trang chưa được gắn vào cây thì `trail` rỗng: không có sidebar, nhưng trang
   * vẫn mở được bằng URL (spec §5).
   */
  const trail = findTrail(await getNavTree(locale), currentHref);
  const sidebarNodes = trail[0]?.children ?? [];

  const statusLabels = {
    core: t("status.core"),
    connected: t("status.connected"),
    planned: t("status.planned"),
    standalone: t("status.standalone"),
    private: t("status.private"),
  };

  /**
   * Nhãn trên tiêu đề là đường đi trong cây, ví dụ "Ứng dụng · Lõi" (mockup v3
   * mục 02) — nó nói cho người đọc biết mình đang ở đâu trong điều hướng. Bỏ
   * phần tử cuối vì đó chính là trang đang mở. Trang chưa gắn vào cây thì lùi về
   * tên chung của khu vực.
   */
  const crumb =
    trail.length > 1
      ? trail
          .slice(0, -1)
          .map((node) => node.label)
          .join(" · ")
      : t("nav.apps");

  const fallbackLabel = t("fallback.notice");

  return (
    <DocsShell
      sidebar={
        // `undefined` chứ không phải một `Sidebar` rỗng: `DocsShell` chừa cột theo
        // việc prop có tồn tại hay không, nên truyền phần tử tự render `null` vào
        // đây thì lưới vẫn giữ một dải trống 208px bên trái.
        sidebarNodes.length > 0 ? (
          <Sidebar nodes={sidebarNodes} activeHref={currentHref} label={t("sidebar.label")} />
        ) : undefined
      }
      toc={
        app.toc.length > 0 ? <Toc items={app.toc} title={t("toc.title")} /> : undefined
      }
      main={
        <article className={styles.main}>
          <AppHero
            app={app}
            locale={locale}
            crumb={crumb}
            labels={{
              status: statusLabels[app.integration],
              privateRepo: t("app.privateRepo"),
              repo: t("app.viewRepo"),
              apiRepo: t("app.viewApiRepo"),
              demo: t("app.viewDemo"),
              fallback: fallbackLabel,
            }}
          />

          <FeatureGrid
            features={app.features}
            title={t("app.features")}
            locale={locale}
            fallbackLabel={fallbackLabel}
          />

          {app.sections.map((section) => (
            <SectionBody
              key={section.id}
              section={section}
              locale={locale}
              labels={{
                fallback: fallbackLabel,
                code: t("a11y.codeBlock"),
                table: t("a11y.table"),
                permalink: t("section.permalink", { title: section.title }),
              }}
            />
          ))}
        </article>
      }
    />
  );
}
