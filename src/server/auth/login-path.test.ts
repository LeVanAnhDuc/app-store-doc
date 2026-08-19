import { describe, it, expect, vi, beforeEach } from "vitest";

import { defaultLocale, locales } from "@/i18n/locales.generated";

const getLocale = vi.hoisted(() => vi.fn());
vi.mock("next-intl/server", () => ({ getLocale }));

import { LOGIN_PATH, localizedLoginPath, loginRedirectPath } from "./login-path";

beforeEach(() => {
  getLocale.mockReset();
});

describe("localizedLoginPath", () => {
  it("giữ nguyên ngôn ngữ đang dùng", () => {
    expect(localizedLoginPath("en")).toBe("/en/admin/login");
    expect(localizedLoginPath("vi")).toBe("/vi/admin/login");
  });

  it("ngôn ngữ lạ, rỗng hay thiếu đều lùi về mặc định", () => {
    for (const bad of ["fr", "", "  ", "../en", null, undefined]) {
      expect(localizedLoginPath(bad)).toBe(`/${defaultLocale}${LOGIN_PATH}`);
    }
  });

  it("không bao giờ trả ra đường dẫn trần — trần là đẩy việc đoán về middleware", () => {
    for (const input of [...locales, "fr", null, undefined]) {
      expect(localizedLoginPath(input)).not.toBe(LOGIN_PATH);
      expect(localizedLoginPath(input)).toMatch(
        new RegExp(`^/(${locales.join("|")})${LOGIN_PATH}$`),
      );
    }
  });
});

describe("loginRedirectPath", () => {
  it("lấy ngôn ngữ của request hiện tại", async () => {
    getLocale.mockResolvedValue("en");
    await expect(loginRedirectPath()).resolves.toBe("/en/admin/login");
  });

  it("`getLocale` ném thì lùi về mặc định chứ không để lỗi nổi lên", async () => {
    // Ném ở đây mà không bắt sẽ biến một lệnh chuyển hướng thành trang 500 —
    // tức là mất luôn lớp bảo vệ nhìn thấy được của CMS.
    getLocale.mockRejectedValue(new Error("ngoài phạm vi request"));
    await expect(loginRedirectPath()).resolves.toBe(`/${defaultLocale}${LOGIN_PATH}`);
  });
});
