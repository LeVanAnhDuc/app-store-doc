import type { ReactNode } from "react";
import "@/styles/globals.css";

/**
 * Layout gốc chỉ truyền `children` đi tiếp — **không** dựng `<html>`/`<body>`.
 *
 * Thẻ `lang` phải theo ngôn ngữ của đường dẫn, mà tham số `[locale]` chỉ đọc
 * được từ layout nằm bên trong `src/app/[locale]/`. Vì vậy `<html>`/`<body>`
 * nằm ở `src/app/[locale]/(public)/layout.tsx` (và sau này ở nhóm quản trị),
 * đúng khuôn mẫu "nhiều layout gốc" của App Router.
 *
 * File vẫn phải tồn tại: đây là nơi nạp `globals.css` cho toàn bộ cây route.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
