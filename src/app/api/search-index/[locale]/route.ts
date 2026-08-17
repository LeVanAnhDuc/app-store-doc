// src/app/api/search-index/[locale]/route.ts
import { unstable_cache } from "next/cache";
import { tags } from "@/server/content/tags";
import { getSearchIndex } from "@/server/content/queries";

/**
 * Chỉ mục KHÔNG sinh lúc build. Sinh lúc build sẽ khiến kết quả tìm lệch với
 * nội dung cho tới lần deploy sau, phá vỡ lời hứa "sửa là thấy ngay". Thay vào
 * đó cache theo tag `search-index` và để `mutations.ts` gọi `revalidateTag`.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const load = unstable_cache(() => getSearchIndex(locale), ["search-index", locale], {
    tags: [tags.searchIndex()],
  });
  return Response.json(await load());
}
