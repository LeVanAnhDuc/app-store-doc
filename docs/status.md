# Ducker — đang làm tới đâu

**Cập nhật:** 19.08.2026 · sau Task 9 của [kế hoạch cây điều hướng](superpowers/plans/2026-08-18-ducker-navigation-tree.md), cộng hai lượt trả nợ

File này để mở ra đầu tiên khi bạn (hoặc một phiên Claude mới) quay lại dự án trên máy khác. Nó trả lời ba câu: đang ở đâu, việc gì đang chặn, và còn nợ những gì.

---

## 1. Đang ở đâu

Hai kế hoạch đã chạy hết: 17 task trong [`superpowers/plans/2026-08-17-app-store-doc.md`](superpowers/plans/2026-08-17-app-store-doc.md), và 9 task trong [`superpowers/plans/2026-08-18-ducker-navigation-tree.md`](superpowers/plans/2026-08-18-ducker-navigation-tree.md) — cây điều hướng do CMS quản, giao diện v3, đổi tên Ducker.

Số dưới đây là **kết quả chạy thật ngày 19.08.2026** trên Postgres cục bộ (Docker `app-store-doc-pg`, cổng 15433), không phải con số nhớ lại.

| Kiểm tra | Trạng thái |
|---|---|
| `npm run test:run` | **242 xanh**, 26 skip (33/34 file) |
| `DATABASE_URL_TEST=... npx vitest run src/server/content --maxWorkers=1` | **69 xanh**, 0 skip |
| `npm run typecheck` | sạch |
| `npm run lint` | sạch |
| `npm run build` | thành công (và vẫn chạy được khi không có DB) |
| `npm run e2e` | **14 xanh**, 2 skip (hai test roundtrip cần `DATABASE_URL_TEST`) |
| `DATABASE_URL_TEST=... npm run e2e` | **16 xanh**, 0 skip |

21 test skip còn lại đều là test cần DB nằm trong `*.db.test.ts`; đặt `DATABASE_URL_TEST` là chúng chạy — dòng thứ hai của bảng là bằng chứng.

**Đã chạy thật:** `prisma migrate deploy` (cả `0001_init` và `0002_nav_tree`), `prisma db seed`, và **xem tận mắt** 5 màn × 3 trạng thái chủ đề × 2 mốc rộng. Lời hứa trung tâm — *sửa nội dung trong CMS → trang công khai đổi mà không cần deploy* — đã được `e2e/content-roundtrip.spec.ts` chứng minh trên DB thật.

**Chưa từng chạy:** deploy. Lý do duy nhất: chưa có thông tin đăng nhập Neon, Cloudflare R2, Vercel.

⚠️ **`prisma db seed` không gọi `revalidateTag`** (không thể: nó chạy ngoài request của Next). Nên sau khi seed, `unstable_cache` trong `.next/cache` vẫn phục vụ cây điều hướng cũ, và `next build` **đọc lại đúng cache đó** — trang dựng ra hiện dải tab của lần seed trước. Đã mất một lượt kiểm vì chuyện này. Sau mỗi lần seed: `rm -rf .next` rồi mới build.

⚠️ **Cùng loại bẫy, nguồn khác: ghi từ một tiến trình server khác cũng không lan sang.** `npm run e2e` dựng server riêng ở cổng 3210; nó ghi DB rồi tự gọi `revalidateTag`, nhưng dev server ở cổng 3000 **không hề biết** — hai tiến trình, hai cache. Tệ hơn, cache nằm trên đĩa trong `.next/cache` nên **khởi động lại dev server cũng không hết**. Đã mất một lượt truy lỗi vì chuyện này: DB hiện giá trị đúng mà trang vẫn hiện giá trị cũ. Quy tắc chung: **nội dung đổi mà không đi qua chính server đang chạy thì phải `rm -rf .next`** — dù nguồn là `db seed`, một bộ e2e, hay `psql` gõ tay.

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

Để chạy cả các test cần DB, container `app-store-doc-pg` đã có sẵn **hai** database: `app_store_doc` (dev) và `app_store_doc_test`. `.env` đang để `DATABASE_URL_TEST=` rỗng nên chúng skip mặc định; muốn chạy thì truyền biến ngay trong lệnh:

