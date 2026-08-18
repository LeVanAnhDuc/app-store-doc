/**
 * Cây điều hướng: dựng cây từ danh sách phẳng, tìm đường, và kiểm sáu bất biến.
 *
 * Thuần như `resolve.ts`: không chạm Prisma, không chạm Next.js. `queries.ts` đọc
 * `NavNode` ra một mảng phẳng rồi giao cho các hàm ở đây; `mutations.ts` gọi
 * `assertNavInvariants` và `wouldCreateCycle` trước khi ghi. Nhờ vậy toàn bộ quy
 * tắc của cây kiểm được bằng test không cần cơ sở dữ liệu — mà cây tự tham chiếu
 * chính là chỗ dễ sinh dữ liệu vô nghĩa nhất trong cả hệ thống (spec §4).
 *
 * Nút gốc (`parentId = null`) là dải tab trên cùng; con cháu của tab đang mở là
 * sidebar trái. URL giữ phẳng — cây chỉ điều khiển cách hiển thị điều hướng.
 */
import { statusValues } from "@/lib/schemas";

import { resolveTranslation } from "./resolve";

/**
 * Ba loại nút (spec §3.1). Viết thẳng chứ không import từ `@prisma/client`, cùng
 * lối với `statusValues` trong `@/lib/schemas`: module này phải chạy được trong
 * test, nơi Prisma Client có thể chưa được sinh.
 */
export const navKindValues = ["CONTAINER", "APP", "DOC"] as const;
export type NavKind = (typeof navKindValues)[number];

type Status = (typeof statusValues)[number];

/** Một dòng phẳng đọc từ DB, đã kèm mọi bản dịch cần để chọn nhãn. */
export type NavRow = {
  id: string;
  parentId: string | null;
  order: number;
  status: Status;
  kind: NavKind;
  /** Nhãn ứng viên theo locale: CONTAINER lấy từ NavNodeTranslation,
   *  APP từ AppTranslation.name, DOC từ DocPageTranslation.title. */
  labels: { locale: string; value: string }[];
  /** null với CONTAINER. */
  href: string | null;
};

export type NavTreeNode = {
  id: string;
  kind: NavKind;
  label: string;
  href: string | null;
  isFallback: boolean;
  children: NavTreeNode[];
};

/** Anh em sắp theo `order`; `order` trùng thì theo `id` để thứ tự không nhảy giữa hai lần build. */
function bySiblingOrder(a: NavRow, b: NavRow): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

/**
 * Ném lỗi khi trong `rows` có chu trình (I3).
 *
 * Chu trình không bao giờ tới được từ nút gốc — mỗi nút chỉ có một cha, nên một
 * nút đã nằm trong vòng thì không còn tổ tiên nào là nút gốc. Vì vậy nếu chỉ đi
 * xuống từ gốc thì cây vẫn dựng xong và cả vòng lặng lẽ biến mất, đúng kiểu lỗi
 * không ai phát hiện. Ta đi *lên* theo chuỗi cha của từng dòng để chu trình nổ
 * ra thành lỗi thay vì thành dữ liệu mất tích.
 */
function assertNoCycle(rows: NavRow[]): void {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const safe = new Set<string>();

  for (const start of rows) {
    const walked = new Set<string>();
    let current: NavRow | undefined = start;

    while (current && !safe.has(current.id)) {
      if (walked.has(current.id)) {
        throw new Error(
          `Nút điều hướng "${current.id}" là hậu duệ của chính nó — cây có chu trình. ` +
            "Không dựng được cây từ dữ liệu này. Hãy sửa nút cha của một nút trong vòng " +
            `(${[...walked].join(" → ")}).`,
        );
      }
      walked.add(current.id);
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }

    for (const id of walked) safe.add(id);
  }
}

