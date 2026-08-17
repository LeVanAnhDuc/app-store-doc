/**
 * So khớp mờ phía trình duyệt cho hộp tìm kiếm. Chạy trên chỉ mục đã tải sẵn
 * nên không gọi mạng khi người dùng gõ.
 */

import { slugify } from "@/lib/slug";
import type { SearchDoc } from "@/lib/search-index";

/**
 * Chuẩn hoá cả truy vấn lẫn nội dung về cùng một dạng ASCII không dấu.
 *
 * Dùng lại `slugify` là cố ý: tìm không dấu là yêu cầu thật, người Việt gõ
 * nhanh gần như luôn bỏ dấu ("tap luyen"), và nếu hai bên bỏ dấu bằng hai cơ
 * chế khác nhau thì sớm muộn cũng lệch. Kết quả có dạng `tap-luyen`, dấu gạch
 * nối đóng luôn vai trò ranh giới từ.
 */
const normalize = (input: string): string => slugify(input);

/** Số kết quả trả về mặc định — đủ cho danh sách gợi ý, không làm nghẽn giao diện. */
const DEFAULT_LIMIT = 20;

/** Điểm cho từng kiểu khớp; tiêu đề nặng hơn thân bài. */
const SCORE = {
  titleExact: 100,
  titlePrefix: 60,
  titlePhrase: 40,
  titleToken: 12,
  textPhrase: 20,
  textToken: 4,
} as const;

function scoreDoc(doc: SearchDoc, phrase: string, tokens: string[]): number {
  const title = normalize(doc.title);
  const text = normalize(doc.text);
  const haystack = `${title}-${text}`;

  // Mọi từ trong truy vấn đều phải xuất hiện ở đâu đó, nếu không thì kết quả
  // sẽ loãng: gõ hai từ mà chỉ khớp một từ là gợi ý sai.
  if (!tokens.every((token) => haystack.includes(token))) return 0;

  let score = 0;
  if (title === phrase) score += SCORE.titleExact;
  else if (title.startsWith(phrase)) score += SCORE.titlePrefix;
  else if (title.includes(phrase)) score += SCORE.titlePhrase;

  if (text.includes(phrase)) score += SCORE.textPhrase;

  for (const token of tokens) {
    if (title.includes(token)) score += SCORE.titleToken;
    if (text.includes(token)) score += SCORE.textToken;
  }

  return score;
}

/**
 * Trả về các mục khớp, sắp theo điểm giảm dần. Truy vấn rỗng trả mảng rỗng chứ
 * không trả toàn bộ chỉ mục: hộp tìm kiếm chưa gõ gì mà đã đổ ra mọi trang thì
 * người dùng không đọc được gì, và cũng che mất trạng thái "chưa có kết quả".
 */
export function fuzzyMatch(
  query: string,
  docs: SearchDoc[],
  limit: number = DEFAULT_LIMIT,
): SearchDoc[] {
  const phrase = normalize(query);
  if (!phrase) return [];

  const tokens = phrase.split("-").filter(Boolean);
  if (tokens.length === 0) return [];

  return docs
    .map((doc, index) => ({ doc, index, score: scoreDoc(doc, phrase, tokens) }))
    .filter((hit) => hit.score > 0)
    // Điểm bằng nhau thì giữ nguyên thứ tự chỉ mục cho kết quả ổn định.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map((hit) => hit.doc);
}
