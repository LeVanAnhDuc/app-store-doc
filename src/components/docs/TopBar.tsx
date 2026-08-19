"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { locales } from "@/i18n/locales.generated";
import { findTrail, firstLeafHref, type NavTreeNode } from "@/server/content/nav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SearchDialog } from "./SearchDialog";
import styles from "./TopBar.module.css";

export type TopBarProps = {
  locale: string;
  /**
   * **Toàn bộ** cây điều hướng đã publish, không chỉ nút gốc.
   *
   * Dải tab là các nút gốc, nhưng tab nào đang mở thì phải suy từ đường dẫn hiện
   * tại xuống tới lá (`findTrail`) — mà đường dẫn chỉ biết được ở phía client.
   * Cây rỗng (chưa có DB, hoặc chưa có nút gốc nào publish) thì không dựng dải
   * tab, và trang vẫn hiện bình thường.
   */
  tree?: NavTreeNode[];
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
 * Thanh trên cùng của mọi trang công khai: thương hiệu, ô tìm kiếm, nút chuyển
 * ngôn ngữ, nút chuyển chủ đề — rồi **dải tab dựng từ nút gốc của cây điều
 * hướng** (mockup v3 mục 02: `.m-mast` trên, `.m-tabs` dưới).
 *
 * Không còn mục nào viết cứng. Trước đây bốn mục "Hệ sinh thái · Ứng dụng ·
 * Hướng dẫn · API" nằm thẳng trong mã, nên thêm một nhóm nội dung trong CMS
 * không hiện ra đâu cả, mà hai mục cuối lại trỏ vào route không tồn tại.
 *
 * Là client component vì cả nút chuyển ngôn ngữ lẫn tab đang mở đều phải biết
 * đường dẫn hiện tại — chuyển ngôn ngữ mà văng về trang chủ là mất chỗ đang đọc.
 */
export function TopBar({ locale, tree = [] }: TopBarProps) {
  const t = useTranslations();
  const pathname = usePathname() ?? `/${locale}`;

  // Tab đang mở là nút gốc của đường từ gốc tới trang đang xem. Trang không nằm
  // trong cây (trang chủ, danh sách ứng dụng, bài chưa gắn vào cây) thì không tab
  // nào sáng — nói thật hơn là làm sáng bừa một tab.
  const activeTabId = findTrail(tree, pathname)[0]?.id;

  return (
    <header className={styles.header}>
      <div className={styles.mast}>
        <a className={styles.brand} href={`/${locale}`} aria-label={t("brand.home")}>
          <span className={styles.brandMark} aria-hidden="true">
            {t("brand.name").slice(0, 1)}
          </span>
          {t("brand.name")}
        </a>

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

          {/* Nhãn truyền xuống chứ không gọi `useTranslations` bên trong nút:
              `ThemeToggle` phải render được trần trong test, không provider. */}
          <ThemeToggle
            labels={{
              group: t("theme.label"),
              system: t("theme.system"),
              light: t("theme.light"),
              dark: t("theme.dark"),
            }}
          />
        </div>
      </div>

      {tree.length > 0 ? (
        <nav className={styles.tabs} aria-label={t("nav.label")}>
          {tree.map((node) => {
            /**
             * Nút chứa không có URL riêng (spec §5), nên tab trỏ thẳng tới lá đầu
             * tiên của nó — một cú nhảy ít hơn so với đi qua `/n/[id]`. Route đó
             * vẫn cần cho ai gõ thẳng hoặc chia sẻ địa chỉ của nút chứa, và là
             * đường dự phòng ở đây cho nhánh không còn lá nào publish (I2 cấm,
             * nhưng nếu vẫn xảy ra thì `/n/[id]` trả 404 chứ không trỏ đi đâu sai).
             */
            const href = firstLeafHref(node) ?? `/${locale}/n/${node.id}`;
            return (
              <a
                key={node.id}
                className={styles.tab}
                href={href}
                // Tab đang mở đánh dấu bằng aria-current; gạch chân là hệ quả.
                aria-current={node.id === activeTabId ? "page" : undefined}
              >
                {node.label}
              </a>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
