/**
 * Logic thuần của tầng nội dung: fallback ngôn ngữ, dựng mục lục, kiểm bất biến.
 *
 * Không chạm Prisma, không chạm Next.js — nhờ vậy test được mà không cần DB.
 * `queries.ts` lo phần đọc dữ liệu rồi giao mảng thô cho các hàm ở đây.
 */
import { ensureUniqueAnchors } from "@/lib/slug";

/**
 * Một giá trị đã chọn xong ngôn ngữ.
 *
 * `locale` là ngôn ngữ thực sự của `value`, không phải ngôn ngữ người dùng yêu
 * cầu. `isFallback` để trang hiện badge "Chưa có bản <ngôn ngữ>" (spec §7.1) —
 * badge này vừa trung thực với người đọc, vừa tự thành danh sách việc cần dịch.
 */
export type Translated<T> = {
  value: T;
  locale: string;
  isFallback: boolean;
};

/**
 * Chọn bản dịch cho locale `want`, lùi về `fallback` khi thiếu.
 *
 * Trả `null` khi không có cả bản mặc định, để trang gọi `notFound()`. Tuyệt đối
 * không bịa nhãn thay thế từ slug: "web-store-apps" hiện ra chỗ đáng lẽ là
 * "Web Store Apps" trông như dữ liệu thật nên sẽ lọt qua mọi vòng kiểm tra,
 * còn 404 thì lộ ngay.
 */
export function resolveTranslation<T extends { locale: string }>(
  rows: T[],
  want: string,
  fallback: string,
): Translated<T> | null {
  const wanted = rows.find((row) => row.locale === want);
  if (wanted) return { value: wanted, locale: want, isFallback: false };

  const defaulted = rows.find((row) => row.locale === fallback);
  if (defaulted) return { value: defaulted, locale: fallback, isFallback: true };

  return null;
}

/**
 * Dựng mục lục từ danh sách mục, giữ nguyên thứ tự đã sắp trong CMS.
 *
 * Anchor trùng nhau khiến liên kết `#` nhảy sai chỗ mà trang vẫn render bình
 * thường (spec §6.4), nên phải chặn ở đây thay vì để người đọc phát hiện.
 */
export function buildToc(
  sections: { anchor: string; title: string }[],
): { anchor: string; title: string }[] {
  const unique = ensureUniqueAnchors(sections.map((section) => section.anchor));
  if (!unique.ok) {
    throw new Error(
      `Anchor "${unique.duplicate}" bị trùng trong cùng một trang. ` +
        "Mục lục và liên kết # sẽ nhảy sai chỗ. Hãy đổi tiêu đề mục hoặc sửa anchor.",
    );
  }

  return sections.map(({ anchor, title }) => ({ anchor, title }));
}

// ---------------------------------------------------------------------------
// Kế hoạch ghi một danh sách nội dung (tính năng, mục nội dung)
// ---------------------------------------------------------------------------

/**
 * Một dòng trong danh sách gửi lên khi lưu.
 *
 * `id` vắng mặt là mục mới thêm trong lần soạn này. `title` là tiêu đề **ở đúng
 * ngôn ngữ đang lưu** — rỗng nghĩa là ngôn ngữ đó chưa có bản dịch, chứ không
 * phải mục bị xoá.
 */
export type IncomingItem = { id?: string; title: string };

export type PlannedItem<T> = {
  item: T;
  /** Có `id` thì sửa đúng bản ghi đó; vắng thì tạo mới. */
  id?: string;
  /** Lấy từ vị trí trong mảng: thứ tự trong CMS là thứ tự hiển thị thật. */
  order: number;
  /**
   * `true` thì ghi bản dịch cho ngôn ngữ đang lưu; `false` thì **gỡ** bản dịch
   * của riêng ngôn ngữ đó, và không chạm tới bản dịch của ngôn ngữ nào khác.
   */
  translated: boolean;
};

export type SavePlan<T> = {
  items: PlannedItem<T>[];
  /** Mục có trong DB nhưng không có trong danh sách gửi lên → bị xoá. */
  removedIds: string[];
  /** `id` gửi lên nhưng không thuộc chủ sở hữu này → dữ liệu phía trình duyệt đã cũ. */
  foreignIds: string[];
};

