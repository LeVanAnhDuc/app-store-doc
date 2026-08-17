/**
 * Dựng chỉ mục tìm kiếm từ nội dung. Thuần, không chạm Prisma hay mạng, để
 * `src/server/content/queries.ts` gọi được và test chạy không cần DB.
 */

/** Một mục trong chỉ mục tìm kiếm, đủ để hiển thị kết quả mà không cần gọi lại server. */
export type SearchDoc = {
  href: string;
  title: string;
  kind: "app" | "doc";
  text: string;
};

/** Một mục nội dung của app hoặc trang docs. `body` là markdown thô. */
type SectionInput = { title: string; body: string };

export type SearchIndexInput = {
  apps: { slug: string; name: string; sections: SectionInput[] }[];
  docs: { slug: string; title: string; sections: SectionInput[] }[];
  locale: string;
};

/**
 * Gỡ ký hiệu markdown, chỉ giữ lại chữ người đọc thấy.
 *
 * Khối mã bị bỏ hẳn chứ không chỉ gỡ dấu nháy: lệnh shell (`npm install`,
 * `docker compose up`) lặp lại ở hàng chục trang nên nếu giữ, mọi truy vấn
 * dính từ khoá kỹ thuật đều trả về gần như toàn bộ chỉ mục.
 */
export function stripMarkdown(md: string): string {
  return (
    md
      // Khối mã rào (``` hoặc ~~~) — bỏ cả nội dung.
      .replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, " ")
      // Khối mã rào không được đóng ở cuối chuỗi.
      .replace(/^[ \t]*(```|~~~)[\s\S]*$/m, " ")
      // Ảnh: bỏ hẳn, alt thường là mô tả trùng lặp với chú thích quanh đó.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      // Liên kết: giữ chữ, bỏ URL.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Liên kết tham chiếu `[chữ][nhãn]` và định nghĩa nhãn ở cuối trang.
      .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, " ")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      // Thẻ HTML thô, gồm cả autolink `<https://...>`.
      .replace(/<[^>\n]*>/g, " ")
      // Mã nội tuyến: giữ chữ bên trong (thường là tên trường, tên biến).
      .replace(/`+([^`]*)`+/g, "$1")
      // Ký hiệu tiêu đề, trích dẫn, đầu mục danh sách.
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
      .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "")
      // Đường kẻ ngang.
      .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, " ")
      // Đường phân cách của bảng GFM, rồi tới dấu gạch đứng.
      .replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, " ")
      .replace(/\|/g, " ")
      // Ký hiệu nhấn mạnh. Dấu `_` chỉ bỏ khi đứng ở rìa từ, để `snake_case`
      // trong tên trường không bị dính thành một khối vô nghĩa.
      .replace(/\*\*|~~|\*/g, "")
      .replace(/(^|\s)_+|_+(?=\s|$)/g, "$1")
      // Gộp mọi khoảng trắng: kết quả là một dòng duy nhất.
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Gộp tiêu đề và thân của mọi mục thành một chuỗi phẳng để so khớp. */
function flattenSections(sections: SectionInput[]): string {
  return sections
    .flatMap((s) => [s.title, stripMarkdown(s.body)])
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dựng chỉ mục cho một locale. `title` luôn là tên hiển thị (Web Store Apps),
 * không bao giờ là slug — slug chỉ đóng vai trò phụ trong giao diện.
 */
export function buildSearchIndex(input: SearchIndexInput): SearchDoc[] {
  const { locale } = input;

  const apps: SearchDoc[] = input.apps.map((app) => ({
    href: `/${locale}/apps/${app.slug}`,
    title: app.name,
    kind: "app",
    text: flattenSections(app.sections),
  }));

  const docs: SearchDoc[] = input.docs.map((doc) => ({
    href: `/${locale}/docs/${doc.slug}`,
    title: doc.title,
    kind: "doc",
    text: flattenSections(doc.sections),
  }));

  return [...apps, ...docs];
}