```bash
DATABASE_URL_TEST="postgresql://postgres:devpass@localhost:15433/app_store_doc_test" npx vitest run src/server/content --maxWorkers=1
```

Database test phải được `migrate deploy` **và** `db seed` trước lần chạy đầu: `queries.db.test.ts` đọc dữ liệu seed chứ không tự dựng.

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

Từng bước chi tiết ở [`operations.md`](operations.md). Bản rút gọn — ba bước đã làm được cục bộ, phần còn lại vẫn chờ thông tin đăng nhập:

- [ ] **1.** Tạo Neon project → `DATABASE_URL`. Tạo branch `test` → `DATABASE_URL_TEST`
- [ ] **2.** Tạo bucket Cloudflare R2 + API token → 5 biến `R2_*`. Nhớ bật truy cập công khai cho bucket, nếu không `R2_PUBLIC_BASE_URL` vô dụng
- [ ] **3.** Sinh `ADMIN_PASSWORD_HASH` (hash bcrypt, **không** phải mật khẩu thô), `AUTH_SECRET`, `PREVIEW_SECRET`
- [x] **4.** `npx prisma migrate deploy` — **đã chạy** trên Postgres cục bộ, cả hai migration. Trên Neon nhớ dùng chuỗi **direct**, không phải chuỗi `-pooler`
- [x] **5.** `npx prisma db seed` — **đã chạy**, dựng 15 nút điều hướng (3 nút gốc), chạy lại nhiều lần không nhân đôi
- [ ] **6.** Khai biến trên Vercel (Production + Preview). **Không** khai `ADMIN_PASSWORD` và `DATABASE_URL_TEST` trên Vercel
- [ ] **7.** Deploy, rồi chạy 5 bước kiểm tay ở `operations.md` mục 6.5
- [x] **8.** Chạy các test từng skip — **đã chạy** cục bộ: 64 xanh ở `src/server/content`, 12 xanh ở e2e
- [ ] **9.** Rà lại nội dung seed qua CMS — nó viết từ README công khai, **chưa kiểm chứng bằng mã nguồn**, phần "Chạy thử trong 5 phút" có thể sai số cổng hoặc tên script
- [ ] **10.** Nhập nội dung cho **Shorten Link** — repo private nên không seed được gì, bản ghi đang rỗng ở trạng thái `DRAFT`

### Hai cái bẫy khi chạy lại các bước trên

**`prisma migrate reset` bị Prisma 7 chặn với tác nhân AI.** Lệnh in ra một cảnh báo dài và thoát, đòi biến `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` mang **nguyên văn câu đồng ý của chính người dùng**. Một phiên Claude không tự cấp được sự đồng ý đó. Cách đi vòng không cần reset: tạo một database rỗng khác trong cùng container, `migrate deploy` + `db seed` lên đó rồi đếm, xong thì `DROP DATABASE`.

**Playwright chạy trên cổng riêng 3210, không phải 3000.** Xem chú thích trong `playwright.config.ts`.

---

## 4. Còn nợ — cố ý để lại, không phải quên

Xếp theo mức đáng làm.

