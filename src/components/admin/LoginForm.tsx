"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import styles from "./LoginForm.module.css";

/** Kết quả một lần thử đăng nhập. `error` đã là câu tiếng người, không phải mã lỗi. */
export type LoginFormState = { error: string | null };

export type LoginFormProps = {
  /** Ngôn ngữ hiện tại; gửi kèm form để action dịch được thông báo lỗi. */
  locale: string;
  /** Server action xác thực. Nhận `FormData`, trả câu lỗi hoặc chuyển hướng. */
  action: (state: LoginFormState, formData: FormData) => Promise<LoginFormState>;
};

const EMPTY_STATE: LoginFormState = { error: null };

/**
 * Màn đăng nhập quản trị — hình khối chép từ `.m-login` trong mockup màn 06.
 *
 * Component này **không** biết gì về cơ chế xác thực: nó gửi email và mật khẩu
 * cho một server action rồi hiển thị câu trả lời. Đó là điều làm cho dòng chân
 * trang ("chỉ cần thay tệp providers/") thành sự thật chứ không phải lời hứa.
 *
 * Là client component vì phải hiện lỗi trả về mà không mất chữ đã gõ, và phải
 * khoá nút trong lúc đang gửi để không đốt hai lần trong quota 5 lần/15 phút.
 */
export function LoginForm({ locale, action }: LoginFormProps) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);

  return (
    <main className={styles.wrap}>
      <form className={styles.card} action={formAction}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            {t("brand.name").slice(0, 1)}
          </span>
          {t("brand.name")}
        </div>

        <h1 className={styles.title}>{t("admin.login.title")}</h1>
        <p className={styles.sub}>{t("admin.login.subtitle")}</p>

        {/* Action là endpoint riêng, không đọc được `params` của trang. */}
        <input type="hidden" name="locale" value={locale} />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="admin-login-email">
            {t("admin.login.email")}
          </label>
          <input
            className={styles.input}
            id="admin-login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="admin-login-password">
            {t("admin.login.password")}
          </label>
          <input
            className={styles.input}
            id="admin-login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {/* `role="alert"` để trình đọc màn hình đọc lỗi ngay, không cần dò lại form. */}
        {state.error ? (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? t("admin.login.submitting") : t("admin.login.submit")}
        </button>

        {/*
          Dòng chân trang ghi ý định đổi sang IDMS. Không phải trang trí: sáu
          tháng sau mở lại, đây là câu trả lời cho "vì sao màn này đơn giản vậy".
        */}
        <p className={styles.foot}>
          {t("admin.login.futureIdms")}
          <br />
          {t("admin.login.futureProviders")}
        </p>
      </form>
    </main>
  );
}
