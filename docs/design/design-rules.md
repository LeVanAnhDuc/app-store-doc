# Quy tắc thiết kế — Ducker

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

Chỉ dùng biến CSS. Không viết mã màu trực tiếp trong component. Nguồn giá trị là `src/styles/tokens.css`, chép nguyên văn từ mockup đã duyệt [`mockups/v3/index.html`](mockups/v3/index.html).

```css
--bg  --surface  --fill  --fill-soft  --line  --line-soft
--ink  --ink-2  --muted  --accent  --eyebrow  --accent-bg
```

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--bg` | `#FDFDF7` | `#09090B` | nền trang |
| `--surface` | `#FFFFFF` | `#131316` | thẻ, hộp nổi |
| `--fill` | `#E4E4DE` | `#1E1916` | viên nền của mục đang chọn |
| `--fill-soft` | `#F1F1EA` | `#17171A` | nền chìm, thanh công cụ |
| `--line` | `#E2E2DA` | `#26262A` | đường kẻ chính |
| `--line-soft` | `#EDEDE5` | `#1C1C20` | đường kẻ phụ, kẻ trong danh sách |
| `--ink` | `#171717` | `#EDEDE9` | chữ chính |
| `--ink-2` | `#3E3E3E` | `#DEDEDE` | chữ hạng hai, mục điều hướng |
| `--muted` | `#6B6B63` | `#94948B` | chữ phụ, slug repo |
| `--accent` | `#8A4B24` | `#D4A27F` | liên kết, viền tiêu điểm |
| `--eyebrow` | `#171717` | `#D4A27F` | nhãn mono trên tiêu đề |
| `--accent-bg` | `#F2E9E1` | `#241C16` | nền nhấn |

`--surface-2` còn tồn tại như **bí danh của `--fill-soft`** cho mã cũ. Mã mới dùng `--fill-soft`.

**Bản sáng gần như phi màu.** Xám ngả **ấm** (ngả vàng nâu), không phải xám lạnh ngả tím của bản cũ, và cũng không phải `gray-*` của Tailwind. Nhấn mạnh đến từ **cỡ chữ, đậm nhạt và nền đầy** — không từ hue. Cam đất `--accent` gần như chỉ sống ở bản tối; ở bản sáng nó chỉ xuất hiện ở liên kết và số thứ tự.

**`--eyebrow` là token đổi vai theo chủ đề** — sáng là mực `#171717`, tối là cam đất `#D4A27F`. Đây là token duy nhất cố ý đổi vai chứ không chỉ đổi độ sáng, nên nó phải xuất hiện đủ ở **cả ba** khối chủ đề.

**Năm màu trạng thái chỉ dùng cho trạng thái.** Không bao giờ dùng để trang trí, phân biệt mục, hay làm cho trang "đỡ đơn điệu". Chúng mang thông tin thật.

| Trạng thái | Nghĩa | Token | Sáng | Tối |
|---|---|---|---|---|
| Lõi | Thuộc IDMS | `--st-core` | `#6B3F8C` | `#C0A2DC` |
| Đã nối | Đã tích hợp OAuth | `--st-connected` | `#2F6B4F` | `#79C6A0` |
| Độc lập | Không đi qua IDMS | `--st-standalone` | `#8A6A24` | `#D9B267` |
| Dự kiến nối | Chưa tích hợp | `--st-planned` | `#6B6B63` | `#94948B` |
| Riêng tư | Repo private | `--st-private` | `#9A3B3B` | `#E08B87` |

Mỗi màu trạng thái có một `-bg` đi kèm (`--st-core-bg`…) — xem `tokens.css`.

## 3. Chữ

**Không dùng webfont.** Không `next/font`, không Google Fonts, không nhúng `@font-face`. Lý do: bộ chữ phủ đủ dấu tiếng Việt đều nặng, mà trang docs tải chậm là mất lý do tồn tại.

```css
--sans:  "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont,
         "Helvetica Neue", Arial, sans-serif;
--serif: Constantia, "New York", "Iowan Old Style", Cambria, "Sitka Text",
         Charter, Palatino, "Palatino Linotype", "Times New Roman", serif;
--mono:  "Cascadia Mono", "Cascadia Code", ui-monospace, "SF Mono", Menlo,
         Consolas, "Liberation Mono", monospace;
```

### Georgia bị cấm trong stack serif