### Đã trả trong đợt cây điều hướng
- ~~**Không có nút chuyển chủ đề.**~~ `ThemeToggle` có ba nút (theo hệ thống · sáng · tối) trong `TopBar` và `AdminShell`. Khối `:root[data-theme="dark"]` nay là mã sống. Ba trạng thái chứ không phải hai: bật/tắt hai trạng thái sẽ **mất đường về "theo hệ thống"**, mà đó là mặc định và là chỗ đa số người dùng đang ở. Chống nháy màu bằng script đồng bộ đặt làm con đầu tiên của `<body>` — đã chứng minh bằng thí nghiệm đối chứng, xem mô tả trong `ThemeScript.tsx`.
- ~~**Điều hướng mobile nằm ở cuối trang.**~~ `NavDrawer` mở từ nút `☰` đặt **ngay sau tagline**, dùng lại chính `NavTree` của cột trái. Đóng bằng `Esc` và bấm ra ngoài, trả tiêu điểm về nút mở, có bẫy tiêu điểm và khoá cuộn thân trang. Đo thật ở 375×667: nút ở `y=398`, đáy `442` — thấy được **không cần cuộn**, trong khi bài dài 2232px. Một chi tiết phải sửa kéo theo: `NavTree` nay render **hai lần trên một trang**, nên id danh sách con phải gắn `useId()`, nếu không `aria-controls` của bản này trỏ vào phần tử của bản kia.
- ~~**`requireAdmin()` chuyển hướng mất locale.**~~ Nay đá về `/{locale}/admin/login`. ⚠️ Bản trước của dòng này **mô tả lỗi sai**: nó nói deep-link `/en/admin/apps` sẽ rơi vào `/vi/admin/login`. Đo thật thì với một lần **điều hướng trong trình duyệt**, `syncCookie` của next-intl kịp gắn `NEXT_LOCALE` lên chính cái 307 đó nên middleware đoán đúng — chỉ tốn hai chặng. Lỗi thật chỉ lộ ở **request nền** (soft navigation, server action, revalidate), nơi `syncCookie` cố ý bỏ qua: khi đó `location: /admin/login` rồi middleware đá tiếp sang `/vi/...` dù người dùng đang ở `/en`. Cách sửa: một file duy nhất `src/server/auth/login-path.ts` biết i18n, **có test ranh giới canh** rằng không file nào khác trong tầng auth import `next-intl`. Không đổi chữ ký `requireAdmin()` — hơn hai mươi chỗ gọi, quên truyền một chỗ là lỗi im lặng đúng bằng lỗi đang sửa.
- ~~**`/admin/locales` không sắp xếp lại được.**~~ `reorderLocales(codes)` nhận **mã** chứ không phải id (`Locale.code` là khoá chính), ghi `order` liên tục `0..n-1` trong transaction, và gọi `assertSingleDefaultLocale` trước khi commit dù đổi thứ tự không thể phá bất biến đó — quy tắc là "mọi phép ghi vào `Locale` đều rời transaction với bảng hợp lệ", không phải "chỉ phép ghi nào có nguy cơ mới kiểm". Thứ tự này **có tác dụng thật**: `scripts/generate-locales.ts` đọc nó để sinh `locales.generated.ts`, tức là nó quyết định thứ tự nút chuyển ngôn ngữ trên trang công khai — nhưng chỉ đổi sau lần deploy kế tiếp, đúng cảnh báo §9.3.
- ~~**Ảnh không đo được kích thước.**~~ `readImageDimensions` (dùng `image-size`) đo từ header, gọi sau khi `detectImageMime` xác nhận là ảnh thật và trước khi đẩy lên R2 — cùng buffer đã có trong bộ nhớ. **Không bao giờ ném**: đo hỏng thì `null` và ảnh vẫn lên, vì số đo là thứ "biết thì hay" chứ không phải điều kiện nhận ảnh. Đo thật trước khi viết mã: `image-size` suy được kích thước SVG từ `viewBox` kể cả khi `width="100%"`, nhưng **ném lỗi** với dữ liệu rác và buffer rỗng.

- ~~**`OrderControls` mới dùng ở một chỗ.**~~ Spec §15 đòi bốn **chỗ dùng**: nút gốc, nút con, `Feature`, `Section`. Hai chỗ đầu do `NavEditor`/`NavNodeRow`, hai chỗ sau do `SortableList` (dùng trong `AppEditor` và `SectionsEditor`). `AppsTable` cũng đổi từ hai mũi tên tự chế sang `OrderControls`. `SortableList` được **thêm** bộ nút chứ không bỏ kéo thả và đường bàn phím — ba lối vào cùng tồn tại, vì đường bàn phím cũ vô hình (phải đọc `aria-label` mới biết có) và chỉ đi được một bậc.
- ~~**Cỡ chữ ngoài bậc ở sáu chỗ.**~~ Đã đưa về bậc. Kèm theo có test quét toàn bộ `*.module.css` — nó **đỏ đúng sáu chỗ đó trước khi sửa**, nên không phải lời hứa suông.
- ~~**Chữ thương hiệu chưa theo mockup.**~~ `TopBar`/`AdminShell`/`LoginForm` nay serif 400 cỡ 23px (`--t-brand`), masthead đúng 62px. Đã đo thật ở 375px: thương hiệu 106 + tìm kiếm 72 + ngôn ngữ 60 + gap = 258px trong lòng 343px, nên **bỏ `flex-wrap`** đi, một hàng, không tràn.
- ~~**Trình soạn cây không hiện trạng thái nút.**~~ Hàng của nút `DRAFT`/`ARCHIVED` có huy hiệu riêng, màu `--st-planned` (không thêm màu mới).
- ~~**`DocPage.group` đang để `null` hết.**~~ Cột đã bị xoá ở `0002_nav_tree`. Nhóm sidebar giờ là `NavNode` loại `CONTAINER`, nhãn nằm trong `NavNodeTranslation` nên dịch được từng ngôn ngữ. Quyết định treo lâu nhất của dự án đã đóng.
- ~~**Sidebar chỉ có một tầng.**~~ Cây lồng sâu tuỳ ý; seed dựng sẵn ba tầng (Ứng dụng → Vệ tinh → Match CV).
- ~~**Test cần DB chưa từng chạy.**~~ 64 xanh trên Postgres cục bộ, cộng 12 e2e xanh.
- ~~**Không có test nào canh ngưỡng vùng bấm.**~~ `e2e/a11y-tap-target.spec.ts` quét 4 trang. Nó **bắt được hai lỗi thật ngay lần chạy đầu** (tên thẻ ứng dụng cao 18px, liên kết neo cao 14px) — cả hai đã sửa.
- ~~**Playwright có thể âm thầm test sai app.**~~ `reuseExistingServer: !CI` cộng `baseURL` cổng 3000 nghĩa là bất kỳ server nào chiếm cổng 3000 cũng được nhận. Giờ e2e dùng cổng riêng 3210 và **không bao giờ** mượn server có sẵn.

