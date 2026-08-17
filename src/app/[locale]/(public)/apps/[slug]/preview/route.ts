import { timingSafeEqual } from "node:crypto";
import { getTranslations } from "next-intl/server";

import { locales } from "@/i18n/locales.generated";
import { renderMarkdown } from "@/lib/markdown";
import { requireAdmin } from "@/server/auth";
import { getApp } from "@/server/content/queries";

/**
 * `/[locale]/apps/[slug]/preview?token=…` — xem thử bản nháp (spec §8.4).
 *
 * Ba điều kiện, thiếu một là không có gì hiện ra:
 *
 * 1. **`force-dynamic` và không cache.** Xem thử mà trả bản đã cache thì không
 *    còn là xem thử. `getApp(..., { includeDrafts: true })` cũng tự bỏ qua
 *    `unstable_cache` vì cùng lý do.
 * 2. **Có session quản trị.** `requireAdmin()` đá về trang đăng nhập nếu không.
 * 3. **Token khớp `PREVIEW_SECRET`.** Chỉ có session là chưa đủ, và chỉ có token
 *    cũng chưa đủ: token đi trong URL nên nó rò rỉ qua lịch sử duyệt web và log
 *    máy chủ, còn session thì không nói được là người dùng *muốn* xem bản nháp.
 *
 * Trang này **không** dựng lại giao diện công khai. Nó là bản kiểm nội dung thô:
 * đúng chữ, đúng thứ tự, markdown kết xuất qua đúng đường ống của trang thật.
 * Chép bảng màu ra đây để trông giống trang công khai sẽ vi phạm design-rules §2
 * (mọi màu qua biến CSS, không mã màu tay), nên tài liệu này dùng **màu hệ
 * thống** của trình duyệt và nói thẳng ra là nó không phải trang công khai.
 */
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ locale: string; slug: string }> };

/** So sánh token trong thời gian không phụ thuộc nội dung. */
function tokenMatches(given: string, secret: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  // Độ dài lệch thì `timingSafeEqual` ném lỗi; so sánh trước và trả false.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Chữ do người soạn nhập luôn đi qua đây trước khi ghép vào HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function plain(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * Kiểu chữ và màu lấy từ hệ thống: `Canvas`/`CanvasText` là màu hệ thống của
 * CSS, nên tài liệu này tự đúng ở cả chủ đề sáng và tối mà không khai một mã màu
 * nào. Thân bài `line-height: 1.75` vì dấu tiếng Việt chồng nhau (design-rules §3).
 */
const PREVIEW_STYLE = `
:root { color-scheme: light dark; }
body {
  margin: 0 auto; padding: 28px 20px 64px; max-width: 74ch;
  background: Canvas; color: CanvasText;
  font-family: system-ui, sans-serif; line-height: 1.75;
}
.notice {
  border: 1px solid GrayText; border-radius: 7px; padding: 12px 14px; margin-bottom: 26px;
  font-size: 14px;
}
.notice strong { display: block; margin-bottom: 4px; }
.meta { color: GrayText; font-family: ui-monospace, monospace; font-size: 12px; }
h1 { font-size: 30px; line-height: 1.18; letter-spacing: -0.022em; text-wrap: balance; margin: 0 0 6px; }
h2 { font-size: 21px; line-height: 1.25; text-wrap: balance; margin: 34px 0 8px; }
h3 { font-size: 17px; margin: 24px 0 6px; }
a { color: LinkText; }
ul.features { padding-left: 20px; }
pre, table { display: block; max-width: 100%; overflow-x: auto; }
pre { border: 1px solid GrayText; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; }
img { max-width: 100%; height: auto; }
`;

export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  const { locale, slug } = await params;

  if (!locales.includes(locale)) return plain("Not found", 404);

  // Lớp 1: phải là quản trị viên. Không phải thì hàm này chuyển hướng về
  // `/admin/login` và không dòng nào dưới đây chạy.
  await requireAdmin();

  const t = await getTranslations({ locale });

  // Lớp 2: token. Chưa khai `PREVIEW_SECRET` thì **đóng**, không mở — thiếu cấu
  // hình mà mặc định cho qua là biến chế độ xem thử thành cửa sau công khai.
  const secret = process.env.PREVIEW_SECRET;
  if (!secret) return plain(t("admin.previewPage.notConfigured"), 503);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!tokenMatches(token, secret)) return plain(t("admin.previewPage.forbidden"), 403);

  const app = await getApp(slug, locale, { includeDrafts: true });
  if (!app) return plain(t("admin.previewPage.notFound"), 404);

  const statusLabel = t(
    app.status === "PUBLISHED"
      ? "admin.publishState.published"
      : app.status === "ARCHIVED"
        ? "admin.publishState.archived"
        : "admin.publishState.draft",
  );

  const summary = app.summary ? await renderMarkdown(app.summary) : "";

  const features = app.features.length
    ? `<h2>${escapeHtml(t("app.features"))}</h2><ul class="features">${app.features
        .map(
          (feature) =>
            `<li><strong>${escapeHtml(feature.title)}</strong>${
              feature.description ? ` — ${escapeHtml(feature.description)}` : ""
            }</li>`,
        )
        .join("")}</ul>`
    : "";

  // Thân bài đã đi qua `rehype-sanitize` trong `renderMarkdown` — cùng đường ống
  // với trang công khai, nên nội dung xem thử không "sạch hơn" hay "bẩn hơn"
  // trang thật.
  const sections = (
    await Promise.all(
      app.sections.map(async (section) => {
        const body = await renderMarkdown(section.body.content);
        return `<section><h2 id="${escapeHtml(section.anchor)}">${escapeHtml(
          section.title,
        )}</h2>${body}</section>`;
      }),
    )
  ).join("");

  const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(app.name)} — ${escapeHtml(t("admin.previewPage.title"))}</title>
<style>${PREVIEW_STYLE}</style>
</head>
<body>
<div class="notice">
  <strong>${escapeHtml(t("admin.previewPage.title"))} · ${escapeHtml(statusLabel)}</strong>
  ${escapeHtml(t("admin.previewPage.notice"))}
</div>
<h1>${escapeHtml(app.name)}</h1>
<p class="meta">${escapeHtml(app.slug)}</p>
${app.tagline ? `<p>${escapeHtml(app.tagline)}</p>` : ""}
${summary}
${features}
${sections}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
