// src/styles/tokens.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");

describe("design token", () => {
  it("định nghĩa bảng màu sáng đầy đủ ở :root trần", () => {
    const root = css.slice(css.indexOf(":root {"), css.indexOf("@media"));
    for (const name of ["--bg","--surface","--line","--ink","--muted","--accent",
                        "--st-core","--st-connected","--st-standalone","--st-planned","--st-private"]) {
      expect(root).toContain(name);
    }
  });

  it("khối dark bọc bằng :root:not([data-theme=\"light\"])", () => {
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it("có khối [data-theme=\"dark\"] để nút chuyển thắng cả hai chiều", () => {
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it("mọi token khai báo trong khối tối đều đã có ở :root trần", () => {
    const light = css.slice(0, css.indexOf("@media"));
    const darkNames = [...css.slice(css.indexOf("@media")).matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]);
    for (const n of new Set(darkNames)) expect(light).toContain(`${n}:`);
  });

  it("không dùng webfont", () => {
    expect(css).not.toMatch(/@font-face|fonts\.googleapis|next\/font/);
  });

  it("leading thân bài không dưới 1.7 vì dấu tiếng Việt chồng nhau", () => {
    const lh = Number(/--lh-body:\s*([\d.]+)/.exec(css)![1]);
    expect(lh).toBeGreaterThanOrEqual(1.7);
  });
});

describe("bậc cỡ và vùng bấm v3", () => {
  it("thân bài 16px — chuẩn của 4/5 trang docs lớn đã đo", () => {
    expect(/--t-md:\s*16px/.test(css)).toBe(true);
  });

  it("có token --tap cho ngưỡng bấm WCAG 2.2 SC 2.5.8", () => {
    const tap = Number(/--tap:\s*(\d+)px/.exec(css)![1]);
    expect(tap).toBeGreaterThanOrEqual(24);
  });

  it("có phông serif cho tiêu đề", () => {
    expect(css).toMatch(/--serif:/);
  });

  it("Georgia KHÔNG có trong stack serif — thiếu glyph tiếng Việt dựng sẵn", () => {
    const serif = /--serif:([^;]+);/.exec(css)![1];
    expect(serif).not.toMatch(/Georgia/i);
  });

  it("token đổi vai theo chủ đề: --eyebrow có ở cả ba khối", () => {
    expect(css.match(/--eyebrow:/g)!.length).toBe(3);
  });

  it("không còn màu tím của bản cũ", () => {
    expect(css).not.toMatch(/#4B2ED4|#9B7CFF/i);
  });
});

/* ------------------------------------------------------------------
   Bậc cỡ phải được TUÂN THỦ, không chỉ được khai báo.

   Các test trên chỉ đọc tokens.css: chúng chứng minh bậc cỡ tồn tại,
   không chứng minh component nào dùng nó. Sáu chỗ từng lọt qua đúng khe
   đó (AppCard.name 14.5px, FeatureGrid.name 13.5px, UploadDropzone.title
   12.5px, AppHero.slug 10.5px, TopBar.brandMark 10px, AdminShell.scope
   10px) — bậc cỡ xanh mà giao diện vẫn có chữ tự chế dưới sàn.
   ------------------------------------------------------------------ */

const SCALE = Object.fromEntries(
  [...css.matchAll(/(--t-[a-z0-9]+):\s*([\d.]+)px/g)].map((m) => [m[1], Number(m[2])]),
);

/** Cỡ chữ nhỏ nhất cho văn xuôi (design-rules §3). */
const FLOOR = 14;
/** Ngoại lệ duy nhất: nhãn mono VIẾT HOA đọc lớn hơn cỡ danh nghĩa. */
const MONO_UPPER_MIN = 11;

/** Mọi `*.module.css` dưới `src`, đường dẫn tương đối dùng dấu `/`. */
function moduleStylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return moduleStylesheets(full);
    return entry.name.endsWith(".module.css") ? [full] : [];
  });
}

/**
 * Nợ cũ — các tệp CHƯA được đưa về bậc cỡ, cố ý bỏ qua để test này không
 * chặn công việc khác. Danh sách chỉ được ngắn đi, không bao giờ dài thêm:
 * sửa một tệp thì xoá dòng của nó khỏi đây. Tệp MỚI không nằm trong danh
 * sách nên bị soi ngay từ dòng đầu.
 */
const KNOWN_DEBT = new Set<string>([
  "src/app/[locale]/(admin)/admin/(protected)/docs/page.module.css",
  "src/app/[locale]/(admin)/admin/(protected)/docs/[id]/DocPageEditor.module.css",
  "src/app/[locale]/(admin)/admin/(protected)/locales/LocaleTable.module.css",
  "src/app/[locale]/(admin)/admin/(protected)/locales/page.module.css",
  "src/app/[locale]/(admin)/admin/(protected)/media/page.module.css",
  "src/app/[locale]/(admin)/admin/(protected)/page.module.css",
  "src/app/[locale]/(public)/docs/[slug]/page.module.css",
  "src/components/admin/AppEditor.module.css",
  "src/components/admin/AppsTable.module.css",
  "src/components/admin/FeatureRow.module.css",
  "src/components/admin/LocaleSwitch.module.css",
  "src/components/admin/MarkdownEditor.module.css",
  "src/components/admin/MediaLibrary.module.css",
  "src/components/admin/MediaPicker.module.css",
  "src/components/admin/NavEditor.module.css",
  "src/components/admin/NavNodeRow.module.css",
  "src/components/admin/SectionRow.module.css",
  "src/components/admin/SectionsEditor.module.css",
  "src/components/admin/SortableList.module.css",
  "src/components/admin/TranslationMeter.module.css",
  "src/components/docs/FallbackNotice.module.css",
  "src/components/docs/NavTree.module.css",
  "src/components/docs/SearchDialog.module.css",
  "src/components/docs/SectionBody.module.css",
  "src/components/docs/Toc.module.css",
  "src/components/ui/Badge.module.css",
  "src/components/ui/Chip.module.css",
  "src/components/ui/CodeBlock.module.css",
  "src/components/ui/DataTable.module.css",
  "src/components/ui/WireDiagram.module.css",
]);

type Finding = { file: string; selector: string; size: number; why: string };

/**
 * Một khối khai báo trong cùng: regex này bỏ qua `@media { … }` bọc ngoài
 * vì thân khớp `[^{}]*` không chứa dấu ngoặc nào.
 */
function findings(file: string, source: string): Finding[] {
  const out: Finding[] = [];

  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const mono = /var\(--mono\)/.test(body);
    const upper = /text-transform:\s*uppercase/.test(body);

    for (const [, raw] of body.matchAll(/font-size:\s*([^;]+);/g)) {
      const token = /var\((--t-[a-z0-9]+)\)/.exec(raw);
      const size = token ? SCALE[token[1]] : Number(/^([\d.]+)px$/.exec(raw.trim())?.[1]);
      if (!Number.isFinite(size)) continue;

      const at = { file, selector: selector.trim().split("\n").pop()!.trim(), size };

      if (!Number.isInteger(size) && size !== 11.5) {
        out.push({ ...at, why: "cỡ lẻ ngoài bậc — bậc cỡ chỉ có số nguyên (11.5px là ngoại lệ mono)" });
      } else if (size < MONO_UPPER_MIN) {
        out.push({ ...at, why: `dưới ${MONO_UPPER_MIN}px — không cỡ nào được xuống thấp hơn thế` });
      } else if (size < MONO_UPPER_MIN + 1 && !(mono && upper)) {
        out.push({ ...at, why: "11–11.5px chỉ dành cho nhãn mono VIẾT HOA" });
      } else if (size < FLOOR && !mono) {
        out.push({ ...at, why: `dưới sàn ${FLOOR}px mà không phải nhãn mono — văn xuôi phải từ ${FLOOR}px` });
      }
    }
  }

  return out;
}