/**
 * Tách **cấu trúc** khỏi **bản dịch** khi lưu một danh sách nội dung.
 *
 * Đây là chỗ sửa khiếm khuyết thiết kế mà Task 15 phát hiện. Bản đầu coi danh
 * sách gửi lên là bản dịch của một ngôn ngữ *và* là toàn bộ cấu trúc cùng lúc,
 * nên nó bắt **mọi** mục phải có tiêu đề ở ngôn ngữ đang lưu; trình soạn thảo
 * đối phó bằng cách không gửi gì cả khi còn mục chưa dịch, và như vậy không thể
 * dịch dần sang tiếng Anh — trong khi `TranslationMeter` ("EN thiếu 3/8 mục")
 * tồn tại chính là để đo việc dịch dần.
 *
 * Mô hình đúng, và là mô hình hàm này áp:
 *
 * - **Cấu trúc không phụ thuộc ngôn ngữ.** Mục nào tồn tại, thứ tự, anchor, icon
 *   — tất cả dùng chung. Mục bị xoá khi nó **vắng mặt khỏi danh sách gửi lên**,
 *   không bao giờ vì thiếu bản dịch.
 * - **Bản dịch theo từng ngôn ngữ.** Tiêu đề rỗng ở ngôn ngữ đang lưu nghĩa là
 *   ngôn ngữ đó chưa có bản dịch cho mục này: `translated: false` gỡ đúng một
 *   bản dịch đó và để nguyên các ngôn ngữ khác.
 *
 * Hàm thuần, không chạm Prisma: nhờ vậy quy tắc "thiếu bản dịch không phải là
 * xoá" kiểm được bằng test không cần cơ sở dữ liệu.
 */
export function planContentSave<T extends IncomingItem>(
  incoming: T[],
  existingIds: string[],
): SavePlan<T> {
  const existing = new Set(existingIds);
  const sent = new Set<string>();
  const foreignIds: string[] = [];

  const items = incoming.map((item, index) => {
    if (item.id) {
      if (existing.has(item.id)) sent.add(item.id);
      // Không im lặng bỏ qua: `id` lạ nghĩa là trang soạn thảo đang giữ dữ liệu
      // cũ, và ghi tiếp sẽ trộn nội dung của hai chủ sở hữu khác nhau.
      else if (!foreignIds.includes(item.id)) foreignIds.push(item.id);
    }

    return {
      item,
      id: item.id,
      order: index,
      translated: item.title.trim() !== "",
    };
  });

  return {
    items,
    removedIds: existingIds.filter((id) => !sent.has(id)),
    foreignIds,
  };
}

/**
 * Kiểm bất biến: bảng `Locale` phải có đúng một dòng `isDefault` và dòng đó
 * phải đang bật (spec §6.4).
 *
 * Không có mặc định thì `resolveTranslation` không biết lùi về đâu; có từ hai
 * trở lên thì lùi về bản nào phụ thuộc thứ tự trả về của DB — nghĩa là trang
 * đổi ngôn ngữ ngẫu nhiên giữa các lần build. Tắt locale mặc định cũng vậy:
 * fallback trỏ tới ngôn ngữ đã bị gỡ khỏi giao diện.
 */
export function assertSingleDefaultLocale(
  locales: { code: string; isDefault: boolean; enabled: boolean }[],
): void {
  const defaults = locales.filter((locale) => locale.isDefault);

  if (defaults.length !== 1) {
    throw new Error(
      `Phải có đúng một locale mặc định, đang có ${defaults.length}` +
        (defaults.length > 1
          ? ` (${defaults.map((l) => l.code).join(", ")}).`
          : ".") +
        " Fallback ngôn ngữ không xác định khi bất biến này bị vi phạm.",
    );
  }

  const [only] = defaults;
  if (!only.enabled) {
    throw new Error(
      `Locale mặc định "${only.code}" đang bị tắt. Phải có đúng một locale mặc định ` +
        "và nó phải đang bật, nếu không fallback sẽ trỏ tới ngôn ngữ không hiển thị.",
    );
  }
}
