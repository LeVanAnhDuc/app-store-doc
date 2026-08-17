# Vận hành và thiết lập môi trường

Tài liệu này ghi lại **những bước chỉ người có thông tin đăng nhập mới làm được**. Mã ứng dụng đã hoàn thành: 108 test xanh, 6 test skip vì thiếu `DATABASE_URL_TEST`, `npx tsc --noEmit` sạch, `npm run build` chạy được ở chế độ không có DB. Nhưng **chưa có lần nào chạy migration thật, seed thật hay deploy thật**, vì quá trình xây dựng không có tài khoản Neon, Cloudflare R2 hay Vercel.

Làm theo thứ tự 1 → 6. Mục 7 dành cho lúc chạy bộ test cần DB. Mục 8 và 9 là hai điều phải biết trước khi hứa với ai.

Môi trường tham chiếu: Windows, PowerShell, Node v22.14.0, Prisma 7.9.1. Mọi lệnh **không cần kết nối DB** trong tài liệu này đã chạy thật trên máy đó — lệnh sinh hash, lệnh sinh secret, `prisma migrate diff`, `prisma db seed`, `tsx prisma/seed.ts`. Các lệnh cần DB thật (`migrate deploy`, `migrate reset`) chưa chạy được lần nào vì chưa có `DATABASE_URL`; cú pháp lấy từ Prisma CLI 7.9.1 trên chính repo này. Không lệnh nào cần `openssl`.

---

## 0. Biến môi trường — danh sách thật, đọc từ mã

Đây là danh sách khớp với mã đang có, không phải khớp với spec.

| Biến | Ai đọc | Bắt buộc khi |
|---|---|---|
| `DATABASE_URL` | `src/server/db.ts`, `prisma.config.ts`, `scripts/generate-locales.ts`, `prisma/seed.ts` | chạy migration, seed, build có dữ liệu, chạy thật |
| `DATABASE_URL_TEST` | `src/server/content/*.db.test.ts`, `e2e/content-roundtrip.spec.ts` | chạy test cần DB. Thiếu thì các test đó **skip**, không fail |
| `AUTH_SECRET` | Auth.js đọc ngầm (không xuất hiện trong mã dự án) | đăng nhập `/admin` |
| `ADMIN_EMAIL` | `src/server/auth/providers/credentials.ts`, `e2e/content-roundtrip.spec.ts` | đăng nhập `/admin` |
| `ADMIN_PASSWORD_HASH` | `src/server/auth/providers/credentials.ts` | đăng nhập `/admin`. **Hash bcrypt, không phải mật khẩu thô** |
| `ADMIN_PASSWORD` | `e2e/content-roundtrip.spec.ts` | **chỉ** chạy e2e. Không khai trên Vercel |
| `PREVIEW_SECRET` | `src/app/[locale]/(admin)/admin/(protected)/apps/[id]/page.tsx`, `src/app/[locale]/(public)/apps/[slug]/preview/page.tsx` | xem trước bản nháp. Thiếu thì trang preview **đóng**, không mở |
| `R2_ACCOUNT_ID` | `src/server/media/index.ts` | tải ảnh lên |
| `R2_ACCESS_KEY_ID` | `src/server/media/index.ts` | tải ảnh lên |
| `R2_SECRET_ACCESS_KEY` | `src/server/media/index.ts` | tải ảnh lên |
| `R2_BUCKET` | `src/server/media/index.ts` | tải ảnh lên |
| `R2_PUBLIC_BASE_URL` | `src/server/media/index.ts` | hiển thị ảnh đã tải |
| `NEXT_PUBLIC_SITE_URL` | `playwright.config.ts` | chạy e2e trên domain khác `localhost:3000` |

Ba điều đáng lưu ý:

- **`R2_*` có năm biến, không phải bốn.** `src/server/media/index.ts` kiểm cả năm và ném lỗi liệt kê đúng biến còn thiếu. Spec §14 và kế hoạch Task 17 viết "bốn biến"; mã mới là nguồn sự thật.
- **`NEXT_PUBLIC_SITE_URL` hiện chỉ Playwright dùng.** Mã ứng dụng chưa đọc biến này ở đâu (chưa có `sitemap.ts` hay canonical URL). Cứ khai để sẵn, nhưng đừng tin rằng nó đang ảnh hưởng tới metadata.
- **`R2` không cần biến region.** `region: "auto"` viết cứng trong `src/server/media/index.ts` vì R2 không có khái niệm vùng; endpoint cũng tự dựng từ `R2_ACCOUNT_ID`.

### Cách nạp biến — đọc mục này trước khi chạy bất kỳ lệnh nào

