// prisma/schema.test.ts
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const sql    = readFileSync("prisma/migrations/0001_init/migration.sql", "utf8");

describe("schema", () => {
  it("locale là dòng, không phải cột — mọi bảng dịch có unique (chủ, locale)", () => {
    for (const [model, fk] of [["AppTranslation","appId"],["FeatureTranslation","featureId"],
                               ["DocPageTranslation","docPageId"],["SectionTranslation","sectionId"]] as const) {
      const block = schema.slice(schema.indexOf(`model ${model} {`));
      expect(block.slice(0, block.indexOf("}"))).toContain(`@@unique([${fk}, locale])`);
    }
  });

  it("thân Section là Json để sau mở sang block-based", () => {
    const block = schema.slice(schema.indexOf("model SectionTranslation {"));
    expect(block.slice(0, block.indexOf("}"))).toMatch(/body\s+Json/);
  });

  it("xoá chủ sở hữu thì bản dịch xoá theo", () => {
    expect(schema.match(/onDelete: Cascade/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("migration có CHECK ràng buộc Section thuộc đúng một chủ", () => {
    expect(sql).toContain("section_single_owner");
    expect(sql).toMatch(/\("appId" IS NULL\)\s*<>\s*\("docPageId" IS NULL\)/);
  });
});

describe("cây điều hướng", () => {
  it("NavNode tự tham chiếu để lồng sâu tuỳ ý", () => {
    const block = schema.slice(schema.indexOf("model NavNode {"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toMatch(/parentId\s+String\?/);
    expect(body).toMatch(/children\s+NavNode\[\]/);
  });

  it("một App hoặc DocPage chỉ gắn vào đúng một nút — ép bằng @unique (I4)", () => {
    const block = schema.slice(schema.indexOf("model NavNode {"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toMatch(/appId\s+String\?\s+@unique/);
    expect(body).toMatch(/docPageId\s+String\?\s+@unique/);
  });

  it("nhãn nút chứa có bảng dịch riêng — thay cho DocPage.group không dịch được", () => {
    const block = schema.slice(schema.indexOf("model NavNodeTranslation {"));
    expect(block.slice(0, block.indexOf("\n}"))).toContain("@@unique([nodeId, locale])");
  });

  it("DocPage.group đã bị xoá", () => {
    const block = schema.slice(schema.indexOf("model DocPage {"));
    expect(block.slice(0, block.indexOf("\n}"))).not.toMatch(/^\s*group\s/m);
  });

  it("migration ép kind khớp với cột trỏ", () => {
    const sql2 = readFileSync("prisma/migrations/0002_nav_tree/migration.sql", "utf8");
    expect(sql2).toContain("nav_node_kind_matches_target");
  });

  it("migration chuyển group thành CONTAINER TRƯỚC khi drop cột", () => {
    const sql2 = readFileSync("prisma/migrations/0002_nav_tree/migration.sql", "utf8");
    const insert = sql2.indexOf('INSERT INTO "NavNode"');
    const drop = sql2.indexOf('DROP COLUMN "group"');
    expect(insert).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(insert);   // đảo thứ tự là mất sạch thông tin nhóm
  });
});
