import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DocsShell } from "@/components/docs/DocsShell";
import { FallbackNotice } from "@/components/docs/FallbackNotice";
import { SectionBody } from "@/components/docs/SectionBody";
import { Sidebar } from "@/components/docs/Sidebar";
import { Toc } from "@/components/docs/Toc";
import { defaultLocale, locales } from "@/i18n/locales.generated";
import { findTrail } from "@/server/content/nav";
import { LANDING_DOC_SLUG, getDocPage, getNavTree, getStaticSlugs } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * Trang hướng dẫn — ba cột theo mockup màn 03.
 *
 * Cùng khung với trang ứng dụng, khác ở chỗ không có khối tính năng. Cột trái
 * dựng từ đúng cây điều hướng đó, nên một bài hướng dẫn nằm cạnh ứng dụng trong
 * cùng một nhánh vẫn hiện đúng chỗ.
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

  const currentHref = `/${locale}/docs/${slug}`;

  // Cột trái là con cháu của tab đang mở, đúng như trang ứng dụng — cùng một cây,
  // cùng một cách dựng. Bài chưa gắn vào cây thì không có cột trái.
  const trail = findTrail(await getNavTree(locale), currentHref);
  const sidebarNodes = trail[0]?.children ?? [];

  // "Hướng dẫn · Tích hợp" — đường đi trong cây, bỏ phần tử cuối vì đó là bài này.
  const crumb =
    trail.length > 1
      ? trail
          .slice(0, -1)
          .map((node) => node.label)
          .join(" · ")
      : t("doc.guides");

  const fallbackLabel = t("fallback.notice");

  return (
    <DocsShell
      sidebar={
        // `undefined` chứ không phải một `Sidebar` rỗng — xem chú thích ở trang ứng dụng.
        sidebarNodes.length > 0 ? (
          <Sidebar nodes={sidebarNodes} activeHref={currentHref} label={t("sidebar.label")} />
        ) : undefined
      }
      toc={
        page.toc.length > 0 ? <Toc items={page.toc} title={t("toc.title")} /> : undefined
      }
      main={
        <article className={styles.main}>
          <header className={styles.head}>
            <p className={styles.crumb}>{crumb}</p>
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
