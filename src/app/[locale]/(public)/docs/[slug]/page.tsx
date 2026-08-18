import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocsShell } from "@/components/docs/DocsShell";
import { FallbackNotice } from "@/components/docs/FallbackNotice";
import { SectionBody } from "@/components/docs/SectionBody";
import { Sidebar, type SidebarGroup } from "@/components/docs/Sidebar";
import { Toc } from "@/components/docs/Toc";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { LANDING_DOC_SLUG, getDocPage, getStaticSlugs, listNav } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * Trang hướng dẫn — ba cột theo mockup màn 03.
 *
 * Cùng khung với trang ứng dụng, khác ở chỗ không có khối tính năng và cột trái
 * chỉ gồm các nhóm tài liệu.
 */

type PageParams = { params: Promise<{ locale: string; slug: string }> };

/**
 * `getStaticSlugs()` đã loại `home` (trang chủ render bằng chính `DocPage` đó),
 * và trả rỗng khi chưa có `DATABASE_URL` để `next build` vẫn chạy.
 * `dynamicParams` để mặc định `true`: trang mới tạo trong CMS có ngay.
 */
export async function generateStaticParams() {
  const { docs } = await getStaticSlugs();
  return locales.flatMap((locale) => docs.map((slug) => ({ locale, slug })));
}

/** Trang chủ đã dùng `DocPage(slug="home")`; mở nó lần nữa ở đây là trùng nội dung. */
function isReservedSlug(slug: string): boolean {
  return slug === LANDING_DOC_SLUG;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale });
  const page = isReservedSlug(slug) ? null : await getDocPage(slug, locale);

  if (!page) return { title: `${t("notFound.title")} — ${t("brand.name")}` };

  return {
    title: `${page.title} — ${t("brand.name")}`,
    description: page.description ?? undefined,
    alternates: {
      // Canonical trỏ chính nó; `languages` phát đủ locale đang bật cộng
      // `x-default` trỏ locale mặc định.
      canonical: `/${locale}/docs/${slug}`,
      languages: {
        ...Object.fromEntries(locales.map((code) => [code, `/${code}/docs/${slug}`])),
        "x-default": `/${defaultLocale}/docs/${slug}`,
      },
    },
  };
}

export default async function DocPage({ params }: PageParams) {
  const { locale, slug } = await params;
  // Thiếu dòng này trang rơi về kết xuất động (ghi chú bàn giao của Task 12).
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  if (isReservedSlug(slug)) notFound();

  const page = await getDocPage(slug, locale);
  if (!page) notFound();

  const nav = await listNav(locale);

  const groups: SidebarGroup[] = nav.map((group, index) => ({
    key: `doc-${group.group ?? index}`,
    label: group.group ?? t("doc.guides"),
    items: group.items.map((item) => ({
      key: item.slug,
      href: item.href,
      label: item.title,
    })),
  }));

  const fallbackLabel = t("fallback.notice");

  return (
    <DocsShell
      sidebar={
        <Sidebar
          groups={groups}
          currentHref={`/${locale}/docs/${slug}`}
          label={t("sidebar.label")}
        />
      }
      toc={
        page.toc.length > 0 ? <Toc items={page.toc} title={t("toc.title")} /> : undefined
      }
      main={
        <article className={styles.main}>
          <header className={styles.head}>
            <p className={styles.crumb}>{t("doc.guides")}</p>
            <h1 className={styles.title}>{page.title}</h1>
            <FallbackNotice
              shownLocale={page.locale}
              wantedLocale={locale}
              label={fallbackLabel}
            />
            {page.description ? <p className={styles.lede}>{page.description}</p> : null}
          </header>

          {page.sections.map((section) => (
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
