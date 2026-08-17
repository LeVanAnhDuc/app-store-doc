# Đang làm tới đâu

**Cập nhật:** 17.08.2026 · commit `ea922d9`

File này để mở ra đầu tiên khi bạn (hoặc một phiên Claude mới) quay lại dự án trên máy khác. Nó trả lời ba câu: đang ở đâu, việc gì đang chặn, và còn nợ những gì.

---

## 1. Đang ở đâu

Mã ứng dụng **đã hoàn thành**. 17 task trong [`superpowers/plans/2026-08-17-app-store-doc.md`](superpowers/plans/2026-08-17-app-store-doc.md) đã chạy hết.

| Kiểm tra | Trạng thái |
|---|---|
| `npm run test:run` | **108 xanh**, 6 skip |
| `npm run typecheck` | sạch |
| `npm run lint` | sạch |
| `npm run build` | chạy được **khi không có DB** |
| `npm run e2e` | 2 test bảo mật xanh, 2 test roundtrip skip |

**Chưa từng chạy thật:** migration, seed, deploy. Và **6 test skip** là 6 test quan trọng nhất — chúng kiểm tầng truy vấn và kiểm lời hứa trung tâm của hệ thống (*sửa nội dung trong CMS → trang công khai đổi mà không cần deploy*). Suite xanh ở trạng thái hiện tại **không** chứng minh hai điều đó.

Lý do duy nhất: chưa có thông tin đăng nhập Neon, Cloudflare R2, Vercel.

---

## 2. Dựng lại môi trường trên máy mới

```bash
git clone https://github.com/LeVanAnhDuc/app-store-doc.git
cd app-store-doc
npm install                 # postinstall tự chạy `prisma generate`
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm run dev                 # http://localhost:3000 → chuyển sang /vi
```

Cần Node 20+. Không có `DATABASE_URL` thì trang vẫn mở được nhưng trống nội dung — đúng như thiết kế, không phải lỗi.

**Bốn lệnh chạy được ngay, không cần thông tin đăng nhập nào:** `test:run`, `typecheck`, `lint`, `build`.

### Superdesign MCP không nằm trong repo

Nó là cấu hình cấp máy, cài ở `C:\Users\anhduc.levan\.claude\tools\superdesign-mcp` trên máy cũ. Máy mới phải cài lại:

```bash
git clone https://github.com/jonthebeef/superdesign-mcp-claude-code.git <thư-mục-tools>/superdesign-mcp
cd <thư-mục-tools>/superdesign-mcp && npm install && npm run build
claude mcp add superdesign -s user -- node "<đường-dẫn-tuyệt-đối>/dist/index.js"
```

Hai điều đã trả giá để biết: repo tên `superdesign-mcp-claude-code`, **không** phải `superdesign-mcp` (404). Và MCP thêm giữa phiên thì **tool chưa gọi được cho tới khi khởi động lại Claude Code** — mà khởi động lại là mất ngữ cảnh phiên đang chạy.

---

## 3. Việc đang chặn — làm theo thứ tự

Từng bước chi tiết ở [`operations.md`](operations.md). Bản rút gọn:

- [ ] **1.** Tạo Neon project → `DATABASE_URL`. Tạo branch `test` → `DATABASE_URL_TEST`
- [ ] **2.** Tạo bucket Cloudflare R2 + API token → 5 biến `R2_*`. Nhớ bật truy cập công khai cho bucket, nếu không `R2_PUBLIC_BASE_URL` vô dụng
- [ ] **3.** Sinh `ADMIN_PASSWORD_HASH` (hash bcrypt, **không** phải mật khẩu thô), `AUTH_SECRET`, `PREVIEW_SECRET`
- [ ] **4.** `npx prisma migrate deploy` — dùng chuỗi **direct** của Neon, không phải chuỗi `-pooler`
- [ ] **5.** `npx prisma db seed`
- [ ] **6.** Khai biến trên Vercel (Production + Preview). **Không** khai `ADMIN_PASSWORD` và `DATABASE_URL_TEST` trên Vercel
- [ ] **7.** Deploy, rồi chạy 5 bước kiểm tay ở `operations.md` mục 6.5
- [ ] **8.** Chạy 6 test đang skip: đặt `DATABASE_URL_TEST`, `npx prisma migrate reset --force`, rồi `npm run test:run` và `npm run e2e`
- [ ] **9.** Rà lại nội dung seed qua CMS — nó viết từ README công khai, **chưa kiểm chứng bằng mã nguồn**, phần "Chạy thử trong 5 phút" có thể sai số cổng hoặc tên script
- [ ] **10.** Nhập nội dung cho **Shorten Link** — repo private nên không seed được gì, bản ghi đang rỗng ở trạng thái `DRAFT`

---

## 4. Còn nợ — cố ý để lại, không phải quên

Xếp theo mức đáng làm.

### Nên làm sớm

- **Ảnh không đo được kích thước.** `uploadImage` không giải mã ảnh nên `Media.width`/`height` luôn `null`, thư viện chỉ hiện dung lượng. Cần một thư viện đọc header ảnh (`image-size` chẳng hạn) — chưa cài vì lúc dựng không được `npm install`.
- **`/admin/apps` sắp xếp bằng hai nút mũi tên**, chưa dùng `SortableList`. Lúc làm trang đó thì `SortableList` chưa tồn tại; giờ có rồi, gộp lại được.
- **`requireAdmin()` chuyển hướng tới `/admin/login` không có locale.** Middleware tự đoán bằng cookie `NEXT_LOCALE`, nên ai deep-link `/en/admin/apps` mà chưa có cookie sẽ rơi vào `/vi/admin/login`. Sửa thì phải dạy tầng auth biết về locale.
- **Điều hướng trên mobile chuyển xuống cuối trang** thay vì ngăn kéo bấm từ nút ☰ như mockup màn 07 — `TopBar` chưa có ngăn kéo.

