import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Sai khác so với plan: kiểm tra thư mục tồn tại trước khi đọc. Các thư mục
// `src/components/*` được tạo ở task sau, chưa có khi task này chạy; không có
// lá chắn này thì test đổ vì ENOENT thay vì vì vi phạm ranh giới thật.
const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap(f => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
      })
    : [];

describe("ranh giới kiến trúc", () => {
  it("không component nào import prisma trực tiếp", () => {
    for (const f of walk("src/components")) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/from ["'].*server\/db["']|@prisma\/client/);
    }
  });
  it("không component nào import Auth.js trực tiếp", () => {
    for (const f of walk("src/components")) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/next-auth/);
    }
  });
  it("chỉ src/server/media biết SDK S3", () => {
    for (const f of [...walk("src/components"), ...walk("src/app")]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/@aws-sdk\/client-s3/);
    }
  });
});
