import { CodeBlock } from "@/components/ui/CodeBlock";
import { renderMarkdown } from "@/lib/markdown";
import type { ResolvedSection } from "@/server/content/queries";
import { FallbackNotice } from "./FallbackNotice";
import styles from "./SectionBody.module.css";

export type SectionBodyLabels = {
  /** Câu báo đang đọc bản ngôn ngữ khác. */
  fallback: string;
  /** Tên gọi hộp cuộn của khối mã, cho trình đọc màn hình. */
  code: string;
  /** Tên gọi hộp cuộn của bảng. */
  table: string;
  /** Nhãn của liên kết neo, đã ghép sẵn tên mục. */
  permalink: string;
};

export type SectionBodyProps = {
  section: ResolvedSection;
  /** Ngôn ngữ người đọc đang yêu cầu. */
  locale: string;
  labels: SectionBodyLabels;
};

/**
 * Một mục nội dung của trang ứng dụng hoặc trang hướng dẫn.
 *
 * Markdown kết xuất **ở máy chủ**: `renderMarkdown` kéo theo shiki và toàn bộ
 * ngữ pháp tô màu, đẩy chuyện đó xuống trình duyệt là thêm vài trăm KB cho một
 * việc đã xong từ lúc build. Client cũng không có gì để làm với nó — nội dung
 * không đổi sau khi tải.
 */

/** Một mảnh của thân bài sau khi tách khối cần hộp cuộn riêng. */
type Part =
  | { kind: "prose"; html: string; key: string }
  | { kind: "code"; html: string; key: string }
  | { kind: "table"; html: string; key: string };

/**
 * Khối mã (`<figure>` do rehype-pretty-code sinh) và bảng GFM (`<table>`) ở
 * ngay tầng ngoài cùng của HTML đã kết xuất, không lồng nhau, nên tách bằng một
 * biểu thức chính quy là đủ và không cần dựng lại cả cây DOM.
 */
const SCROLLABLE_BLOCK = /<figure data-rehype-pretty-code-figure(?:="")?>[\s\S]*?<\/figure>|<table>[\s\S]*?<\/table>/g;

/**
 * rehype-pretty-code đã đặt `tabindex="0"` lên `<pre>`; `CodeBlock` cũng nhận
 * tiêu điểm ở lớp bọc ngoài. Giữ cả hai thì mỗi khối mã thành hai điểm dừng Tab
 * cho cùng một vùng cuộn. Bỏ cái bên trong, giữ cái có `role="region"` và tên
 * gọi.
 */
function dropInnerTabIndex(html: string): string {
  return html.replace(/(<pre\b[^>]*?)\stabindex="0"/g, "$1");
}

function splitParts(html: string): Part[] {
  const parts: Part[] = [];
  let cursor = 0;

  for (const match of html.matchAll(SCROLLABLE_BLOCK)) {
    const start = match.index;
    if (start > cursor) {
      parts.push({ kind: "prose", html: html.slice(cursor, start), key: `p${cursor}` });
    }

    parts.push({
      kind: match[0].startsWith("<table") ? "table" : "code",
      html: match[0],
      key: `b${start}`,
    });
    cursor = start + match[0].length;
  }

  if (cursor < html.length) {
    parts.push({ kind: "prose", html: html.slice(cursor), key: `p${cursor}` });
  }

  return parts;
}

export async function SectionBody({ section, locale, labels }: SectionBodyProps) {
  const html = await renderMarkdown(section.body.content);

  return (
    <section className={styles.section} id={section.anchor}>
      <h2 className={styles.heading}>
        {section.title}
        <a className={styles.anchor} href={`#${section.anchor}`} aria-label={labels.permalink}>
          #{section.anchor}
        </a>
      </h2>

      <FallbackNotice shownLocale={section.locale} wantedLocale={locale} label={labels.fallback} />

      {splitParts(html).map((part) => {
        if (part.kind === "code") {
          return (
            <CodeBlock
              key={part.key}
              className={styles.code}
              html={dropInnerTabIndex(part.html)}
              label={labels.code}
            />
          );
        }

        if (part.kind === "table") {
          // `DataTable` dựng sẵn thẻ `<table>` của riêng nó nên không nhận được
          // bảng đã kết xuất từ Markdown; ở đây chỉ mượn lại đúng cái hộp cuộn.
          return (
            <div
              key={part.key}
              className={styles.tableScroll}
              role="region"
              aria-label={labels.table}
              tabIndex={0}
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          );
        }

        return (
          <div
            key={part.key}
            className={styles.prose}
            // HTML đã đi qua sanitize trong `renderMarkdown`; đây là đầu ra của
            // chính đường ống đó chứ không phải chuỗi người dùng gửi thẳng vào.
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </section>
  );
}