`.env` **không** được nạp tự động ở mọi nơi. Đây là điều đã kiểm chứng trên chính repo này, không phải suy đoán:

| Công cụ | Có tự đọc `.env`? |
|---|---|
| `next dev`, `next build`, `next start` | **Có** — Next tự nạp `.env` và `.env.local` |
| Prisma CLI 7 (`migrate deploy`, `migrate reset`, `db seed`) | **Không.** Prisma 7 đã bỏ nạp dotenv. `prisma.config.ts` của repo không `import "dotenv/config"` và `dotenv` không có trong dependencies |
| `vitest` | **Không.** Đã thử: đặt `PROBE_ENV_VAR` trong `.env` rồi đọc `process.env.PROBE_ENV_VAR` trong một test → nhận `undefined` |
| `tsx prisma/seed.ts` | **Không** |

Hệ quả thực tế: với Prisma CLI và vitest, **phải đặt biến trong chính phiên shell**. PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

Git Bash:

```bash
export DATABASE_URL='postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
```

Biến đặt kiểu này chỉ sống trong cửa sổ shell đang mở. Mở cửa sổ mới là phải đặt lại. Kiểm tra nhanh trước khi chạy lệnh nặng:

```powershell
if ($env:DATABASE_URL) { "DATABASE_URL: da co" } else { "DATABASE_URL: CHUA CO" }
```

Song song với đó, vẫn tạo `.env` ở gốc repo (copy từ `.env.example`) để `next dev` dùng. `.env` đã nằm trong `.gitignore`.

---

## 1. Tạo project Neon → `DATABASE_URL` và `DATABASE_URL_TEST`

### 1.1 Tạo project

