"use client";

import { useEffect, useLayoutEffect, useState, type ReactElement } from "react";

import { THEME_STORAGE_KEY } from "./ThemeScript";
import styles from "./ThemeToggle.module.css";

/**
 * Ba trạng thái, không phải hai. `tokens.css` có ba khối chủ đề, và "theo hệ
 * thống" là khối đông người dùng nhất — làm nút bật/tắt hai trạng thái là cắt
 * mất đường về mặc định.
 */
export type ThemeChoice = "system" | "light" | "dark";

/**
 * Nhãn truyền từ ngoài vào, **không** gọi `useTranslations` bên trong: component
 * phải render được trần, không có `NextIntlClientProvider`. Cùng lối với
 * `OrderControls`, `AppCard`, `AppHero`.
 */
export type ThemeToggleLabels = Record<ThemeChoice, string> & {
  /** Nhãn của cả nhóm ba nút, đọc cho trình đọc màn hình. */
  group: string;
};

export type ThemeToggleProps = {
  labels: ThemeToggleLabels;
};

/** Đọc lựa chọn đã lưu. Giá trị lạ hoặc `localStorage` bị chặn đều về "system". */
function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * "Theo hệ thống" là **xoá** thuộc tính, không phải đặt một giá trị thứ ba:
 * khối `@media` trong `tokens.css` bọc bằng `:root:not([data-theme="light"])`,
 * nên chỉ khi không có thuộc tính nào thì cả hai khối tối mới nhường quyền cho
 * chế độ của hệ điều hành.
 */
function applyChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/**
 * `useLayoutEffect` chạy TRƯỚC khi trình duyệt vẽ, `useEffect` chạy sau. Chênh
 * lệch đó chính là một khung hình sai màu, nên ở đây phải là layout effect.
 *
 * Chọn theo `typeof window` ở tầng module — gọi thẳng `useLayoutEffect` trong
 * một client component được render trên máy chủ sẽ in cảnh báo của React.
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Ký hiệu vẽ tay bằng SVG — design-rules §5 cấm dùng emoji làm ký hiệu. */
const ICONS: Record<ThemeChoice, ReactElement> = {
  system: (
    <>
      <rect x="2" y="3.2" width="12" height="8.6" rx="1.5" />
      <path d="M6.2 14h3.6" />
    </>
  ),
  light: (
    <>
      <circle cx="8" cy="8" r="2.9" />
      <path d="M8 1.1v1.5M8 13.4v1.5M1.1 8h1.5M13.4 8h1.5M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" />
    </>
  ),
  dark: <path d="M13.4 9.7A5.8 5.8 0 0 1 6.3 2.6 5.9 5.9 0 1 0 13.4 9.7Z" />,
};

const CHOICES: ThemeChoice[] = ["system", "light", "dark"];

/**
 * Nút chuyển chủ đề — ba nút dính nhau, cùng hình khối với nút chuyển ngôn ngữ
 * trong `TopBar`.
 *
 * Cặp đôi với `ThemeScript`: script đặt sẵn `data-theme` trước khi trang được
 * vẽ, còn component này (a) hiện đúng nút nào đang chọn sau khi hydrate, và
 * (b) **đặt lại** thuộc tính trong layout effect. Vế (b) là bảo hiểm cho cái
 * bẫy đã ghi trong nhật ký dự án: nếu React gỡ mất thuộc tính do script gán khi
 * hydrate `<html>`, thì layout effect gán lại ngay trong cùng một lượt commit,
 * tức vẫn trước khung hình đầu tiên.
 */
export function ThemeToggle({ labels }: ThemeToggleProps) {
  // Máy chủ luôn render "system": nó không đọc được `localStorage`. Nói dối một
  // giá trị khác chỉ đổi nháy màu thành nháy trạng thái nút.
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useIsomorphicLayoutEffect(() => {
    const stored = readChoice();
    setChoice(stored);
    applyChoice(stored);
  }, []);

  function pick(next: ThemeChoice) {
    setChoice(next);
    applyChoice(next);
    try {
      // "Theo hệ thống" xoá khoá thay vì ghi chuỗi "system": khoá vắng mặt và
      // người dùng chưa từng chọn là cùng một trạng thái, đừng để thành hai.
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Không lưu được thì lựa chọn chỉ sống hết phiên này. Vẫn hơn là văng lỗi.
    }
  }

  return (
    <div className={styles.group} role="group" aria-label={labels.group}>
      {CHOICES.map((value) => (
        <button
          key={value}
          type="button"
          className={styles.button}
          // `aria-pressed` chứ không phải `aria-current`: đây là ba nút bật/tắt
          // loại trừ nhau, không phải ba liên kết điều hướng.
          aria-pressed={choice === value}
          aria-label={labels[value]}
          title={labels[value]}
          onClick={() => pick(value)}
        >
          <svg
            className={styles.icon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {ICONS[value]}
          </svg>
        </button>
      ))}
    </div>
  );
}