### Nên làm sớm

- **30 file `.module.css` còn ngoài bậc cỡ.** Test `tokens.test.ts` quét mọi `*.module.css` và tìm ra **132 vi phạm**; sáu chỗ trong danh sách cũ đã sửa, 126 chỗ còn lại nằm ở 30 file được liệt kê trong hằng `KNOWN_DEBT` của chính test đó. Danh sách chỉ miễn trừ **đường dẫn có thật** — gõ sai một dòng thì test đỏ chứ không âm thầm miễn trừ số không.
- **`/admin/docs` không có nút sắp xếp — và đó là quyết định, không phải thiếu sót.** ⚠️ Bản trước của dòng này **viết sai**: nó gộp `/admin/docs` với `/admin/locales` và nói "không mutation nào ghi chúng". Thực tế `saveDocPage` **đã ghi** `DocPage.order`, lấy từ ô số `#doc-order` trong khối "Thông tin chung" của trình soạn trang. Hai trang chưa bao giờ cùng một vấn đề.

  Vì sao không thêm nút: ô số và bộ nút mũi tên là **hai mô hình khác nhau ghi cùng một cột**. Nút chỉ đúng khi cột là hoán vị liên tục `0..n-1`; ô số lại nhận mọi số nguyên, kể cả số âm (`/^-?\d+$/`) và số trùng. Thêm nút thì lần bấm đầu tiên âm thầm đánh số lại toàn bảng — kể cả những khoảng trống ai đó cố ý chừa (10, 20, 30 để còn chèn). Đó đúng là "một chỗ để hai con số lệch nhau" mà chú thích trong mã cảnh báo. Làm cho đúng nghĩa là **bỏ ô số đi**, và đó là đổi hợp đồng của khối "Thông tin chung" chứ không phải một việc nhỏ.

  Lợi ích cũng ít hơn tưởng: sau `0002_nav_tree`, `DocPage.order` **không còn** điều khiển sidebar công khai (`NavNode.order` làm việc đó, và đã sắp xếp được ở `/admin/navigation`). Nó chỉ còn xếp danh sách trong trang quản trị và phá hoà trong chỉ mục tìm kiếm.

### Quyết định còn treo

- **`DocPage("home")` đang `DRAFT` và `/docs/home` cố tình 404.** Nút điều hướng của nó cũng `DRAFT` nên không hiện ra sidebar. Trang chủ `/[locale]` hiện dựng từ chuỗi giao diện chứ không kết xuất bản ghi này. Publish nó sẽ đưa một liên kết chết vào chỉ mục tìm kiếm. Cần quyết: cho trang chủ đọc thật `DocPage("home")`, hay xoá bản ghi đó đi.
- **HTML thô trong markdown không được kết xuất.** Không có `<kbd>`, `<details>`, `<br>`. Đây là mặc định an toàn của `remark-rehype`; muốn mở thì cài `rehype-raw` + `allowDangerousHtml: true` rồi bỏ bước lọc HTML thô tự viết trong `src/lib/markdown.ts` — sanitize đã sẵn `strip: ['script']` cho tình huống đó.
- **`<pre>` mang thêm `data-code` chứa nguyên văn mã**, nên phần mã xuất hiện hai lần trong payload. Đổi lại được nút sao chép và mã vẫn lấy lại được sau khi tách token. Không muốn thì bỏ transformer và nới assertion trong `markdown.test.ts`.

