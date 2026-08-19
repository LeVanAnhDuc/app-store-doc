import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppHero } from "@/components/docs/AppHero";
import { DocsShell } from "@/components/docs/DocsShell";
import { FeatureGrid } from "@/components/docs/FeatureGrid";
import { NavDrawer } from "@/components/docs/NavDrawer";
import { SectionBody } from "@/components/docs/SectionBody";
import { Sidebar } from "@/components/docs/Sidebar";
import { Toc } from "@/components/docs/Toc";
import { Callout } from "@/components/ui/Callout";
import { locales } from "@/i18n/locales.generated";
import { requireAdmin } from "@/server/auth";
import { findTrail } from "@/server/content/nav";
import { getApp, getNavTree } from "@/server/content/queries";
import styles from "./page.module.css";

/**
 * `/[locale]/apps/[slug]/preview?token=…` — xem thử bản nháp (spec §8.4).
 *
 * **Đây là một page, không phải route handler.** Bản trước là route handler, nên
 * nó không kết xuất được React Server Component và phải tự ghép HTML bằng màu hệ
 * thống của trình duyệt. Kết quả là người soạn bấm "Xem thử" rồi thấy một tài liệu
 * trông không giống trang công khai ở bất kỳ điểm nào — tức là nó xem thử một thứ
 * khác. Ở đây trang dùng lại **đúng** những component mà `/[locale]/apps/[slug]`
 * dùng (`DocsShell`, `Sidebar`, `AppHero`, `FeatureGrid`, `SectionBody`, `Toc`) và
 * nằm trong nhóm `(public)` nên nó cũng nhận đúng layout, thanh trên cùng và bảng
 * màu của trang thật. Khác duy nhất: một dải "bản nháp" ở đầu trang.
 *
 * Ba điều kiện, thiếu một là không có nội dung nào hiện ra:
 *
 * 1. **`force-dynamic`.** Xem thử mà trả bản đã cache thì không còn là xem thử.
 *    `getApp(..., { includeDrafts: true })` cũng tự bỏ qua `unstable_cache` vì cùng
 *    lý do. Kết xuất động cũng là thứ khiến Next trả `Cache-Control: private,
 *    no-cache, no-store` — đúng yêu cầu `no-store` của spec, và nó đến từ chế độ
 *    kết xuất chứ không từ một header gõ tay ở đâu đó có thể quên.
 * 2. **Có session quản trị.** `requireAdmin()` đá về trang đăng nhập nếu không.
 * 3. **Token khớp `PREVIEW_SECRET`**, so bằng `timingSafeEqual`. Chỉ có session là
 *    chưa đủ, và chỉ có token cũng chưa đủ: token đi trong URL nên nó rò rỉ qua
 *    lịch sử duyệt web và log máy chủ, còn session thì không nói được là người dùng
 *    *muốn* xem bản nháp.
 *
 * Hai nhánh từ chối (chưa khai biến, token sai) kết xuất một khối giải thích thay
 * vì mã 403/503 như route handler cũ: page của App Router không đặt được mã trạng
 * thái tuỳ ý mà không bật `experimental.authInterrupts`. Đánh đổi này chấp nhận
 * được vì cả hai nhánh chỉ tới được sau `requireAdmin()`, không tiết lộ gì về việc
 * ứng dụng có tồn tại hay không, và câu trả lời người vận hành cần là "phải sửa gì"
 * chứ không phải con số trong header. Slug không tồn tại thì `notFound()` — chỗ đó
 * mã 404 vừa đúng vừa có sẵn trang.
 */
export const dynamic = "force-dynamic";