Georgia **không được xuất hiện** trong bất kỳ font stack nào của dự án. Nó thiếu glyph tiếng Việt dựng sẵn: `ế` render thành `ê` kèm dấu sắc rời lơ lửng lệch sang phải, `ằ` cũng vỡ tương tự. Trang tham chiếu dùng `Georgia, "Times New Roman", serif` — chép nguyên si thì **mọi tiêu đề tiếng Việt trên Windows đều vỡ**.

Đã render sáu phông serif hệ thống và nhìn tận mắt: Constantia, Cambria, Sitka Text, Palatino Linotype, Times New Roman, Book Antiqua đều dựng dấu đúng. `src/styles/tokens.test.ts` có test canh, đỏ ngay nếu Georgia quay lại.

### Tiêu đề là serif

- **`h1, h2, h3`: `font-family: var(--serif)`, `font-weight: 400`, `letter-spacing: 0`.** Trang tham chiếu đặt H1 ở 36px/400/normal. Đây là thứ tạo cảm giác "tài liệu" thay vì "bảng điều khiển". **Tracking âm cũ (`-.022em`) bị bỏ hẳn** — nó ép dấu tiếng Việt vào nhau.
- `h4` ở lại sans: nó đóng vai nhãn của thẻ, không phải tiêu đề bài.
- `line-height` tiêu đề: `--lh-head` = `1.25`.
- `text-wrap: balance` cho mọi tiêu đề.

### Thân bài và nhãn

- **Thân bài giữ sans, `font-size: 16px`, `line-height: 1.75`.** Leading là ràng buộc kỹ thuật, không phải sở thích: tiếng Việt có dấu chồng (ế ữ ộ ằ ể) và ở leading chật thì dấu mũ chạm chân dòng trên. Không hạ xuống dưới 1.7 ở bất kỳ chỗ nào chứa văn xuôi.
- **Nhãn, mã, dữ liệu**: mono, `text-transform: uppercase`, `letter-spacing: .09em–.15em`.
- Đo dòng văn xuôi tối đa `66ch` — phía hẹp so với các trang docs lớn (86–96 ký tự) vì tiếng Việt nhiều dấu, dòng dài mắt dễ lạc khi xuống dòng.

### Bậc cỡ — đo từ năm trang docs lớn

Không tự chọn số. Bậc dưới đây lấy từ `getComputedStyle` của đoạn văn dài nhất trên Claude Code docs, Stripe, Next.js, Tailwind và MDN — 4 trên 5 trang để thân bài ở **16px**.

```css
--t-2xs: 12px;  /* nhãn mono, chip        */
--t-xs:  13px;  /* chú thích              */
--t-sm:  14px;  /* mục lục, nút, ô nhập   */
--t-md:  16px;  /* THÂN BÀI               */
--t-lg:  18px;  /* mô tả một dòng         */
--t-xl:  22px;
--t-2xl: 26px;  /* H2                     */
--t-3xl: 36px;  /* H1                     */
--t-4xl: 44px;
```

Đừng chèn cỡ ngoài bậc. **Không văn xuôi nào xuống dưới 14px.** Ngoại lệ duy nhất được phép: nhãn **mono VIẾT HOA** ở 11–11.5px — chữ hoa mono đọc lớn hơn cỡ danh nghĩa của nó.

### Ngưỡng vùng bấm: `--tap`

```css
--tap: 28px;
```

**WCAG 2.2 SC 2.5.8 đòi vùng bấm tối thiểu 24×24 CSS px.** Token lấy 28 chứ không phải 24 để còn chỗ thở.

Áp `min-height` **và** `min-width` ≥ `var(--tap)` cho **mọi** phần tử bấm được: nút thứ tự, mục sidebar, ô nhập, nút, nút chuyển ngôn ngữ, ô tìm kiếm. Chỗ dễ hỏng nhất là bộ bốn nút thứ tự trong trang quản trị — bản cũ chỉ cao khoảng 18px, mà bấm nhầm `⤓` thay vì `↓` thì mục nhảy thẳng xuống cuối.

Nút vô hiệu phải đặt thuộc tính `disabled` thật và giảm `opacity` — **không** chỉ đổi màu.

Có e2e quét toàn trang và fail nếu còn phần tử bấm được nào dưới 24×24. Không dựa vào mắt người soát.

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