/**
 * Dựng cây từ danh sách phẳng, chỉ lấy nút đã publish.
 *
 * Chịu được dữ liệu xấu theo hai lối khác nhau, có chủ ý:
 *
 * - **Nút mồ côi bị bỏ, im lặng.** Cha không tồn tại (hoặc cha chưa publish)
 *   nghĩa là cả nhánh không có đường vào; bỏ đi thì phần còn lại của điều hướng
 *   vẫn hiện. Sập cả cây vì một nút lạc là cái giá quá đắt.
 * - **Chu trình thì ném lỗi.** Đây là dữ liệu không thể hiển thị đúng bằng bất kỳ
 *   cách nào, và bỏ im lặng sẽ làm mất hẳn một nhánh mà không ai biết.
 *
 * Nút không có nhãn ở cả locale yêu cầu lẫn locale mặc định cũng bị bỏ (cùng
 * nhánh của nó): tuyệt đối không lấy slug hay id làm nhãn thay thế — "khong-nhan"
 * hiện ra chỗ đáng lẽ là "Hướng dẫn" trông như dữ liệu thật nên sẽ lọt qua mọi
 * vòng kiểm tra, còn một mục vắng mặt thì thấy ngay.
 */
export function buildNavTree(rows: NavRow[], locale: string, fallback: string): NavTreeNode[] {
  const published = rows.filter((row) => row.status === "PUBLISHED");
  assertNoCycle(published);

  const byId = new Map(published.map((row) => [row.id, row]));
  const childrenOf = new Map<string | null, NavRow[]>();

  for (const row of published) {
    // Cha không nằm trong tập publish → mồ côi, bỏ cả nhánh.
    if (row.parentId !== null && !byId.has(row.parentId)) continue;
    const siblings = childrenOf.get(row.parentId);
    if (siblings) siblings.push(row);
    else childrenOf.set(row.parentId, [row]);
  }

  for (const siblings of childrenOf.values()) siblings.sort(bySiblingOrder);

  // `path` là chuỗi tổ tiên của nút đang dựng. `assertNoCycle` đã loại mọi chu
  // trình nên tập này không bao giờ chặn thật; giữ lại làm chốt cuối để một lỗi
  // trong chính hàm này cũng thành ngoại lệ thay vì treo trang.
  const path = new Set<string>();

  const build = (row: NavRow): NavTreeNode | null => {
    if (path.has(row.id)) {
      throw new Error(`Nút điều hướng "${row.id}" xuất hiện hai lần trên cùng một đường — cây có chu trình.`);
    }
    path.add(row.id);
    try {
      const children = (childrenOf.get(row.id) ?? [])
        .map(build)
        .filter((child): child is NavTreeNode => child !== null);

      const label = resolveTranslation(row.labels, locale, fallback);
      if (!label) return null;

      return {
        id: row.id,
        kind: row.kind,
        label: label.value.value,
        href: row.href,
        isFallback: label.isFallback,
        children,
      };
    } finally {
      path.delete(row.id);
    }
  };

  return (childrenOf.get(null) ?? [])
    .map(build)
    .filter((node): node is NavTreeNode => node !== null);
}

/**
 * Đường từ gốc tới nút mang `href` đã cho — để biết tab nào đang mở và mở sẵn
 * nhánh nào. Không tìm thấy thì trả mảng rỗng.
 */
export function findTrail(tree: NavTreeNode[], href: string): NavTreeNode[] {
  for (const node of tree) {
    if (node.href === href) return [node];
    const deeper = findTrail(node.children, href);
    if (deeper.length > 0) return [node, ...deeper];
  }
  return [];
}

/**
 * Lá đầu tiên theo thứ tự cây, dùng khi ai đó mở thẳng URL của một nút chứa —
 * `CONTAINER` không có URL riêng nên route `/n/[id]` chuyển hướng tới đây. Không
 * có lá nào thì trả `null` để route gọi `notFound()`.
 */
export function firstLeafHref(node: NavTreeNode): string | null {
  if (node.href !== null) return node.href;
  for (const child of node.children) {
    const href = firstLeafHref(child);
    if (href !== null) return href;
  }
  return null;
}

/**
 * Kiểm bốn bất biến kiểm được từ danh sách phẳng: I1, I2, I5, I6 (spec §4).
 *
 * I3 là `wouldCreateCycle`, gọi riêng khi đổi cha. I4 (một App/DocPage chỉ gắn
 * vào đúng một nút) do `@unique` trong DB ép.
 *
 * Chỉ xét nút đã publish: bản nháp được phép dở dang: đó là ý nghĩa của nháp.
 */
