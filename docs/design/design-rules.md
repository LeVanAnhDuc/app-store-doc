# Quy tắc thiết kế — app-store-doc

Bắt buộc với mọi phiên làm việc dựng UI cho dự án này. Mockup gốc: [`mockups/index.html`](mockups/index.html).

Khi có mâu thuẫn giữa tài liệu này và mockup, **mockup thắng** — nó là bản đã được duyệt. Sửa tài liệu cho khớp, đừng sửa mockup cho khớp tài liệu.

---

## 1. Đặt tên ứng dụng — không thương lượng

Tên hiển thị **viết hoa đầu từ, cách nhau bằng khoảng trắng**. Không bao giờ dùng slug (`kebab-case`, `snake_case`) làm tên hiển thị.

| Slug repo | Tên hiển thị |
|---|---|
| `web-store-apps` | Web Store Apps |
| `api-web-store-apps` | API Web Store Apps |
| `client-web-app-match-cv` | Match CV |
| `app-manage-gym` | Manage Gym |
| `app-AI-study-coach` | AI Study Coach |
| `app-calculate-badminton` | Calculate Badminton |
| `client-web-app-shorten-link` | Shorten Link |

Quy tắc rút gọn: bỏ các tiền tố hạ tầng (`app-`, `client-web-app-`, `client-`) vì chúng nói về kho mã, không nói về sản phẩm. Giữ `api-` khi bản thân nó là một dịch vụ riêng. Từ viết tắt giữ nguyên chữ hoa: **API**, **AI**, **CV**, **OAuth**, **IDMS**.

Slug repo vẫn được hiển thị, nhưng luôn ở vai trò **phụ**: chữ mono, cỡ nhỏ, màu `--muted`, đặt dưới hoặc bên cạnh tên hiển thị. Class `.m-slug` trong mockup.

Trong DB: `App.slug` là slug; `AppTranslation.name` là tên hiển thị. Không lấy slug làm nhãn dự phòng khi thiếu bản dịch — dùng cơ chế fallback ngôn ngữ.

## 2. Màu

Chỉ dùng biến CSS. Không viết mã màu trực tiếp trong component.

```css
--bg  --surface  --surface-2  --line  --line-soft  --ink  --muted  --accent  --accent-bg
```

| Token | Sáng | Tối |
|---|---|---|
| `--bg` | `#FBFBFD` | `#0B0B11` |
| `--surface` | `#FFFFFF` | `#13131B` |
| `--surface-2` | `#F4F4F8` | `#1A1A24` |
| `--line` | `#E3E3EC` | `#272733` |
| `--line-soft` | `#EEEEF4` | `#1F1F29` |
| `--ink` | `#15151E` | `#ECECF3` |
| `--muted` | `#6A6A7C` | `#8E8EA3` |
| `--accent` | `#4B2ED4` | `#9B7CFF` |
| `--accent-bg` | `#EEEBFC` | `#211A3D` |

Xám ngả lạnh về phía tím, **không** phải xám trung tính. Đừng thay bằng `gray-*` của Tailwind.

**Bốn màu trạng thái chỉ dùng cho trạng thái.** Không bao giờ dùng để trang trí, phân biệt mục, hay làm cho trang “đỡ đơn điệu”.

| Trạng thái | Nghĩa | Token |
|---|---|---|
| Lõi | Thuộc IDMS | `--st-core` |
| Đã nối | Đã tích hợp OAuth | `--st-connected` |
| Dự kiến nối | Chưa tích hợp | `--st-planned` |
| Độc lập | Không đi qua IDMS | `--st-standalone` |
| Riêng tư | Repo private | `--st-private` |

## 3. Chữ

**Không dùng webfont.** Không `next/font`, không Google Fonts, không nhúng `@font-face`. Lý do: bộ chữ phủ đủ dấu tiếng Việt đều nặng, mà trang docs tải chậm là mất lý do tồn tại.

```css
--sans: "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont,
        "Helvetica Neue", Arial, sans-serif;
--mono: "Cascadia Mono", "Cascadia Code", ui-monospace, "SF Mono", Menlo,
        Consolas, "Liberation Mono", monospace;
```

- **Thân bài `line-height: 1.75`.** Đây là ràng buộc kỹ thuật, không phải sở thích: tiếng Việt có dấu chồng (ế ữ ộ ằ ể) và ở leading chật thì dấu mũ chạm chân dòng trên. Không hạ xuống dưới 1.7 ở bất kỳ chỗ nào chứa văn xuôi.
- **Tiêu đề** `line-height: 1.18`, `letter-spacing: -.022em`. Tracking âm chỉ áp cho cỡ từ 24px trở lên — ở cỡ nhỏ nó ép dấu tiếng Việt.
- **Nhãn, mã, dữ liệu**: mono, `text-transform: uppercase`, `letter-spacing: .09em–.15em`, cỡ 10–11.5px.
- Đo dòng văn xuôi tối đa `66ch`.
- `text-wrap: balance` cho mọi tiêu đề.