1. Đăng nhập [console.neon.tech](https://console.neon.tech).
2. **New Project**. Đặt tên `app-store-doc`. Chọn region gần người đọc nhất — `Asia Pacific (Singapore)` nếu phục vụ Việt Nam. Postgres để mặc định.
3. Sau khi tạo, Neon hiện hộp **Connection string**. Ở đó có hai lựa chọn cần phân biệt:
   - **Pooled connection** — host chứa `-pooler`. Dùng cho **ứng dụng** (`DATABASE_URL` trên Vercel). Serverless mở rất nhiều kết nối ngắn; đi qua pooler mới không cạn connection.
   - **Direct connection** — host **không** có `-pooler`. Dùng cho **`prisma migrate deploy`** và `prisma migrate reset`. Migration chạy DDL và lấy advisory lock, hai thứ không đáng tin qua pooler.

Giữ cả hai chuỗi. Cả hai đều đã có `?sslmode=require` — đừng bỏ tham số đó.

### 1.2 Tạo branch `test`

1. Trong project, mở tab **Branches** → **New branch**.
2. Tên branch: `test`. Parent: branch chính (`main`/`production`).
3. Copy connection string của branch `test` → đó là `DATABASE_URL_TEST`.

Branch `test` chia sẻ hạn mức với project, nhưng dữ liệu tách biệt hoàn toàn với branch chính. Đây là điều kiện để `prisma migrate reset` (xoá sạch DB) an toàn.

### 1.3 Hạn mức free tier — biết trước để không ngạc nhiên

| Hạn mức | Con số | Ảnh hưởng |
|---|---|---|
| Dung lượng | **0.5 GB / project** | Dư sức cho nội dung tài liệu. Ảnh nằm ở R2, không nằm trong DB |
| Compute | **100 CU-hours / project** | Cả branch chính và branch `test` cùng ăn vào quỹ này |
| Số branch | **10 / project** | Dự án này dùng 2 |
| Autosuspend | **sau 5 phút không hoạt động** | Xem 1.4 |

### 1.4 Autosuspend và vì sao nó không làm sập trang công khai

Neon ngủ sau 5 phút rảnh. Request đầu tiên sau khi ngủ mất thêm vài trăm mili-giây tới vài giây để đánh thức.

Trang công khai không bị ảnh hưởng: nó là HTML tĩnh trên CDN của Vercel (spec §12). Chỗ chịu độ trễ này là `/admin` và trang preview — lần bấm đầu tiên sau một lúc không dùng sẽ chậm. Đó là hành vi bình thường, không phải lỗi.

---

## 2. Tạo bucket Cloudflare R2 → năm biến `R2_*`

### 2.1 Tạo bucket

1. Dashboard Cloudflare → **R2** → **Create bucket**.
2. Tên: `app-store-doc-media`. Location để **Automatic**.
3. Ở trang tổng quan R2, copy **Account ID** → `R2_ACCOUNT_ID`.

`R2_BUCKET` chính là tên bucket vừa đặt.

### 2.2 Tạo API token

1. R2 → **Manage R2 API Tokens** → **Create API token**.
2. Permission: **Object Read & Write**. Phạm vi: **chỉ bucket vừa tạo**, không cấp cho toàn account.
3. Cloudflare hiện **Access Key ID** và **Secret Access Key** **đúng một lần**. Copy ngay:
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`

Mất secret thì không xem lại được, phải tạo token mới.

### 2.3 Endpoint — mã tự dựng, không cần khai

`src/server/media/index.ts` dựng endpoint từ account ID:

```
https://<account-id>.r2.cloudflarestorage.com
```

kèm `region: "auto"`. Không có biến nào cho endpoint hay region. Nếu Cloudflare đưa bạn một endpoint khác dạng này, kiểm tra lại là bạn đang copy đúng Account ID chứ không phải bucket ID.

### 2.4 Bật truy cập công khai — không làm bước này thì ảnh hiện ra 404

Bucket R2 mặc định **riêng tư**. `R2_PUBLIC_BASE_URL` là tiền tố URL mà người đọc dùng để tải ảnh, nên bucket phải công khai đọc. Chọn một trong hai:

**Cách nhanh — Public Development URL (`r2.dev`)**

1. Bucket → **Settings** → **Public access** → mục **R2.dev subdomain** → **Allow Access**.
2. Cloudflare cấp URL dạng `https://pub-<hash>.r2.dev` → đó là `R2_PUBLIC_BASE_URL`.

Cloudflare giới hạn tốc độ trên `r2.dev` và nói rõ nó không dành cho production. Dùng để chạy thử thì được.

**Cách nên dùng lâu dài — custom domain**

1. Bucket → **Settings** → **Public access** → **Connect Domain**, ví dụ `media.ten-mien-cua-ban.com`. Domain phải đang do Cloudflare quản DNS.
2. `R2_PUBLIC_BASE_URL = https://media.ten-mien-cua-ban.com`

Cách này qua CDN Cloudflare, không bị rate-limit, cache tốt hơn.

Mã tự cắt dấu `/` ở cuối `R2_PUBLIC_BASE_URL`, nên khai `https://x.r2.dev` hay `https://x.r2.dev/` đều được.

### 2.5 Hạn mức free tier

| Hạn mức | Con số |
|---|---|
| Lưu trữ | **10 GB / tháng** |
| Class A (ghi: `PutObject`, `DeleteObject`) | 1 triệu / tháng |
| Class B (đọc: `GetObject`) | 10 triệu / tháng |
| **Egress (băng thông ra)** | **miễn phí, không giới hạn** |

Egress miễn phí là lý do chọn R2 thay vì S3: ảnh screenshot tài liệu bị tải rất nhiều lần, và ở S3 chính khoản này đắt.

Giới hạn phía ứng dụng, không phải phía Cloudflare: mỗi tệp tối đa **5 MB** (`MAX_IMAGE_BYTES`), chỉ nhận PNG, JPEG, WebP, SVG, và nhận dạng bằng **magic bytes** chứ không tin đuôi tệp. Đổi đuôi `.exe` thành `.png` sẽ bị từ chối.

---

## 3. Sinh `ADMIN_PASSWORD_HASH`

`ADMIN_PASSWORD_HASH` là **hash bcrypt**, **không phải mật khẩu thô**. Khai mật khẩu thô vào biến này thì đăng nhập luôn thất bại — `bcrypt.compare` so mật khẩu với một chuỗi không phải hash và trả `false`, không có thông báo nào chỉ ra nguyên nhân.

Chọn mật khẩu trước, rồi chạy trong PowerShell tại gốc repo:

```powershell
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'mat-khau-thuc-cua-ban'
```

Kết quả có dạng:

```
$2b$10$.JIHeaYKg2gObN8GiHai.eAQ6J415Zf3y6Wxx2GLonEoAp2E49BoG
```

Toàn bộ chuỗi đó là giá trị của `ADMIN_PASSWORD_HASH`. Ba lưu ý khi copy:

- Chuỗi chứa `$`. Trong PowerShell hãy bọc bằng **nháy đơn** khi gán, đừng dùng nháy kép — nháy kép làm PowerShell cố nội suy `$2b` thành biến.
- Cost 10 là tham số ở lệnh trên. `bcrypt.compare` đọc cost từ chính hash nên hash cost khác vẫn so khớp được; cứ giữ 10 cho khỏi phải nghĩ.
- Mật khẩu chứa dấu nháy đơn thì nhân đôi nó: `'mat''khau'`.

Kiểm chứng hash trước khi đem đi deploy:

```powershell
node -e "console.log(require('bcryptjs').compareSync(process.argv[1], process.argv[2]))" 'mat-khau-thuc-cua-ban' '$2b$10$...hash-vua-sinh...'
```

### 3.1 Bẫy nặng nhất của cả tài liệu này: `$` trong `.env`

Đã trả giá để biết, và **không có lỗi nào để lần theo**.

Next expand biến khi nạp `.env`, nên mọi `$x` bị coi là **tên biến** và thay bằng rỗng. Hash bcrypt **luôn** chứa ba dấu `$`, nên để trần thì hash 60 ký tự bị cắt còn 48, `bcrypt.compare` trả `false`, và trang đăng nhập chỉ nói "Email hoặc mật khẩu không đúng" — y như khi bạn gõ sai mật khẩu thật.

Đã thử cả bốn cách, kết quả thật:

| Viết trong `.env` | App đọc được | Đăng nhập |
|---|---|---|
| `ADMIN_PASSWORD_HASH=$2b$10$abc…` | 48 ký tự | ✗ |
| `ADMIN_PASSWORD_HASH='$2b$10$abc…'` | 48 ký tự | ✗ **nháy đơn không cứu được** |
| `ADMIN_PASSWORD_HASH="\$2b\$10\$abc…"` | 60 ký tự | ✓ |
| `ADMIN_PASSWORD_HASH=\$2b\$10\$abc…` | 60 ký tự | ✓ |

**Chỉ escape `\$` mới sống.** Cách sinh sẵn giá trị đã escape:

```powershell
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10).replaceAll(String.fromCharCode(36), String.fromCharCode(92,36)))" 'mat-khau-cua-ban'
```

Dán nguyên văn kết quả vào `.env`. Kiểm lại bằng chính đường mà app đi:

```powershell
node -e "require('@next/env').loadEnvConfig(process.cwd(),true); const h=process.env.ADMIN_PASSWORD_HASH||''; console.log('dài', h.length, '| khớp:', require('bcryptjs').compareSync(process.argv[1], h))" 'mat-khau-cua-ban'
```

Phải ra `dài 60 | khớp: true`. Ra 48 là chưa escape.

> **Chỉ áp dụng cho file `.env`.** Trên Vercel bạn khai qua dashboard, không qua dotenv, nên **dán hash nguyên văn, không escape**. Escape ở đó sẽ đưa dấu `\` vào hash và lại sai theo chiều ngược lại.

In ra `true` là đúng.

Lưu mật khẩu thô vào trình quản lý mật khẩu. Nó cần cho hai việc: đăng nhập `/admin`, và biến `ADMIN_PASSWORD` khi chạy e2e (mục 7.3).

---

## 4. Sinh `AUTH_SECRET` và `PREVIEW_SECRET`

Kế hoạch gốc viết `openssl rand -base64 32`. Trong **PowerShell** trên máy này không có `openssl` trên PATH (đã kiểm: `Get-Command openssl` trả về rỗng) nên lệnh đó chết ngay. Git Bash đi kèm Git for Windows thì lại có `openssl` ở `/mingw64/bin` — nghĩa là cùng một lệnh chạy được ở shell này và chết ở shell kia. Dùng Node cho chắc, shell nào cũng chạy:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Chạy **hai lần**, lấy hai giá trị **khác nhau**:

- Lần 1 → `AUTH_SECRET`
- Lần 2 → `PREVIEW_SECRET`

Muốn lấy cả hai trong một lệnh:

```powershell
node -e "const r=require('crypto');console.log('AUTH_SECRET='+r.randomBytes(32).toString('base64'));console.log('PREVIEW_SECRET='+r.randomBytes(32).toString('base64'))"
```

Vai trò của từng cái:

- **`AUTH_SECRET`** — Auth.js ký cookie session bằng nó. Đổi giá trị là mọi người đang đăng nhập bị đăng xuất. Auth.js đọc biến này ngầm, không có dòng mã nào trong repo tham chiếu tên nó.
- **`PREVIEW_SECRET`** — token cho URL xem trước bản nháp. So khớp bằng `timingSafeEqual`. **Thiếu biến này thì trang preview đóng hẳn, không mở**: thiếu cấu hình phải nghiêng về từ chối. Trong CMS, nút xem trước sẽ không hiện link.

Giá trị base64 có thể chứa `+`, `/`, `=`. Trên Vercel dán nguyên văn là được. Trong `.env`, đừng thêm nháy quanh giá trị.

---

## 5. Chạy migration và seed

### 5.1 Hai cái bẫy Prisma 7 đã gặp thật

Đọc trước khi chạy, cả hai đều đã làm mất thời gian một lần:

**Bẫy 1 — `datasource.url` không nằm trong `schema.prisma`.** Từ Prisma 7, URL kết nối khai trong `prisma.config.ts` ở **gốc repo**. File này phải ở gốc; để trong `prisma/` thì mọi lệnh phải truyền `--config` bằng tay. Mở `prisma/schema.prisma` tìm `url = env("DATABASE_URL")` sẽ không thấy — đúng như vậy, không phải thiếu sót.

**Bẫy 2 — `prisma migrate diff` thất bại âm thầm.** Thiếu cấu hình datasource, schema engine **không báo lỗi**: nó in ra chuỗi rỗng, **thoát với mã 0**, và nếu bạn đang chuyển hướng vào file thì sinh ra một `migration.sql` **0 byte** trông y như thành công. Kiểm tra bằng kích thước file, đừng tin exit code:

```powershell
(Get-Item prisma/migrations/0001_init/migration.sql).Length
```

File đang commit ra **5357** byte. Ra `0` là đã dính bẫy này.

Thêm một chi tiết về cờ dòng lệnh: Prisma 7 **bỏ** `--to-schema-datamodel`, đổi thành `--to-schema`. Dùng cờ cũ thì lệnh lỗi ngay (may là lần này lỗi ồn ào). Lệnh sinh lại migration cho đúng phiên bản hiện tại:

```powershell
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/0001_init/migration.sql
```

Dùng `--output` chứ **đừng** chuyển hướng bằng `>`: PowerShell ghi file kèm BOM UTF-8, còn `--output` ghi UTF-8 sạch (đã kiểm bằng xxd — byte đầu là `--`, không có BOM). Đã kiểm cả nội dung: lệnh trên sinh đúng phần DDL của file đang commit.

**Nhưng đừng chạy lệnh đó nếu chưa cần.** Xem 5.2.

### 5.2 CHECK constraint `section_single_owner` viết tay

Dòng cuối `prisma/migrations/0001_init/migration.sql`:

```sql
-- Section thuộc về ĐÚNG MỘT chủ sở hữu: hoặc App, hoặc DocPage.
-- Prisma không diễn đạt được quan hệ đa hình nên ràng buộc này phải viết tay.
ALTER TABLE "Section" ADD CONSTRAINT section_single_owner CHECK (("appId" IS NULL) <> ("docPageId" IS NULL));
```

`schema.prisma` không diễn đạt được ràng buộc này, nên **`prisma migrate diff` không sinh ra nó**. Đã kiểm: phần DDL do `migrate diff` sinh khớp từng byte với file đã commit, đúng cho tới dòng CHECK — dòng CHECK là phần thêm tay.

Vì vậy: **sinh lại `migration.sql` sẽ xoá mất ràng buộc này.** Nếu buộc phải sinh lại, chép ba dòng trên xuống cuối file ngay sau đó. `prisma/schema.test.ts` có test canh sự hiện diện của chuỗi `section_single_owner` trong file — mất nó thì suite đỏ.

### 5.3 Chạy migration

Dùng chuỗi **direct connection** (không `-pooler`) của branch chính:

```powershell
$env:DATABASE_URL = "postgresql://...@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
npx prisma migrate deploy
```

Nhớ mục 0, phần "Cách nạp biến": Prisma 7 không đọc `.env`. Quên đặt biến thì `prisma.config.ts` rơi về URL dự phòng `postgresql://localhost:5432/app_store_doc` và lệnh chết vì không kết nối được localhost — lỗi trông như "Postgres chưa chạy" chứ không nói "bạn quên đặt biến".

Kiểm tra kết quả:

```powershell
npx prisma migrate status
```

### 5.4 Chạy seed

```powershell
npx prisma db seed
```

Hoặc gọi thẳng, kết quả như nhau:

```powershell
npx tsx prisma/seed.ts
```

> **Bẫy đã gặp và đã sửa.** Lệnh seed từng khai trong khối `prisma` của `package.json` — chỗ Prisma 6 đọc. Prisma 7 **bỏ hỗ trợ khối đó** và chỉ đọc `migrations.seed` trong `prisma.config.ts`, nên `prisma db seed` chỉ in `⚠️ No seed command configured` rồi thoát **mã 0** — trông y như "không có gì để seed" chứ không như một lỗi. Nay đã khai đúng chỗ trong `prisma.config.ts`; nếu về sau ai thấy thông báo đó quay lại thì kiểm khoá này trước tiên.

Seed chạy lại được nhiều lần (upsert theo `slug`/`code`). Thiếu `DATABASE_URL` thì nó dừng sạch sẽ với thông báo tiếng Việt, không ghi nửa vời.

Kết quả mong đợi: 2 locale (`vi` mặc định, `en`), 6 ứng dụng, 4 trang hướng dẫn.

### 5.5 Nội dung seed là bản nháp, không phải nguồn tham chiếu

`prisma/seed.ts` viết từ **README công khai** của các repo, không từ mã nguồn, và chưa qua lần chạy thử nào. Phần "Chạy thử trong 5 phút" **có thể sai** số cổng, tên biến môi trường, tên script npm.

Sau lần deploy đầu, **nguồn sự thật là DB**. Sửa nội dung qua CMS, đừng sửa `seed.ts` — chạy seed lại sẽ ghi đè bản đã sửa.

`shorten-link` được seed **rỗng** (`isRepoPrivate = true`, `status = DRAFT`) vì repo riêng tư, không đọc được. Chủ dự án tự nhập rồi publish.

---

## 6. Deploy lên Vercel

### 6.1 Import project

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import repo `app-store-doc`.
2. Framework Preset: Vercel tự nhận **Next.js**. Build Command để mặc định (`npm run build`) — `prebuild` tự chạy trước nó.

### 6.2 Khai biến môi trường

Vào **Settings → Environment Variables**, khai cho cả **Production** và **Preview**:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | chuỗi **pooled** (có `-pooler`) của branch chính |
| `AUTH_SECRET` | mục 4 |
| `ADMIN_EMAIL` | email đăng nhập admin |
| `ADMIN_PASSWORD_HASH` | mục 3 — **hash**, không phải mật khẩu |
| `PREVIEW_SECRET` | mục 4 |
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` · `R2_PUBLIC_BASE_URL` | mục 2 |
| `NEXT_PUBLIC_SITE_URL` | URL thật, ví dụ `https://app-store-doc.vercel.app` |

**Không** khai `ADMIN_PASSWORD` và `DATABASE_URL_TEST` trên Vercel. Cái đầu là mật khẩu thô chỉ dùng cho e2e cục bộ; cái sau trỏ vào branch mà `prisma migrate reset` xoá định kỳ.

Dùng chuỗi **pooled** ở đây là chủ đích: Vercel chạy serverless, mỗi function một kết nối, đi trực tiếp sẽ cạn connection của Neon.

### 6.3 `postinstall: prisma generate` là bắt buộc

`package.json` có:

```json
"postinstall": "prisma generate"
```

**Đừng bỏ dòng này.** Prisma Client sinh mã vào `node_modules/.prisma`, và `node_modules` không nằm trong git. Vercel cài dependencies vào một môi trường sạch mỗi lần build; không có `postinstall`, `next build` sẽ đổ ở ngay câu `import { PrismaClient }` với lỗi kiểu "did you forget to run prisma generate". Vercel còn có thể tái dùng cache dependencies giữa các lần build, khiến lỗi này xuất hiện *không đều* — build được lần này, đỏ lần sau, khó truy hơn nhiều.

### 6.4 `DATABASE_URL` phải có mặt lúc **build**, không chỉ lúc chạy

`prebuild` chạy `scripts/generate-locales.ts`, script này **đọc bảng `Locale`** để sinh `src/i18n/locales.generated.ts`. Nên `DATABASE_URL` cần có ở cả build time — khai biến trong Vercel Environment Variables là đủ, Vercel cấp nó cho cả hai pha.

Script được viết để không làm sập deploy: thiếu `DATABASE_URL` hoặc DB không với tới được thì nó **giữ nguyên** `locales.generated.ts` đã commit và in cảnh báo. Nó chỉ dừng build khi *đọc được* DB mà dữ liệu sai — không locale nào bật, hoặc số locale mặc định khác 1. Hai lỗi đó sửa được ở CMS.

### 6.5 Sau deploy đầu tiên — kiểm bằng tay

1. Mở `/vi` → thấy danh sách 6 ứng dụng, tên hiển thị dạng **Web Store Apps** (không phải `web-store-apps`).
2. Mở `/en` → giao diện tiếng Anh, nội dung chưa dịch thì fallback về `vi` kèm badge.
3. Mở `/vi/admin` → bị đá sang `/vi/admin/login`. Đăng nhập bằng `ADMIN_EMAIL` + mật khẩu thô.
4. Sửa một tagline → lưu → mở lại trang công khai tương ứng → thấy nội dung mới **mà không deploy lại**. Đây là lời hứa trung tâm của hệ thống; hỏng chỗ này thì revalidate sai.
5. Tải một ảnh lên trong CMS → ảnh hiện được → chứng minh `R2_PUBLIC_BASE_URL` và quyền công khai của bucket đúng.

---

## 7. Chạy bộ test cần database

### 7.1 Cảnh báo trước: branch `test` là tài nguyên độc chiếm

**Chỉ có một branch `test`, và `prisma migrate reset` xoá sạch nó.**

Chạy hai suite cùng lúc — hai cửa sổ terminal, hoặc một suite cục bộ trong khi CI đang chạy — thì suite này xoá dữ liệu của suite kia **ở giữa** lần chạy. Kết quả không phải một lỗi rõ ràng mà là các fail ngẫu nhiên, không lặp lại được, kiểu "bản ghi vừa tạo đã không còn": mất hàng giờ để truy trong khi nguyên nhân chỉ là hai tiến trình dùng chung một DB.

Quy tắc: **một suite tại một thời điểm.** Đó cũng là lý do `test:run` cố định `--maxWorkers=1` và `playwright.config.ts` cố định `workers: 1`.

### 7.2 Vitest

Các test cần DB nằm trong `src/server/content/*.db.test.ts` và mở đầu bằng `describe.skipIf(!process.env.DATABASE_URL_TEST)`. Thiếu biến thì chúng **skip** — suite vẫn xanh nhưng **không chứng minh gì** về tầng truy vấn.

Vitest không đọc `.env` (mục 0), nên đặt biến trong shell:

```powershell
$env:DATABASE_URL_TEST = "postgresql://...@ep-xxx-test...neon.tech/neondb?sslmode=require"
$env:DATABASE_URL = $env:DATABASE_URL_TEST
npx prisma migrate reset --force
npm run test:run
```

Năm điểm cần nhớ:

- `prisma migrate reset` đọc `DATABASE_URL`, **không** đọc `DATABASE_URL_TEST`. Vì vậy phải gán `DATABASE_URL = DATABASE_URL_TEST` trước khi reset. **Kiểm lại giá trị trước khi bấm Enter** — trỏ sai vào branch chính là xoá toàn bộ nội dung thật.
- `--force` bỏ qua câu hỏi xác nhận. Thiếu cờ này, lệnh treo chờ nhập trong shell không tương tác.
- `reset` **tự chạy seed** vì `migrations.seed` đã khai trong `prisma.config.ts` (mục 5.4). Nghĩa là branch `test` có dữ liệu ngay sau reset, không cần gọi seed thêm.
- Reset **trước mỗi lần chạy suite**, không phải một lần rồi thôi. Test ghi dữ liệu và không dọn hết sau mình.
- `migrate reset` chạy DDL, nên dùng chuỗi **direct** (không `-pooler`) của branch `test`, giống mục 5.3. Bản thân bộ test dùng chuỗi nào cũng chạy.

Muốn tuyệt đối an toàn, mở một cửa sổ shell riêng chỉ để chạy test, và trong cửa sổ đó **không bao giờ** đặt `DATABASE_URL` trỏ branch chính.

### 7.3 Playwright e2e

`e2e/content-roundtrip.spec.ts` cần thêm mật khẩu thô. `playwright.config.ts` tự dựng server bằng `npm run start`, nên phải build trước:

```powershell
$env:DATABASE_URL_TEST = "postgresql://...branch-test..."
$env:DATABASE_URL = $env:DATABASE_URL_TEST
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "mat-khau-thuc-cua-ban"
$env:ADMIN_PASSWORD_HASH = '$2b$10$...'
$env:AUTH_SECRET = "..."
npx prisma migrate reset --force
npx tsx prisma/seed.ts
npm run build
npm run e2e
```

Ghi chú:

- `ADMIN_PASSWORD` là **mật khẩu thô**, phải khớp với `ADMIN_PASSWORD_HASH`. Test dùng nó để điền form đăng nhập.
- `ADMIN_PASSWORD_HASH` gán bằng **nháy đơn** trong PowerShell (chuỗi có `$`).
- `e2e/admin-auth.spec.ts` không cần DB: nó kiểm `/admin` đá về trang đăng nhập, và kiểm POST thẳng vào server action khi chưa đăng nhập thì bị chặn.
- Branch `test` phải **có dữ liệu seed** trước khi chạy: `npx tsx prisma/seed.ts` sau `migrate reset`. Test roundtrip mở `/vi/admin/apps/web-store-apps` và tìm tiêu đề "Web Store Apps"; branch rỗng thì cả hai test đều đỏ vì thiếu dữ liệu, không phải vì mã sai. `npm run build` cũng cần bảng `Locale` có dòng để `prebuild` sinh đúng danh sách locale.
- Chạy e2e trên domain khác `localhost:3000` thì đặt `NEXT_PUBLIC_SITE_URL` tương ứng.

### 7.4 Không có DB thì kiểm được tới đâu

Chạy được, không cần thông tin đăng nhập nào:

```powershell
npm run test:run      # test thuần, các test cần DB tự skip
npm run typecheck     # tsc --noEmit
npm run lint
npm run build         # generateStaticParams trả [] khi thiếu DATABASE_URL
```

`vitest` **không** typecheck. Suite xanh không chứng minh `tsc` sạch — luôn chạy `npm run typecheck` riêng, và chạy `npm run build` trước khi tuyên bố hoàn thành.

---

## 8. Giới hạn đã biết: thêm ngôn ngữ mới cần một lần redeploy

Phân biệt hai việc:

| Việc | Cần deploy? |
|---|---|
| Sửa **nội dung** ở bất kỳ ngôn ngữ nào (tên app, tagline, thân bài) | **Không.** Hiện ngay sau khi lưu trong CMS |
| Thêm **một ngôn ngữ mới** (thêm dòng vào bảng `Locale`) | **Có — một lần redeploy** |

Lý do: middleware của next-intl chạy ở **edge** trên mọi request và không được chạm DB. Danh sách locale mà nó dùng nằm trong file `src/i18n/locales.generated.ts`, **sinh lúc `prebuild`** từ bảng `Locale`. Thêm dòng vào `Locale` mà không redeploy thì middleware không biết locale mới tồn tại và `/xx/...` ra 404.

Quy trình thêm ngôn ngữ:

1. Thêm dòng vào bảng `Locale` (`enabled = true`, `isDefault = false`, đặt `order`).
2. Bấm **Redeploy** trên Vercel. `prebuild` đọc lại `Locale` và sinh lại `locales.generated.ts`.
3. Thêm file chuỗi giao diện `src/i18n/messages/<code>.json` — đây là **sửa mã**, không phải nội dung CMS: nhãn nút và chữ giao diện sinh ra cùng mã, không nhập qua CMS.
4. Nhập bản dịch nội dung qua CMS.

Đánh đổi này được chấp nhận có ý thức: thêm ngôn ngữ là việc hiếm và dù sao cũng kéo theo hàng giờ dịch thuật; né nó thì phải bỏ middleware và tự viết lại toàn bộ negotiation — không tương xứng.

---

## 9. Vercel Hobby cấm dùng cho mục đích thương mại

Gói **Vercel Hobby** (miễn phí) **không được dùng cho mục đích thương mại**. Đây là điều khoản của Vercel, không phải giới hạn kỹ thuật: không có cảnh báo nào trong dashboard, nhưng Vercel có quyền yêu cầu nâng cấp hoặc ngắt dự án.

Trang tài liệu cho dự án cá nhân, không quảng cáo, không bán gì — đúng phạm vi Hobby. Nhưng nếu sau này:

- gắn quảng cáo, hoặc
- dùng nó làm trang bán/marketing cho một sản phẩm có thu phí, hoặc
- đặt nó dưới tên một công ty,

thì phải chuyển lên **Vercel Pro**. Kiểm tra lại điều khoản hiện hành lúc đó — con số và câu chữ trong tài liệu này khảo sát ngày **2026-08-17**.

Neon và Cloudflare R2 free tier **không** có điều khoản cấm thương mại; chỉ Vercel Hobby.

---

## 10. Checklist

Thiết lập lần đầu:

- [ ] Neon project → `DATABASE_URL` (giữ cả pooled và direct)
- [ ] Neon branch `test` → `DATABASE_URL_TEST`
- [ ] R2 bucket → `R2_BUCKET`, `R2_ACCOUNT_ID`
- [ ] R2 API token → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] Bật truy cập công khai hoặc custom domain → `R2_PUBLIC_BASE_URL`
- [ ] `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (hash bcrypt)
- [ ] `AUTH_SECRET` và `PREVIEW_SECRET` (hai giá trị khác nhau)
- [ ] `.env` cục bộ copy từ `.env.example`
- [ ] `npx prisma migrate deploy` với direct URL
- [ ] `npx tsx prisma/seed.ts`
- [ ] Khai biến trên Vercel (Production + Preview), **không** khai `ADMIN_PASSWORD`, `DATABASE_URL_TEST`
- [ ] Deploy, rồi chạy năm bước kiểm tay ở mục 6.5

Việc định kỳ:

- [ ] Theo dõi 100 CU-hours của Neon trong Console (branch chính và branch `test` dùng chung quỹ)
- [ ] Theo dõi 10 GB lưu trữ R2
- [ ] Trước mỗi lần chạy suite cần DB: `prisma migrate reset --force` trên branch `test`, và chắc chắn không có suite nào khác đang chạy