export function assertNavInvariants(rows: NavRow[], defaultLocale: string): void {
  const published = rows.filter((row) => row.status === "PUBLISHED");
  const publishedIds = new Set(published.map((row) => row.id));

  const publishedChildren = new Map<string, number>();
  for (const row of published) {
    if (row.parentId === null || !publishedIds.has(row.parentId)) continue;
    publishedChildren.set(row.parentId, (publishedChildren.get(row.parentId) ?? 0) + 1);
  }

  // I1 — nút có con phải là CONTAINER.
  //
  // Kiểm trước I2 vì đây là vi phạm nặng hơn: yêu cầu gốc "cha có con thì không
  // có nội dung, chỉ toggle mở con" mà áp thẳng lên một `APP` sẽ khiến ứng dụng
  // đó mất repo, tech stack, tính năng và mục nội dung — dữ liệu vẫn nằm nguyên
  // trong DB nhưng không còn đường nào tới được. Vì vậy `APP`/`DOC` luôn là lá,
  // và toàn bộ cấu trúc cây do `CONTAINER` tạo ra (spec §3.2).
  for (const row of published) {
    if (row.kind === "CONTAINER") continue;
    if ((publishedChildren.get(row.id) ?? 0) > 0) {
      throw new Error(
        `Nút "${row.id}" có con nhưng loại là ${row.kind}, không phải nút chứa. ` +
          "Chỉ nút chứa (CONTAINER) được có con: ứng dụng và trang tài liệu luôn là lá, " +
          "nếu không nội dung của chúng (repo, tech stack, tính năng) không còn đường nào tới được. " +
          "Hãy tạo một nút chứa rồi đặt cả hai vào trong.",
      );
    }
  }

  // I2 — nút chứa không có con đã publish thì không publish được.
  for (const row of published) {
    if (row.kind !== "CONTAINER") continue;
    if ((publishedChildren.get(row.id) ?? 0) === 0) {
      throw new Error(
        `Nút chứa "${row.id}" đang publish nhưng rỗng — không có con nào đã publish. ` +
          "Bấm vào nó sẽ chẳng xổ ra gì, tức là hứa một thứ không có. " +
          "Hãy thêm nội dung vào rồi publish, hoặc hạ nút này xuống nháp.",
      );
    }
  }

  // I5 — nút chứa phải có nhãn ở locale mặc định.
  for (const row of published) {
    if (row.kind !== "CONTAINER") continue;
    const hasDefaultLabel = row.labels.some(
      (label) => label.locale === defaultLocale && label.value.trim() !== "",
    );
    if (!hasDefaultLabel) {
      throw new Error(
        `Nút chứa "${row.id}" chưa có nhãn ở locale mặc định "${defaultLocale}". ` +
          "Không có nhãn thì sidebar hiện một dòng trống bấm được, không ai đoán được nó là gì — " +
          "và ta không bịa nhãn từ id để lấp chỗ.",
      );
    }
  }

  // I6 — phải có ít nhất một nút gốc đã publish.
  if (!published.some((row) => row.parentId === null)) {
    throw new Error(
      "Không còn nút gốc nào đã publish. Nút gốc chính là dải tab trên cùng, " +
        "nên không có nút gốc nghĩa là không có đường vào bất cứ đâu.",
    );
  }
}

/**
 * `true` khi gán `newParentId` làm cha của `nodeId` sẽ tạo chu trình (I3).
 *
 * Chặn cả trường hợp nút làm cha của chính nó. Kiểm trên **mọi** dòng, kể cả
 * nháp: chu trình nằm sẵn trong bản nháp rồi publish thì cũng treo trang.
 */
export function wouldCreateCycle(
  rows: NavRow[],
  nodeId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false;
  if (newParentId === nodeId) return true;

  const byId = new Map(rows.map((row) => [row.id, row]));
  const walked = new Set<string>();
  let current = byId.get(newParentId);

  while (current) {
    if (current.id === nodeId) return true;
    // Dữ liệu đã có chu trình từ trước: trả `true` để chặn nước đi thay vì lặp
    // vô hạn. `buildNavTree` là nơi báo lỗi cho chu trình cũ đó.
    if (walked.has(current.id)) return true;
    walked.add(current.id);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return false;
}
