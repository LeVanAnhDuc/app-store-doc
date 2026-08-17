import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppHero } from "@/components/docs/AppHero";
import { DocsShell } from "@/components/docs/DocsShell";
import { FeatureGrid } from "@/components/docs/FeatureGrid";
import { SectionBody } from "@/components/docs/SectionBody";
import { Sidebar, type SidebarGroup } from "@/components/docs/Sidebar";
import { Toc } from "@/components/docs/Toc";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { getApp, getStaticSlugs, listApps, listNav } from "@/server/content/queries";
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

  const [apps, nav] = await Promise.all([listApps(locale), listNav(locale)]);

  const statusLabels = {
    core: t("status.core"),
    connected: t("status.connected"),
    planned: t("status.planned"),
    standalone: t("status.standalone"),
    private: t("status.private"),
  };

  // Cột trái gộp ba nguồn: ứng dụng lõi, ứng dụng vệ tinh, rồi các nhóm tài
  // liệu — đúng thứ tự của mockup màn 02.
  const groups: SidebarGroup[] = [
    {
      key: "core",
      label: t("sidebar.core"),
      items: apps
        .filter((item) => item.kind === "CORE")
        .map((item) => ({
          key: item.slug,
          href: `/${locale}/apps/${item.slug}`,
          label: item.name,
        })),
    },
    {
      key: "satellites",
      label: t("sidebar.satellites"),
      items: apps
        .filter((item) => item.kind !== "CORE")
        .map((item) => ({
          key: item.slug,
          href: `/${locale}/apps/${item.slug}`,
          label: item.name,
        })),
    },
    ...nav.map((group, index) => ({
      key: `doc-${group.group ?? index}`,
      label: group.group ?? t("doc.guides"),
      items: group.items.map((item) => ({
        key: item.slug,
        href: item.href,
        label: item.title,
      })),
    })),
  ];

  const fallbackLabel = t("fallback.notice");

  return (
    <DocsShell
      sidebar={
        <Sidebar
          groups={groups}
          currentHref={`/${locale}/apps/${slug}`}
          label={t("sidebar.label")}
        />
      }
      toc={
        app.toc.length > 0 ? <Toc items={app.toc} title={t("toc.title")} /> : undefined
      }
      main={
        <article className={styles.main}>
          <AppHero
            app={app}
            locale={locale}
            crumb={`${t("nav.apps")} / ${statusLabels[app.integration]}`}
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
