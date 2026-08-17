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
