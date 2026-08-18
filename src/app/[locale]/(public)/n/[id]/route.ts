import { notFound, redirect } from "next/navigation";

import { locales } from "@/i18n/locales.generated";
import { firstLeafHref, type NavTreeNode } from "@/server/content/nav";
import { getNavTree } from "@/server/content/queries";

/**
 * `/[locale]/n/[id]` — địa chỉ của một nút chứa.
 *
 * `CONTAINER` không có nội dung riêng nên nó **không có trang** (spec §5): trong
 * điều hướng, bấm vào nó chỉ mở/đóng. Nhưng một địa chỉ vẫn phải tồn tại, vì id
 * của nút lộ ra ở dải tab và trong trang quản trị, và người ta sẽ gõ thẳng hoặc
 * chia sẻ nó. Ở đây ta chuyển tới **lá đã publish đầu tiên** theo thứ tự cây —
 * đúng thứ người dùng sẽ thấy nếu họ bấm mở nút đó rồi bấm mục đầu tiên.
 *
 * Không có lá nào publish thì `notFound()`: bất biến I2 cấm publish nút chứa
 * rỗng, nên trường hợp này chỉ xảy ra với dữ liệu đã hỏng, và chuyển hướng bừa đi
 * đâu đó còn tệ hơn một trang 404 nói thật.
 *
 * Là Route Handler chứ không phải `page.tsx`: nó không bao giờ kết xuất gì cả.
 */

/** Tìm một nút theo id trong cây đã dựng. Chỉ dùng ở đây nên không đưa vào `nav.ts`. */
function findNode(nodes: NavTreeNode[], id: string): NavTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale, id } = await params;

  if (!locales.includes(locale)) notFound();

  // `getNavTree` chỉ trả nút đã publish, nên nút nháp ở đây là "không tồn tại" —
  // đúng như mọi nội dung nháp khác trên phần công khai.
  const node = findNode(await getNavTree(locale), id);
  if (!node) notFound();

  const href = firstLeafHref(node);
  if (!href) notFound();

  // `redirect` ném lỗi, nên phải gọi ngoài mọi `try/catch` (tài liệu Next).
  redirect(href);
}
