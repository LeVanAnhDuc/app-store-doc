"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import styles from "./AdminShell.module.css";

/** Số đếm cạnh từng mục điều hướng. Đếm mọi trạng thái, kể cả bản nháp. */
export type AdminCounts = {
  /** Số nút trong cây điều hướng, kể cả nút nháp. */
  nav: number;
  apps: number;
  docs: number;
  media: number;
  locales: number;
};

export type AdminShellProps = {
  locale: string;
  counts: AdminCounts;
  /** Email người đang đăng nhập, hiện ở chân cột trái. */
  email: string;
  /** Server action đăng xuất. Nó tự chuyển hướng về trang đăng nhập. */
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

/** Một mục trong cột điều hướng bên trái. */
type NavItem = {
  key: string;
  label: string;
  href: string;
  /** Bỏ trống thì mục không có số đếm — "Tổng quan" trong mockup không có. */
  count?: number;
  /**
   * `false` nghĩa là trang đích chưa được dựng, nên mục hiện ra nhưng không bấm
   * được. Đưa liên kết chết vào giao diện quản trị chỉ để "cho đủ mục" là nói dối
   * về hiện trạng — xem design-rules §7.
   *
   * Tính từ Task 16 cả năm mục đều có trang thật, nên chỗ này đang là `true` hết.
   * Cơ chế giữ lại vì mục thứ sáu nào đó cũng sẽ đi qua đúng trạng thái đó.
   */
  ready: boolean;
};

/**
 * Khung của mọi trang quản trị: cột điều hướng bên trái, vùng nội dung bên phải.
 * Hình khối chép từ `.m-admin` / `.m-adm-side` trong mockup màn 04.
 *
 * Là client component vì mục đang chọn suy ra từ đường dẫn hiện tại. Truyền
 * `current` từ mỗi trang cũng được, nhưng rồi Task 15 thêm một trang là một chỗ
 * nữa có thể quên truyền, và cột điều hướng sẽ im lặng chỉ sai mục.
 *
 * Thanh trên cùng **không** nằm ở đây: mỗi trang có tiêu đề và nút hành động
 * riêng. Dùng `AdminBar` + `AdminBody` bên trong `children`.
 */
export function AdminShell({
  locale,
  counts,
  email,
  signOutAction,
  children,
}: AdminShellProps) {
  const t = useTranslations();
  const pathname = usePathname() ?? `/${locale}/admin`;

  const root = `/${locale}/admin`;
  const items: NavItem[] = [
    { key: "overview", label: t("admin.nav.overview"), href: root, ready: true },
    {
      key: "navigation",
      label: t("admin.nav.navigation"),
      href: `${root}/navigation`,
      count: counts.nav,
      ready: true,
    },
    {
      key: "apps",
      label: t("admin.nav.apps"),
      href: `${root}/apps`,
      count: counts.apps,
      ready: true,
    },
    {
      key: "docs",
      label: t("admin.nav.docs"),
      href: `${root}/docs`,
      count: counts.docs,
      ready: true,
    },
    {
      key: "media",
      label: t("admin.nav.media"),
      href: `${root}/media`,
      count: counts.media,
      ready: true,
    },
    {
      key: "locales",
      label: t("admin.nav.locales"),
      href: `${root}/locales`,
      count: counts.locales,
      ready: true,
    },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <a className={styles.brand} href={root}>
          <span className={styles.brandMark} aria-hidden="true">
            {t("brand.name").slice(0, 1)}
          </span>
          {t("brand.name")}
        </a>

        <nav className={styles.nav} aria-label={t("admin.nav.label")}>
          {items.map((item) => {
            // "Tổng quan" chỉ sáng khi trùng khít; các mục khác sáng cho cả trang
            // con (`/admin/apps/web-store-apps` vẫn thuộc mục Ứng dụng).
            const current =
              item.key === "overview" ? pathname === item.href : pathname.startsWith(item.href);

            if (!item.ready) {
              return (
                <span key={item.key} className={styles.navItem} data-pending="true">
                  {item.label}
                  <span className={styles.srOnly}> — {t("admin.notReady")}</span>
                  {item.count === undefined ? null : (
                    <span className={styles.count}>{item.count}</span>
                  )}
                </span>
              );
            }

            return (
              <a
                key={item.key}
                className={styles.navItem}
                href={item.href}
                aria-current={current ? "page" : undefined}
              >
                {item.label}
                {item.count === undefined ? null : (
                  <span className={styles.count}>{item.count}</span>
                )}
              </a>
            );
          })}
        </nav>

        <form className={styles.account} action={signOutAction}>
          <span className={styles.accountLabel}>{t("admin.signedInAs")}</span>
          <span className={styles.accountEmail}>{email}</span>
          <button className={styles.signOut} type="submit">
            {t("admin.signOut")}
          </button>
        </form>
      </aside>

      <div className={styles.main}>{children}</div>
    </div>
  );
}

/** Thanh trên cùng của một trang quản trị: tiêu đề bên trái, hành động bên phải. */
export function AdminBar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.bar}>
      {children}
      {actions ? <div className={styles.barActions}>{actions}</div> : null}
    </div>
  );
}

/** Tiêu đề trang, đặt trong `AdminBar`. */
export function AdminTitle({ children }: { children: ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>;
}

/** Dòng phụ mono cạnh tiêu đề: số lượng, phạm vi, ghi chú ngắn. */
export function AdminScope({ children }: { children: ReactNode }) {
  return <span className={styles.scope}>{children}</span>;
}

/** Vùng nội dung dưới thanh trên cùng. */
export function AdminBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

/** Một khối nội dung có viền — `.m-block` của mockup. Task 15 dùng lại. */
export function AdminBlock({
  heading,
  scope,
  right,
  children,
}: {
  heading: ReactNode;
  scope?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.block}>
      <header className={styles.blockHead}>
        <h2 className={styles.blockHeading}>{heading}</h2>
        {scope ? <span className={styles.scope}>{scope}</span> : null}
        {right ? <div className={styles.blockRight}>{right}</div> : null}
      </header>
      <div className={styles.blockBody}>{children}</div>
    </section>
  );
}
