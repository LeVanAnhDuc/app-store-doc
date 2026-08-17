import { defaultLocale } from "@/i18n/locales.generated";
import messages from "@/i18n/messages/vi.json";

import styles from "./[locale]/status.module.css";

/**
 * Trang 404 cho đường dẫn không khớp route nào, kể cả ngoài `[locale]`.
 *
 * Vì sao cần file này dù đã có `[locale]/not-found.tsx`: URL không khớp
 * `[locale]` (ví dụ `/khong-ton-tai`) rơi vào ranh giới not-found ở gốc. Layout
 * gốc chỉ truyền `children` và không có `<html>`/`<body>`, nên thiếu file này
 * Next trả về trang 404 mặc định — HTML không có cả thẻ `<html>`.
 *
 * Không dùng `getLocale()`: ở đây chưa có `setRequestLocale`, gọi nó sẽ đọc
 * header và kéo mọi trang tĩnh cùng cây rơi về kết xuất động. Đường dẫn không
 * khớp route thì cũng không có ngôn ngữ để suy, nên dùng thẳng bản mặc định.
 */
export default function RootNotFound() {
  return (
    <html lang={defaultLocale}>
      <body>
        <main className={styles.wrap}>
          <p className={styles.code}>404</p>
          <h1 className={styles.title}>{messages.notFound.title}</h1>
          <p className={styles.body}>{messages.notFound.body}</p>
          <a className={styles.action} href={`/${defaultLocale}`}>
            {messages.notFound.backHome}
          </a>
        </main>
      </body>
    </html>
  );
}
