"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { locales } from "@/i18n/locales.generated";
import { SearchDialog } from "./SearchDialog";
import styles from "./TopBar.module.css";

export type TopBarNavItem = {
  /** Khoá ổn định để React nhận diện, không hiện ra giao diện. */
  key: string;
  href: string;
  label: string;
  /** `true` thì chỉ sáng khi trùng khít, dùng cho trang chủ. */
  exact?: boolean;
};

export type TopBarProps = {
  locale: string;
  /**
   * Điều hướng chính. Bỏ trống thì dùng bốn mục của mockup màn 01.
   * Task 13 có thể truyền danh sách dựng từ `listNav()` để nhãn khớp nội dung thật.
   */
  items?: TopBarNavItem[];
};

/** Đổi phần locale ở đầu đường dẫn, giữ nguyên phần còn lại. */
function withLocale(pathname: string, nextLocale: string): string {
  const segments = pathname.split("/");

  // ["", "vi", "apps", …] — chỉ thay khi đoạn đầu đúng là một locale đã biết,
  // để đường dẫn lạ không bị cắt mất đoạn đầu.
  if (segments.length > 1 && locales.includes(segments[1])) {
    segments[1] = nextLocale;
    return segments.join("/") || "/";
  }

  return pathname === "/" ? `/${nextLocale}` : `/${nextLocale}${pathname}`;
}

/**
 * Thanh trên cùng của mọi trang công khai: thương hiệu, điều hướng, ô tìm kiếm
 * và nút chuyển ngôn ngữ. Hình khối chép từ `.m-top` trong mockup đã duyệt.
 *
 * Là client component vì nút chuyển ngôn ngữ phải biết đường dẫn hiện tại —
 * chuyển ngôn ngữ mà văng về trang chủ là mất chỗ đang đọc.
 */
export function TopBar({ locale, items }: TopBarProps) {
  const t = useTranslations();
  const pathname = usePathname() ?? `/${locale}`;

  const navItems: TopBarNavItem[] = items ?? [
    { key: "ecosystem", href: `/${locale}`, label: t("nav.ecosystem"), exact: true },
    { key: "apps", href: `/${locale}/apps`, label: t("nav.apps") },
    { key: "guides", href: `/${locale}/docs`, label: t("nav.guides") },
    { key: "api", href: `/${locale}/docs/api`, label: t("nav.api") },
  ];

  return (
    <header className={styles.top}>
      <a className={styles.brand} href={`/${locale}`} aria-label={t("brand.home")}>
        <span className={styles.brandMark} aria-hidden="true">
          {t("brand.name").slice(0, 1)}
        </span>
        {t("brand.name")}
      </a>

      <nav className={styles.nav} aria-label={t("nav.label")}>
        {navItems.map((item) => {
          const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <a
              key={item.key}
              className={styles.navLink}
              href={item.href}
              // Trang hiện tại đánh dấu bằng aria-current, màu chỉ là hệ quả.
              aria-current={current ? "page" : undefined}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className={styles.right}>
        <SearchDialog locale={locale} />

        <nav className={styles.langs} aria-label={t("locale.label")}>
          {locales.map((code) => (
            <a
              key={code}
              className={styles.lang}
              href={withLocale(pathname, code)}
              hrefLang={code}
              aria-current={code === locale ? "true" : undefined}
            >
              {code.toUpperCase()}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
