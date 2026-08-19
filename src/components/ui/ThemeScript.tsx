/**
 * Script chống nháy chủ đề — đặt làm phần tử ĐẦU TIÊN trong `<body>` của cả hai
 * layout gốc (`(public)` và `(admin)`).
 *
 * Vì sao phải có: trang công khai render tĩnh trên máy chủ, mà máy chủ không
 * biết người dùng đã chọn gì. Nếu đợi React hydrate xong mới đặt `data-theme`
 * thì người chọn "sáng" trên máy đang để chế độ tối sẽ thấy một nháy tối —
 * khối `@media (prefers-color-scheme: dark)` trong `tokens.css` khớp ngay từ
 * byte đầu tiên và chỉ thôi khớp khi thuộc tính `data-theme="light"` xuất hiện.
 *
 * Script đồng bộ nằm đầu `<body>` chạy TRƯỚC khi trình duyệt vẽ khung hình đầu,
 * nên thuộc tính có mặt kịp lúc bảng màu được tính. Đặt trong `<head>` cũng
 * được, nhưng App Router dựng `<head>` giùm nên đầu `<body>` là chỗ khai báo
 * được rõ ràng nhất.
 *
 * Đây **không** phải React component có trạng thái: nó chỉ in ra một thẻ
 * `<script>`. Vì thế file này cố ý KHÔNG có `"use client"` — hằng
 * `THEME_STORAGE_KEY` phải nhập được từ cả server component lẫn client
 * component, mà mọi thứ export từ một module `"use client"` đều biến thành
 * tham chiếu client chứ không còn là chuỗi thật.
 */

/** Khoá `localStorage` giữ lựa chọn chủ đề. Chỉ ghi khi người dùng chọn tay. */
export const THEME_STORAGE_KEY = "ducker-theme";

/**
 * Chỉ đặt thuộc tính cho hai lựa chọn tay. "Theo hệ thống" cố ý KHÔNG đặt gì:
 * vắng `data-theme` chính là trạng thái thứ ba, và đó cũng là trạng thái mặc
 * định của người chưa từng bấm nút.
 *
 * `try/catch` vì `localStorage` ném lỗi khi trình duyệt chặn cookie bên thứ ba
 * trong iframe — mất chủ đề đã lưu thì đành, nhưng không được làm hỏng cả trang.
 */
const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(v==="dark"||v==="light"){document.documentElement.setAttribute("data-theme",v);}}catch(e){}})();`;

export function ThemeScript() {
  // `suppressHydrationWarning`: nội dung script do máy chủ in ra và React không
  // bao giờ chạy lại nó, nhưng cây DOM đã bị chính script sửa trước khi hydrate.
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
