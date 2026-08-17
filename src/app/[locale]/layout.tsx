import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { locales } from "@/i18n/locales.generated";

/**
 * Layout của tầng `[locale]` — **không** dựng `<html>`/`<body>`.
 *
 * Nó tồn tại vì một lý do duy nhất: đặt ngôn ngữ của yêu cầu ở tầng cao nhất
 * còn đọc được `params.locale`. Nhờ vậy `not-found.tsx` cùng tầng lấy được
 * ngôn ngữ từ cache của next-intl thay vì phải đọc header — đọc header thì cả
 * `/vi` và `/vi/apps` rơi về kết xuất động, vì trang 404 cũng được dựng cùng
 * lúc với chúng.
 *
 * `<html>`/`<body>` vẫn nằm ở layout của từng nhóm route (`(public)`, và sau
 * này `(admin)`), đúng khuôn mẫu "nhiều layout gốc" của App Router.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ngôn ngữ lạ thì không đặt gì cả: next-intl lùi về locale mặc định, và
  // layout của nhóm route mới là nơi quyết định đó có phải trang 404 hay không.
  if (locales.includes(locale)) setRequestLocale(locale);

  return children;
}
