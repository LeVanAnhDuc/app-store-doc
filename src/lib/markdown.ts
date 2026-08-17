import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

/**
 * Kết xuất Markdown thành HTML đã sanitize, khối mã đã tô màu.
 *
 * Nội dung hôm nay do một người viết, nhưng khi nối IDMS sẽ là nhiều người.
 * Lúc đó không ai nhớ quay lại thêm sanitize, nên sanitize nằm sẵn trong
 * đường ống ngay từ đầu.
 */

// ---------------------------------------------------------------------------
// 1. Bỏ HTML thô trong Markdown
// ---------------------------------------------------------------------------

/**
 * Thẻ mà nội dung bên trong cũng phải biến mất, không chỉ riêng cặp thẻ.
 * `<script>alert(1)</script>` mà chỉ bỏ hai thẻ thì chuỗi `alert(1)` còn lại
 * dưới dạng văn bản — vô hại nhưng bẩn, và cho thấy bộ lọc chưa hiểu cấu trúc.
 */
const DANGEROUS_RAW_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "textarea",
  "form",
  "svg",
  "math",
]);

/** Hình dạng tối thiểu của một nút mdast mà bộ lọc cần biết. */
type MdastNode = { type: string; value?: unknown; children?: unknown };

const closingTagPattern = (tag: string) => new RegExp(`</\\s*${tag}\\s*>`, "i");

/**
 * Xoá mọi nút `html` khỏi cây mdast, kèm nội dung nằm giữa cặp thẻ nguy hiểm.
 *
 * `remark-rehype` mặc định đã bỏ nút `html`, nhưng nó chỉ bỏ đúng nút đó —
 * văn bản kẹp giữa `<script>` và `</script>` vẫn sống sót vì đó là nút `text`
 * riêng. Hàm này quét theo cặp thẻ nên dọn được cả phần thân.
 */
function stripRawHtml(node: MdastNode): void {
  if (!Array.isArray(node.children)) return;

  const kept: MdastNode[] = [];
  /** Đang ở trong cặp thẻ nguy hiểm nào, `null` là không ở trong cặp nào. */
  let insideTag: string | null = null;

  for (const child of node.children as MdastNode[]) {
    if (child.type === "html") {
      const raw = String(child.value ?? "");

      if (insideTag) {
        if (closingTagPattern(insideTag).test(raw)) insideTag = null;
        continue;
      }

      const openTag = /^<\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(raw)?.[1]?.toLowerCase();
      // Khối HTML gọn trong một nút (`<script>…</script>`) không mở cặp mới.
      if (openTag && DANGEROUS_RAW_TAGS.has(openTag) && !closingTagPattern(openTag).test(raw)) {
        insideTag = openTag;
      }
      continue;
    }

    if (insideTag) continue;

    stripRawHtml(child);
    kept.push(child);
  }

  node.children = kept;
}

function remarkStripRawHtml() {
  return (tree: unknown) => {
    stripRawHtml(tree as MdastNode);
  };
}

// ---------------------------------------------------------------------------
// 2. Schema sanitize
// ---------------------------------------------------------------------------

/**
 * Shiki tô màu bằng cách bọc từng token trong `<span>` mang `style`, và
 * rehype-pretty-code bọc khối mã trong `<figure>` kèm các thuộc tính `data-*`.
 * Schema mặc định của rehype-sanitize (theo GitHub) không biết những thứ đó:
 * nó không có `figure`, chỉ cho `className` dạng `language-*` trên `code`, và
 * không cho `style` ở bất cứ đâu. Vì sanitize chạy **sau** khi tô màu, giữ
 * nguyên schema mặc định sẽ xoá sạch màu vừa sinh ra.
 *
 * Nới lỏng chỉ đúng những gì đường ống của chính ta tạo ra. `<script>`,
 * handler nội tuyến và giao thức `javascript:` vẫn bị chặn như cũ.
 */
const codeAttributes = ["className", "style", "data*"];

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption"],
  attributes: {
    ...defaultSchema.attributes,
    // Thay hẳn định nghĩa cũ `[["className", /^language-./]]`: sanitize lấy
    // định nghĩa **đầu tiên** khớp tên, nên để lại bản hạn chế thì bản rộng
    // phía sau không bao giờ được dùng.
    code: [...codeAttributes],
    pre: [...codeAttributes, "tabIndex"],
    span: [...codeAttributes],
    figure: [...codeAttributes],
    figcaption: [...codeAttributes],
    div: [...(defaultSchema.attributes?.div ?? []), ...codeAttributes],
  },
};

// ---------------------------------------------------------------------------
// 3. Đường ống
// ---------------------------------------------------------------------------

/**
 * Hai chủ đề sinh ra biến CSS `--shiki-light` / `--shiki-dark` thay vì mã màu
 * cứng, đúng quy tắc "mọi màu qua biến CSS" và ba trạng thái chủ đề của
 * design-rules. CSS toàn cục cần một lần khai báo:
 *
 * ```css
 * .shiki, .shiki span { color: var(--shiki-light); }
 * @media (prefers-color-scheme: dark) {
 *   :root:not([data-theme="light"]) .shiki,
 *   :root:not([data-theme="light"]) .shiki span { color: var(--shiki-dark); }
 * }
 * :root[data-theme="dark"] .shiki,
 * :root[data-theme="dark"] .shiki span { color: var(--shiki-dark); }
 * ```
 */
const prettyCodeOptions: PrettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  // Nền do token thiết kế quyết định, không để chủ đề shiki ghi đè.
  keepBackground: false,
  defaultLang: "plaintext",
  transformers: [
    {
      name: "keep-source",
      /**
       * Shiki cắt mã thành từng token nằm trong `<span>` riêng, nên `npm install`
       * không còn là một chuỗi liền trong HTML. Giữ lại mã nguyên bản trên `<pre>`
       * để nút Sao chép và chỉ mục tìm kiếm vẫn lấy được đúng những gì tác giả gõ.
       */
      pre(node) {
        node.properties["data-code"] = this.source;
      },
    },
  ],
};

/**
 * Thứ tự bắt buộc: parse → gfm → rehype → tô màu → **sanitize** → stringify.
 * Đảo sanitize lên trước bước tô màu thì nó xoá sạch `<span>` shiki vừa tạo
 * và khối mã mất hết màu.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStripRawHtml)
  .use(remarkRehype)
  .use(rehypePrettyCode, prettyCodeOptions)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

/** Markdown → HTML đã sanitize, khối mã đã tô màu. Dấu tiếng Việt giữ nguyên. */
export async function renderMarkdown(md: string): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}
