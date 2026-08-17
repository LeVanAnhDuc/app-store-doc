import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimit } from "./rate-limit";

beforeEach(() => __resetRateLimit());

describe("checkRateLimit", () => {
  it("cho phép 5 lần đầu", () => {
    for (let i = 0; i < 5; i++) expect(checkRateLimit("1.2.3.4", 0).allowed).toBe(true);
  });
  it("chặn lần thứ 6", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", 0);
    expect(checkRateLimit("1.2.3.4", 0).allowed).toBe(false);
  });
  it("mở lại sau 15 phút", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.2.3.4", 0);
    expect(checkRateLimit("1.2.3.4", 15 * 60_000 + 1).allowed).toBe(true);
  });
  it("đếm riêng theo từng IP", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.1.1.1", 0);
    expect(checkRateLimit("2.2.2.2", 0).allowed).toBe(true);
  });
  it("báo còn bao lâu mới thử lại được", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.2.3.4", 0);
    expect(checkRateLimit("1.2.3.4", 60_000).retryAfterSec).toBe(840);
  });
});
