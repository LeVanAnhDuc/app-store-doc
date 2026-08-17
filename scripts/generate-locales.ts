/**
 * Sinh `src/i18n/locales.generated.ts` từ bảng `Locale`.
 *
 * Chạy ở bước `prebuild`. Lý do phải sinh ra file thay vì truy vấn thẳng: middleware
 * của next-intl chạy ở edge trên mọi request và không được chạm DB (spec §9.3).
 *
 * Quy tắc an toàn quan trọng nhất: **không bao giờ ghi đè bằng danh sách rỗng.**
 * Danh sách rỗng nghĩa là middleware không nhận ra locale nào, `generateStaticParams`
 * không sinh route nào, và deploy ra một site không có trang nào truy cập được.
 * Thà dùng lại danh sách đã commit còn hơn.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { hasDatabase, prisma } from "../src/server/db";

const OUTPUT_PATH = fileURLToPath(
  new URL("../src/i18n/locales.generated.ts", import.meta.url),
);

type LocaleRow = {
  code: string;
  enabled: boolean;
  isDefault: boolean;
  order: number;
};

/** Dựng nội dung file. Giữ đúng định dạng file đã commit để diff mỗi lần sinh là nhỏ nhất. */
function renderModule(locales: string[], defaultLocale: string): string {
  const list = locales.map((code) => JSON.stringify(code)).join(", ");
  return `// SINH TỰ ĐỘNG bởi \`scripts/generate-locales.ts\` lúc \`prebuild\` — đừng sửa tay.
// Nguồn dữ liệu: bảng \`Locale\` trong cơ sở dữ liệu.
//
// File này tồn tại vì middleware chạy ở edge và không được chạm DB. Đổi lại,
// thêm một ngôn ngữ mới cần một lần redeploy; sửa nội dung thì không.
// Xem spec §9.3.

export const locales: readonly string[] = [${list}];
export const defaultLocale: string = ${JSON.stringify(defaultLocale)};
`;
}

/**
 * Giữ nguyên file cũ và đi tiếp. Dùng khi *không biết* danh sách thật (thiếu
 * `DATABASE_URL`, DB không kết nối được) — khác hẳn với trường hợp *biết chắc là sai*.
 */
function keepExisting(reason: string): void {
  if (!existsSync(OUTPUT_PATH)) {
    console.error(
      `[generate-locales] ${reason}\n` +
        `[generate-locales] Mà ${OUTPUT_PATH} cũng không tồn tại nên không có gì để dùng lại.\n` +
        `[generate-locales] File này phải được commit vào repo. Dừng build.`,
    );
    process.exit(1);
  }
  const current = readFileSync(OUTPUT_PATH, "utf8");
  const found = /export const locales[^=]*=\s*\[([^\]]*)\]/.exec(current);
  console.warn(
    `[generate-locales] ${reason}\n` +
      `[generate-locales] Giữ nguyên danh sách locale đã commit: [${found?.[1].trim() ?? "?"}]`,
  );
}

async function main(): Promise<void> {
  if (!hasDatabase()) {
    keepExisting("Thiếu DATABASE_URL nên không đọc được bảng `Locale`.");
    return;
  }

  let rows: LocaleRow[];
  try {
    rows = await prisma.locale.findMany({
      orderBy: [{ order: "asc" }, { code: "asc" }],
      select: { code: true, enabled: true, isDefault: true, order: true },
    });
  } catch (error) {
    // DB tạm thời không với tới được là sự cố hạ tầng, không phải lỗi nội dung.
    // Không biết danh sách thật thì dùng lại bản đã commit, đừng làm hỏng deploy.
    keepExisting(
      `Không đọc được bảng \`Locale\`: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  const enabled = rows.filter((row) => row.enabled);
  const defaults = enabled.filter((row) => row.isDefault);

  // Từ đây trở xuống là "đọc được DB và dữ liệu sai". Đây là lỗi nội dung có thể
  // sửa được ở CMS, và nếu để lọt thì site deploy ra sẽ hỏng theo cách khó hiểu
  // hơn nhiều — nên dừng build với thông báo chỉ rõ phải sửa gì.
  if (enabled.length === 0) {
    console.error(
      "[generate-locales] Bảng `Locale` không có dòng nào đang bật. " +
        "Site sẽ không có route nào. Bật ít nhất một locale rồi build lại.",
    );
    process.exit(1);
  }
  if (defaults.length !== 1) {
    console.error(
      `[generate-locales] Cần đúng một locale mặc định đang bật, đang có ${defaults.length}. ` +
        "Fallback ngôn ngữ sẽ không xác định. Sửa cờ `isDefault` rồi build lại.",
    );
    process.exit(1);
  }

  const locales = enabled.map((row) => row.code);
  const defaultLocale = defaults[0].code;

  writeFileSync(OUTPUT_PATH, renderModule(locales, defaultLocale), "utf8");
  console.log(
    `[generate-locales] Đã ghi ${locales.length} locale [${locales.join(", ")}], mặc định "${defaultLocale}".`,
  );
}

main().catch((error) => {
  console.error("[generate-locales] Lỗi không lường trước:", error);
  process.exit(1);
});