### Đã ghi vào spec, chấp nhận lâu dài

- **Thêm một ngôn ngữ mới cần một lần redeploy.** Sửa **nội dung** thì không. Middleware chạy ở edge nên không chạm DB; danh sách locale sinh lúc `prebuild`. Xem spec §9.3.
- **`NEXT_PUBLIC_SITE_URL` hiện không nơi nào đọc.** `playwright.config.ts` từng đọc nó nhưng đã thôi — giá trị `http://localhost:3000` chính là chỗ e2e bị dắt sang app của dự án khác. Chưa có `sitemap.ts` hay canonical dùng nó.
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

**Bảy cái bẫy đã trả giá để biết** (chi tiết trong `CLAUDE.md` và `operations.md`):

0. **Dấu `$` trong `.env` phải escape thành `\$`.** Next expand biến khi nạp `.env`, nên hash bcrypt (luôn chứa `$`) bị cắt từ 60 ký tự còn 48, và trang đăng nhập chỉ nói "sai mật khẩu". Nháy đơn **không** cứu được. Chi tiết `operations.md` §3.1.


1. **Server Action là endpoint HTTP riêng.** Bảo vệ `layout.tsx` **không** bảo vệ action. Mọi action ghi dữ liệu phải `await requireAdmin()` ở dòng đầu.
2. **`vitest` không typecheck.** Suite xanh không chứng minh `tsc` sạch. Luôn chạy `npm run typecheck` riêng.
3. **`prisma migrate diff` thất bại âm thầm** khi thiếu `prisma.config.ts`: in chuỗi rỗng, thoát **mã 0**, sinh file migration **0 byte** trông như thành công.
4. **Prisma CLI 7, vitest và tsx đều không đọc `.env`.** Chỉ Next đọc. Với ba cái kia phải đặt biến trong chính phiên shell. **Playwright cũng không đọc** — `playwright.config.ts` nay tự gọi `loadEnvConfig` của `@next/env`, nếu không thì `process.env.ADMIN_EMAIL` là `undefined` và test đăng nhập đổ với một thông báo không hé ra nguyên nhân.
5. **`prisma db seed` không làm mới cache của Next.** Seed chạy ngoài request nên không gọi được `revalidateTag`; `unstable_cache` trong `.next/cache` giữ bản cũ, và `next build` đọc lại đúng cache đó. Sau mỗi lần seed: `rm -rf .next`.
6. **Khai `font-weight` hay `letter-spacing` trong một `.module.css` sẽ thắng quy tắc `h1,h2,h3` của `globals.css`** — selector class mạnh hơn selector thẻ. Năm quy tắc `.title` từng để `font-weight: 700` và tracking âm, âm thầm vô hiệu hoá cả quy tắc serif-400 lẫn quy tắc bỏ tracking. Không test nào bắt được; chỉ chụp ảnh và đo `getComputedStyle` mới thấy.

Và một ràng buộc của máy Windows này: **vitest chạy song song hay flaky khi máy tải nặng.** Test fail chưa được coi là fail thật cho tới khi lặp lại được với `--maxWorkers=1`. Test component dùng `fireEvent`, không dùng `userEvent.type`.

---

## 6. Nhật ký quyết định

Mọi quyết định đáng kể đều nằm trong **thông điệp commit**, kèm lý do. `git log` là nhật ký thiết kế của dự án này:

```bash
git log --format='%h %s%n%b'
```

Từ `2178c04` (mockup v1) tới đợt cây điều hướng: `f85c188` spec, `6db3c5f` kế hoạch, rồi `366b0a0`…`3e0e0a9` là Task 1–8, và Task 9 (seed cây, test vùng bấm, kiểm giao diện tận mắt) là commit cuối.