### Quyết định còn treo

- **`DocPage.group` đang để `null` hết.** `group` không theo ngôn ngữ, nên đặt tên nhóm tiếng Việt sẽ lộ chữ Việt trong sidebar bản EN. Hai lối: thêm bảng dịch cho `group`, hoặc chấp nhận nhóm không có tên.
- **`DocPage("home")` đang `DRAFT` và `/docs/home` cố tình 404.** Trang chủ `/[locale]` hiện dựng từ chuỗi giao diện chứ không kết xuất bản ghi này. Publish nó sẽ đưa một liên kết chết vào chỉ mục tìm kiếm. Cần quyết: cho trang chủ đọc thật `DocPage("home")`, hay xoá bản ghi đó đi.
- **HTML thô trong markdown không được kết xuất.** Không có `<kbd>`, `<details>`, `<br>`. Đây là mặc định an toàn của `remark-rehype`; muốn mở thì cài `rehype-raw` + `allowDangerousHtml: true` rồi bỏ bước lọc HTML thô tự viết trong `src/lib/markdown.ts` — sanitize đã sẵn `strip: ['script']` cho tình huống đó.
- **`<pre>` mang thêm `data-code` chứa nguyên văn mã**, nên phần mã xuất hiện hai lần trong payload. Đổi lại được nút sao chép và mã vẫn lấy lại được sau khi tách token. Không muốn thì bỏ transformer và nới assertion trong `markdown.test.ts`.

### Đã ghi vào spec, chấp nhận lâu dài

- **Thêm một ngôn ngữ mới cần một lần redeploy.** Sửa **nội dung** thì không. Middleware chạy ở edge nên không chạm DB; danh sách locale sinh lúc `prebuild`. Xem spec §9.3.
- **`NEXT_PUBLIC_SITE_URL` hiện chỉ `playwright.config.ts` đọc.** Chưa có `sitemap.ts` hay canonical dùng nó.
- **Trang xem thử không trả được 403/503** mà không bật `experimental.authInterrupts`; hai nhánh từ chối kết xuất khối giải thích với mã 200.

### Việc lớn của tương lai

- **Đổi sang đăng nhập qua IDMS.** Chỉ cần thêm `src/server/auth/providers/idms-oauth.ts` cài đúng ba hàm `getCurrentUser` / `requireAdmin` / `signOut`. Không file nào khác phải sửa — đó là lý do lớp abstraction tồn tại. Trước khi làm, phải xác minh luồng OAuth trong `api-web-store-apps` đã chạy hoàn chỉnh; hiện **chưa app nào dùng thật**.
- **Trình soạn block-based.** Schema đã mở đường: `SectionTranslation.body` là JSON có discriminator `type`, hôm nay chỉ tồn tại `{"type":"markdown"}`. Thêm `{"type":"blocks"}` không phải migrate dữ liệu cũ.

---

## 5. Đọc gì khi sửa mã

| Việc | Tài liệu |
|---|---|
| Quy ước, ba ranh giới, bốn cái bẫy | [`../CLAUDE.md`](../CLAUDE.md) |
| **Dựng bất kỳ giao diện nào** | [`design/design-rules.md`](design/design-rules.md) — **bắt buộc** |
| Giao diện đã duyệt | [`design/mockups/index.html`](design/mockups/index.html) |
| Kiến trúc, data model, rủi ro | [`superpowers/specs/2026-08-17-app-store-doc-design.md`](superpowers/specs/2026-08-17-app-store-doc-design.md) |
| Hạ tầng, deploy, test cần DB | [`operations.md`](operations.md) |

**Năm cái bẫy đã trả giá để biết** (chi tiết trong `CLAUDE.md` và `operations.md`):

0. **Dấu `$` trong `.env` phải escape thành `\$`.** Next expand biến khi nạp `.env`, nên hash bcrypt (luôn chứa `$`) bị cắt từ 60 ký tự còn 48, và trang đăng nhập chỉ nói "sai mật khẩu". Nháy đơn **không** cứu được. Chi tiết `operations.md` §3.1.


1. **Server Action là endpoint HTTP riêng.** Bảo vệ `layout.tsx` **không** bảo vệ action. Mọi action ghi dữ liệu phải `await requireAdmin()` ở dòng đầu.
2. **`vitest` không typecheck.** Suite xanh không chứng minh `tsc` sạch. Luôn chạy `npm run typecheck` riêng.
3. **`prisma migrate diff` thất bại âm thầm** khi thiếu `prisma.config.ts`: in chuỗi rỗng, thoát **mã 0**, sinh file migration **0 byte** trông như thành công.
4. **Prisma CLI 7, vitest và tsx đều không đọc `.env`.** Chỉ Next đọc. Với ba cái kia phải đặt biến trong chính phiên shell.

Và một ràng buộc của máy Windows này: **vitest chạy song song hay flaky khi máy tải nặng.** Test fail chưa được coi là fail thật cho tới khi lặp lại được với `--maxWorkers=1`. Test component dùng `fireEvent`, không dùng `userEvent.type`.

---

## 6. Nhật ký quyết định

Mọi quyết định đáng kể đều nằm trong **thông điệp commit**, kèm lý do. `git log` là nhật ký thiết kế của dự án này:

```bash
git log --format='%h %s%n%b'
```

Mười hai commit, từ `2178c04` (mockup) tới `ea922d9` (tài liệu vận hành).
