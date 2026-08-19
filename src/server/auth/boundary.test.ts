import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
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

  // Tầng auth buộc phải biết ngôn ngữ để chuyển hướng cho đúng (xem
  // `login-path.ts`), nhưng đó là một ngoại lệ có chủ đích và phải nằm gọn
  // trong **đúng một** file. Rải `getLocale()` khắp tầng auth là mở lại đúng
  // cái cửa mà `login-path.ts` sinh ra để đóng.
  it("trong tầng auth, chỉ login-path.ts biết next-intl", () => {
    // Quét mã nguồn, bỏ qua chính các file test — bản thân test này phải nhắc
    // tên thư viện thì mới tìm được nó.
    const sources = walk("src/server/auth").filter(f => !/\.test\.tsx?$/.test(f));
    expect(sources.length).toBeGreaterThan(1);

    for (const f of sources) {
      if (basename(f) === "login-path.ts") continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/next-intl/);
    }
  });
});