type PageParams = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Bản xem thử không bao giờ được đánh chỉ mục, kể cả khi ai đó dán liên kết ra ngoài. */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("admin.previewPage.title")} — ${t("brand.name")}`,
    robots: { index: false, follow: false },
  };
}

/** So sánh token trong thời gian không phụ thuộc nội dung. */
function tokenMatches(given: string, secret: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  // Độ dài lệch thì `timingSafeEqual` ném lỗi; so sánh trước và trả false.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AppPreviewPage({ params, searchParams }: PageParams) {
  const { locale, slug } = await params;

  // `[locale]` bắt cả đường dẫn lạ; ngôn ngữ không có trong danh sách thì đây là
  // trang không tồn tại, không phải trang tiếng Việt.
  if (!locales.includes(locale)) notFound();
  setRequestLocale(locale);

  // Lớp 1: phải là quản trị viên. Không phải thì hàm này chuyển hướng về
  // `/admin/login` và không dòng nào dưới đây chạy.
  await requireAdmin();

  const t = await getTranslations({ locale });

  // Lớp 2: token. Chưa khai `PREVIEW_SECRET` thì **đóng**, không mở — thiếu cấu
  // hình mà mặc định cho qua là biến chế độ xem thử thành cửa sau công khai.
  const secret = process.env.PREVIEW_SECRET;
  if (!secret) {
    return <PreviewProblem title={t("admin.previewPage.title")} body={t("admin.previewPage.notConfigured")} />;
  }

  const token = firstValue((await searchParams).token);
  if (!tokenMatches(token, secret)) {
    return <PreviewProblem title={t("admin.previewPage.title")} body={t("admin.previewPage.forbidden")} />;
  }

  const app = await getApp(slug, locale, { includeDrafts: true });
  if (!app) notFound();

  const currentHref = `/${locale}/apps/${slug}`;

  const statusLabels = {
    core: t("status.core"),
    connected: t("status.connected"),
    planned: t("status.planned"),
    standalone: t("status.standalone"),
    private: t("status.private"),
  };

  const publishLabel = t(
    app.status === "PUBLISHED"
      ? "admin.publishState.published"
      : app.status === "ARCHIVED"
        ? "admin.publishState.archived"
        : "admin.publishState.draft",
  );

  // Cột trái dựng đúng như trang công khai: con cháu của tab đang mở. Nút của
  // ứng dụng chưa publish không có trong cây công khai, nên nó cũng không hiện
  // trong cột trái của chính nó — đó là hiện trạng thật, và là một lý do nữa để
  // bấm Công khai.
  const trail = findTrail(await getNavTree(locale), currentHref);
  const sidebarNodes = trail[0]?.children ?? [];

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
        // `undefined` chứ không phải một `Sidebar` rỗng — xem chú thích ở trang thật.
        sidebarNodes.length > 0 ? (
          <Sidebar nodes={sidebarNodes} activeHref={currentHref} label={t("sidebar.label")} />
        ) : undefined
      }
      toc={app.toc.length > 0 ? <Toc items={app.toc} title={t("toc.title")} /> : undefined}
      main={
        <article className={styles.main}>
          {/* Dải bản nháp là thứ **duy nhất** trang thật không có. Đặt trên cùng
              để không ai chụp màn hình bản nháp rồi tưởng đó là trang đã công khai. */}
          <Callout
            className={styles.banner}
            tone="warning"
            title={`${t("admin.previewPage.title")} · ${publishLabel}`}
          >
            {t("admin.previewPage.notice")}
          </Callout>

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
            drawer={
              /* Ngăn kéo điều hướng của màn hẹp, đặt NGAY ĐẦU BÀI như mockup mục
                 07 — ngay dưới dòng mô tả, trước nội dung. Ở màn rộng nó ẩn hoàn
                 toàn vì cột trái đã làm đúng việc đó. Cùng `sidebarNodes`, cùng
                 `NavTree`: một cây, hai chỗ hiện. */
              <NavDrawer
                nodes={sidebarNodes}
                activeHref={currentHref}
                labels={{ open: t("sidebar.label"), close: t("search.close") }}
              />
            }
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

/**
 * Khối giải thích cho hai nhánh từ chối. Không dựng khung ba cột: chưa có nội dung
 * nào để xem thử, nên bày ra một trang tài liệu trống là gây nhầm lẫn.
 */
function PreviewProblem({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.problem}>
      <Callout tone="warning" title={title}>
        {body}
      </Callout>
    </div>
  );
}