describe("component tuân thủ bậc cỡ", () => {
  it("không tệp nào dùng cỡ chữ ngoài bậc hoặc dưới sàn", () => {
    const bad = moduleStylesheets("src")
      .filter((file) => !KNOWN_DEBT.has(file))
      .flatMap((file) => findings(file, readFileSync(file, "utf8")))
      .map((f) => `${f.file} · ${f.selector} · ${f.size}px — ${f.why}`);

    expect(bad).toEqual([]);
  });

  /*
   * Cố tình KHÔNG khẳng định "mọi tệp trong danh sách nợ vẫn còn vi phạm".
   * Kiểm tra đó giữ danh sách khỏi mục rữa, nhưng nó đỏ ngay khi một phiên khác
   * dọn xong một tệp — và làm đỏ việc của người khác vì lý do không liên quan
   * tới thay đổi của họ là cái giá đắt hơn. Ở đây chỉ canh lỗi gõ sai đường dẫn:
   * một dòng gõ nhầm sẽ âm thầm miễn trừ đúng con số không tệp nào.
   */
  it("mọi đường dẫn trong danh sách nợ cũ đều có thật", () => {
    const all = new Set(moduleStylesheets("src"));
    expect([...KNOWN_DEBT].filter((file) => !all.has(file))).toEqual([]);
  });
});
