import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

import { ThemeToggle } from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "./ThemeScript";

const labels = {
  group: "Chủ đề giao diện",
  system: "Theo hệ thống",
  light: "Sáng",
  dark: "Tối",
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("ba nút, không phải hai — mất nút 'theo hệ thống' là mất đường về mặc định", () => {
    render(<ThemeToggle labels={labels} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    for (const name of [labels.system, labels.light, labels.dark]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("chưa chọn gì thì 'theo hệ thống' đang bật và <html> không mang data-theme", () => {
    render(<ThemeToggle labels={labels} />);
    expect(screen.getByRole("button", { name: labels.system })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("bấm 'tối' đặt data-theme=\"dark\" — đúng khối thứ ba của tokens.css", () => {
    render(<ThemeToggle labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.dark }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: labels.dark })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("bấm 'sáng' đặt data-theme=\"light\" để khối @media thôi khớp", () => {
    render(<ThemeToggle labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.light }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("lựa chọn tay được ghi vào localStorage", () => {
    render(<ThemeToggle labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.dark }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("quay về 'theo hệ thống' xoá cả thuộc tính lẫn khoá đã lưu", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeToggle labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.system }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("lựa chọn đã lưu được khôi phục ngay khi gắn vào cây", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: labels.light })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("giá trị rác trong localStorage không kéo theo chủ đề rác", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(screen.getByRole("button", { name: labels.system })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("cả ba là <button> thật, dùng được bằng bàn phím", () => {
    render(<ThemeToggle labels={labels} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
    }
  });

  it("nhóm có nhãn cho trình đọc màn hình", () => {
    render(<ThemeToggle labels={labels} />);
    expect(screen.getByRole("group", { name: labels.group })).toBeInTheDocument();
  });

  it("không emoji làm ký hiệu, không mã màu trực tiếp", () => {
    const { container } = render(<ThemeToggle labels={labels} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
    expect(container.innerHTML).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
