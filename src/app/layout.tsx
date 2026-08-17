import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "app-store-doc",
  description: "Tài liệu hệ sinh thái ứng dụng",
};

/**
 * Layout gốc tối thiểu. Task 7 thêm `src/app/[locale]/layout.tsx`
 * để đặt `lang` theo locale và bọc next-intl.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
