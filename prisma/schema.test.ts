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