Bậc cỡ: 11.5 · 13 · 15 · 17 · 21 · 28 · 38. Đừng chèn cỡ ngoài bậc.

## 4. Ba trạng thái giao diện sáng/tối

Bắt buộc, và là chỗ hay hỏng nhất:

```css
:root                                  { /* bảng màu SÁNG đầy đủ */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"])      { /* chỉ định nghĩa lại token */ }
}
:root[data-theme="dark"]               { /* chỉ định nghĩa lại token */ }
```

Không bao giờ khai báo màu **chỉ** bên trong khối `@media` hay `[data-theme]` — trạng thái “theo hệ thống” không có thuộc tính nào được đóng dấu, và trang sẽ render chữ của chủ đề này trên nền của chủ đề kia. `body` phải có `background` lấy từ token.

## 5. Hình khối

- Bo góc: `3px` (huy hiệu, chip), `5–6px` (ô nhập, nút, thẻ), `7–9px` (khối lớn). **Không** `rounded-lg` khắp nơi.
- Đường kẻ: `1px solid var(--line)`. Ưu tiên đường kẻ hơn đổ bóng.
- Đổ bóng: chỉ dùng cho vật thể thực sự nổi lên (khung cửa sổ, hộp thoại). Không dùng cho thẻ trong luồng.
- **Không gradient. Không glow. Không emoji làm ký hiệu mục.**
- Bố cục bằng `flex`/`grid` + `gap`, không dùng margin từng phần tử.
- Bảng, khối mã, sơ đồ: bọc trong `overflow-x: auto`.

## 6. Sơ đồ đấu nối — điểm nhấn của trang

Dựng bằng CSS thuần (border trên phần tử rỗng), **không** phải SVG vẽ tay hay thư viện.

Kiểu nét mang thông tin, không phải trang trí:

| Nét | Nghĩa |
|---|---|
| Liền, màu `--accent` | Đã nối OAuth |
| Đứt, màu `--st-planned` | Dự kiến nối |
| Đứt, màu `--st-private` | Repo riêng tư |
| Không có nét | Chạy độc lập |

Luôn kèm chú giải. Ngôn ngữ nét này lặp lại ở huy hiệu trạng thái trên toàn site — đổi ở một chỗ thì đổi ở mọi chỗ.

## 7. Nói thật về trạng thái

Trang phản ánh **hiện trạng**, không phải kiến trúc mong muốn. Tính đến 17.08.2026 chưa ứng dụng vệ tinh nào nối vào IDMS, và trang chủ hiển thị đúng như vậy.

Khi một trang mô tả thứ chưa tồn tại, phải có callout ghi rõ. Không bao giờ trình bày thiết kế dự kiến như thể đã chạy.

## 8. Chữ nghĩa trong giao diện

- Viết từ phía người dùng: “Bảng khởi chạy ứng dụng”, không phải “App entitlement dashboard”.
- Câu chủ động. Nút nói đúng việc nó làm: nút **Lưu** → thông báo **Đã lưu**.
- Một hành động giữ nguyên tên xuyên suốt luồng.
- Lỗi nói rõ chuyện gì xảy ra và sửa thế nào. Không xin lỗi, không mơ hồ.
- Màn hình trống là lời mời hành động, không phải chỗ than thở.
- Viết hoa kiểu câu, không viết hoa kiểu tiêu đề tiếng Anh.
- Số liệu dùng `font-variant-numeric: tabular-nums` khi xếp cột.

## 9. Sàn chất lượng

- Đáp ứng tới `375px`. Ba cột gập thành một; mục lục thành khối gập ở đầu bài.
- `:focus-visible` phải thấy được: `2px solid var(--accent)`, `outline-offset: 2px`.
- Tôn trọng `prefers-reduced-motion: reduce`.
- Chuyển động tiết chế. Không hiệu ứng cuộn, không phần tử bay vào.
- Thân trang không bao giờ cuộn ngang.

---

## Kiểm trước khi coi là xong

- [ ] Không có tên app dạng slug lộ ra chỗ tên hiển thị
- [ ] Không có mã màu viết trực tiếp; tất cả qua biến CSS
- [ ] Không có màu nào chỉ được khai báo trong khối `@media`/`[data-theme]`
- [ ] Xem được ở cả ba trạng thái: sáng, tối, và theo hệ thống
- [ ] Văn xuôi có `line-height` ≥ 1.7
- [ ] Không webfont
- [ ] Màu trạng thái không bị dùng để trang trí
- [ ] Bảng và khối mã cuộn ngang trong hộp riêng
- [ ] Tiêu điểm bàn phím nhìn thấy được ở mọi phần tử tương tác
