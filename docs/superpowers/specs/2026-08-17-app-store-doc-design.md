# app-store-doc — Thiết kế hệ thống

**Ngày:** 2026-08-17
**Trạng thái:** Chờ duyệt
**Tác giả:** Lê Văn Anh Đức + Claude

---

## 1. Mục tiêu

Xây một trang tài liệu cho hệ sinh thái ứng dụng của `github.com/LeVanAnhDuc`, gồm hai phần:

1. **Trang docs công khai** — mỗi app một mục (Là gì → Quick start → Cách dùng → Tính năng), cộng các trang tổng quan hệ sinh thái và dev guide (luồng OAuth/PKCE, cách tích hợp app mới vào IDMS).
2. **CMS quản trị** — thêm app mới, thêm/sửa/xóa tính năng, sửa mọi nội dung **không cần sửa code, không cần deploy**.

Nội dung song ngữ Việt/Anh ngay từ đầu, kiến trúc mở cho ngôn ngữ thứ ba trở đi.

---

## 2. Bối cảnh — hệ sinh thái hiện tại

Khảo sát từ GitHub công khai ngày 2026-08-17.

### 2.1 Lõi — IDMS (Identity Management System)

| Repo | Vai trò | Stack |
|---|---|---|
| `api-web-store-apps` | OAuth 2.0/OIDC provider: cấp JWT, MFA, app registry | Node + Express + TS, MongoDB (Mongoose 8), Redis + BullMQ, Joi, Swagger, Winston |
| `web-store-apps` | Trang login + consent screen + launcher portal | Next.js 15, React 19, Tailwind v4, shadcn/ui, Zustand 5, React Query 5, RHF + Zod 4, next-intl (en/vi) |

Cơ chế: Authorization Code + PKCE; access/refresh token trong HttpOnly cookie; ID token mang claim `locale` để đồng bộ ngôn ngữ giữa các app.

### 2.2 Các app vệ tinh

| Repo | Stack | Trạng thái tích hợp IDMS |
|---|---|---|
| `client-web-app-match-cv` + `api-web-app-match-cv` | TanStack Start + AntD / NestJS 11 + Prisma 6 + Postgres(pgvector) + OpenRouter | Chưa. README ghi "auth defer", dùng stub current-user |
| `app-manage-gym` | Next.js 16 + Prisma 7 + Postgres + Auth.js | Chưa. Single-user, email/password hardcode trong env |
| `app-calculate-badminton` | React 19 + Vite + Tailwind v4, localStorage | Chưa. Hoàn toàn standalone, không backend |
| `app-AI-study-coach` | — | Chưa. Mới 3 commits, chỉ có `docs/` |
| `client-web-app-shorten-link` | — | Không đọc được — repo private |

**Ghi nhận quan trọng:** tính đến 2026-08-17, **chưa app vệ tinh nào thực sự nối vào IDMS**. Trang docs vì vậy phải phân biệt rõ **hiện trạng** và **kiến trúc mục tiêu**. Trường `App.status` và nội dung do người viết kiểm soát đảm nhiệm việc này; hệ thống không tự suy diễn trạng thái tích hợp.

---

## 3. Phạm vi

### Trong phạm vi
- Trang docs công khai, song ngữ, render tĩnh
- CMS quản trị nội dung app / trang docs / ảnh / ngôn ngữ
- Đăng nhập admin một tài khoản, tách lớp để sau đổi sang IDMS
- Seed nội dung sơ bộ cho 5 app từ README công khai
- Mockup UI được duyệt trước khi viết code

### Ngoài phạm vi (YAGNI)
- Nhiều người dùng, phân quyền theo vai trò, nhật ký chỉnh sửa
- Bình luận, phản hồi, phân tích truy cập
- Tự động đồng bộ nội dung từ README của các repo
- Sửa `api-web-store-apps` để hỗ trợ đăng ký OAuth client
- Trình soạn thảo block-based (thiết kế để mở đường, chưa làm)

---

## 4. Quyết định kiến trúc

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Next.js 16 App Router, full-stack, một repo | Nhất quán với `app-manage-gym`; server action ghi thẳng DB, không cần API tách rời |
| D2 | PostgreSQL trên Neon, Prisma 7 | Đã dùng ở `app-manage-gym`; Neon free tier có branching, dùng làm DB test |
| D3 | SSG + on-demand revalidation | Docs là đọc-nhiều-ghi-ít. HTML tĩnh trên CDN → nhanh, không đụng DB mỗi request, tránh cold start khi Neon autosuspend |
| D4 | Locale là **dòng** trong bảng translation, không phải cột | Thêm ngôn ngữ thứ N chỉ là thêm data, không migrate schema |
| D5 | `SectionTranslation.body` là JSON có discriminator `type` | Cửa mở sang block-based sau này mà không migrate dữ liệu cũ |
| D6 | Auth.js Credentials sau lớp abstraction 3 hàm | Docs lên sớm, không phụ thuộc IDMS; đổi sang IDMS chỉ sửa một file |
| D7 | Cloudflare R2 cho ảnh | 10 GB/tháng, egress miễn phí, API chuẩn S3, không khóa vào Vercel |
| D8 | Chuỗi giao diện trong repo, nội dung trong DB | Chuỗi giao diện sinh cùng code; nội dung phải sửa được không deploy |

---

## 5. Cấu trúc thư mục

```
app-store-doc/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ (public)/
│  │  │  │  ├─ page.tsx                 # landing (DocPage slug="home")
│  │  │  │  ├─ apps/page.tsx            # danh sách app
│  │  │  │  ├─ apps/[slug]/page.tsx
│  │  │  │  └─ docs/[slug]/page.tsx
│  │  │  └─ (admin)/admin/…
│  │  └─ api/
│  │     └─ search-index/[locale]/route.ts
│  ├─ server/
│  │  ├─ content/     # DUY NHẤT chỗ chạm Prisma
│  │  ├─ auth/        # DUY NHẤT chỗ biết Auth.js
│  │  └─ media/       # DUY NHẤT chỗ biết R2
│  ├─ components/{ui,docs,admin}/
│  ├─ i18n/
│  │  ├─ messages/{vi,en}.json
│  │  └─ locales.generated.ts           # sinh lúc prebuild từ bảng Locale
│  └─ lib/
├─ e2e/
├─ scripts/generate-locales.ts
└─ docs/superpowers/specs/
```

**Ranh giới bắt buộc:** component không bao giờ `import prisma`, không bao giờ `import` Auth.js, không bao giờ `import` SDK S3. Mọi truy cập đi qua ba thư mục `src/server/*`. Nhờ đó đổi cache strategy, đổi DB, đổi nhà cung cấp lưu trữ, đổi cơ chế auth — mỗi thứ chỉ chạm một tầng.

---

## 6. Data model

```prisma
enum Status  { DRAFT PUBLISHED ARCHIVED }
enum AppKind { CORE SATELLITE }

model Locale {
  code      String  @id                  // "vi" | "en" | "ja" ...
  label     String                       // "Tiếng Việt"
  enabled   Boolean @default(true)
  isDefault Boolean @default(false)
  order     Int     @default(0)
}

model App {
  id            String   @id @default(cuid())
  slug          String   @unique         // "web-store-apps"
  kind          AppKind  @default(SATELLITE)
  status        Status   @default(DRAFT)
  order         Int      @default(0)
  logoUrl       String?
  repoUrl       String?
  apiRepoUrl    String?                  // cho app có cặp client/api
  demoUrl       String?
  isRepoPrivate Boolean  @default(false) // ẩn link, hiện badge "Private"
  techStack     String[]
  translations  AppTranslation[]
  features      Feature[]
  sections      Section[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model AppTranslation {
  id      String @id @default(cuid())
  appId   String
  locale  String
  name    String
  tagline String?
  summary String?                        // markdown ngắn: card + meta description
  app     App    @relation(fields: [appId], references: [id], onDelete: Cascade)
  @@unique([appId, locale])
}

model Feature {
  id           String  @id @default(cuid())
  appId        String
  order        Int     @default(0)
  icon         String?                   // tên icon lucide
  app          App     @relation(fields: [appId], references: [id], onDelete: Cascade)
  translations FeatureTranslation[]
}

model FeatureTranslation {
  id          String  @id @default(cuid())
  featureId   String
  locale      String
  title       String
  description String?
  feature     Feature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  @@unique([featureId, locale])
}

model DocPage {
  id           String  @id @default(cuid())
  slug         String  @unique           // "home", "oauth-integration-guide"
  group        String?                   // nhóm trong sidebar
  order        Int     @default(0)
  status       Status  @default(DRAFT)
  translations DocPageTranslation[]
  sections     Section[]
}

model DocPageTranslation {
  id          String  @id @default(cuid())
  docPageId   String
  locale      String
  title       String
  description String?
  docPage     DocPage @relation(fields: [docPageId], references: [id], onDelete: Cascade)
  @@unique([docPageId, locale])
}

model Section {                          // DÙNG CHUNG cho App và DocPage
  id           String   @id @default(cuid())
  appId        String?
  docPageId    String?
  order        Int      @default(0)
  anchor       String                    // "quick-start" → #quick-start, dựng ToC
  app          App?     @relation(fields: [appId],     references: [id], onDelete: Cascade)
  docPage      DocPage? @relation(fields: [docPageId], references: [id], onDelete: Cascade)
  translations SectionTranslation[]
}

model SectionTranslation {
  id        String  @id @default(cuid())
  sectionId String
  locale    String
  title     String
  body      Json                         // { "type": "markdown", "content": "..." }
  section   Section @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  @@unique([sectionId, locale])
}

model Media {
  id        String   @id @default(cuid())
  url       String                       // URL công khai của R2
  pathname  String   @unique
  alt       String?
  width     Int?
  height    Int?
  sizeBytes Int
  mimeType  String
  createdAt DateTime @default(now())
}
```

### Ba điểm cần chú ý

**6.1 — `SectionTranslation.body` là JSON có `type`.** Hôm nay chỉ tồn tại `{"type":"markdown","content":"..."}`. Renderer `switch` theo `type`. Khi thêm `{"type":"blocks","blocks":[…]}` sau này, dữ liệu markdown cũ vẫn render bình thường. Không migrate.

**6.2 — `Section` đa hình qua hai FK nullable.** Prisma không hỗ trợ quan hệ đa hình. Migration phải thêm CHECK constraint thủ công:

```sql
ALTER TABLE "Section" ADD CONSTRAINT section_single_owner
  CHECK (("appId" IS NULL) <> ("docPageId" IS NULL));
```

Đổi lại được: một editor Section, một renderer, một bộ dựng ToC — dùng chung cho cả trang app lẫn trang guide.

**6.3 — `isRepoPrivate`.** Sinh ra vì `client-web-app-shorten-link` là private. Trang app hiển thị đầy đủ, chỉ ẩn link GitHub và hiện badge, thay vì để link 404.

**6.4 — Hai ràng buộc không diễn đạt được bằng schema**, phải kiểm ở tầng `src/server/content/` và có unit test riêng:

- `Section.anchor` phải **duy nhất trong phạm vi chủ sở hữu** (cùng một App, hoặc cùng một DocPage). Trùng anchor thì ToC và liên kết `#` sẽ nhảy sai chỗ. Không đặt được `@@unique` vì khoá chủ sở hữu nằm ở một trong hai cột nullable.
- Bảng `Locale` phải có **đúng một** dòng `isDefault = true` và dòng đó phải `enabled = true`. Toàn bộ cơ chế fallback ngôn ngữ (§7.1) sụp nếu vi phạm.

---

## 7. Route map

### 7.1 Công khai

| Route | Nội dung | Nguồn |
|---|---|---|
| `/[locale]` | Hero + sơ đồ hệ sinh thái + grid app | `DocPage(slug="home")` + `App[]` |
| `/[locale]/apps` | Danh sách app, lọc theo `kind` | `App[]` |
| `/[locale]/apps/[slug]` | Trang app | `App` + `Feature[]` + `Section[]` |
| `/[locale]/docs/[slug]` | Dev guide, OAuth guide… | `DocPage` + `Section[]` |

**Layout:** sidebar trái (điều hướng, nhóm theo `DocPage.group` + `order`) · nội dung giữa · ToC phải (dựng từ `Section.anchor`).

**Sinh trang tĩnh:** `generateStaticParams` sinh tích Descartes `locale × slug` từ nội dung đã publish. `dynamicParams` để mặc định `true` — nghĩa là **app mới tạo trong CMS vẫn có trang ngay mà không cần redeploy**: lần truy cập đầu render on-demand rồi được cache.

**Fallback ngôn ngữ:** thiếu bản dịch cho locale đang xem → render bản dịch của locale mặc định kèm badge "Chưa có bản <ngôn ngữ>". Lý do: đọc được tiếng Việt tốt hơn thấy trang trống, và badge tự trở thành danh sách việc cần dịch.

**SEO:** mỗi trang phát `hreflang` cho mọi locale đang bật + `x-default` trỏ locale mặc định; canonical trỏ chính nó.

### 7.2 Quản trị

```
/admin/login
/admin                  Dashboard: gì đang DRAFT, app nào thiếu bản dịch
/admin/apps             List: kéo thả sắp xếp, toggle publish
/admin/apps/new
/admin/apps/[id]        Editor
/admin/docs
/admin/docs/[id]
/admin/media            Thư viện ảnh, upload
/admin/locales          Bật/tắt ngôn ngữ, đặt mặc định
```

### 7.3 Tìm kiếm

Route handler `GET /api/search-index/[locale]` trả về JSON (`slug`, `title`, `text` đã strip markdown) cho toàn bộ nội dung đã publish của locale đó. Bọc trong `unstable_cache` với tag `search-index`, được revalidate cùng lúc với nội dung — nên sửa trong CMS xong là tìm kiếm ra ngay.

Client tải index lười (chỉ khi mở ô tìm kiếm) và fuzzy match phía trình duyệt. Với quy mô ~10 app, index chỉ vài chục KB. Không cần Postgres full-text, không cần Algolia.

> Lưu ý: index **không** sinh lúc build. Sinh lúc build sẽ khiến kết quả tìm kiếm lệch với nội dung cho tới lần deploy kế tiếp, phá vỡ lời hứa "sửa là thấy ngay".

---

## 8. CMS

### 8.1 Bố cục editor một app

```
┌────────────────────────────────────────────────────────────┐
│ ← Apps    web-store-apps          [VI] EN   Preview  Lưu   │
├────────────────────────────────────────────────────────────┤
│ ▸ Thông tin chung        (không theo ngôn ngữ)             │
│   slug · kind · status · logo · techStack · repo/demo URL  │
├────────────────────────────────────────────────────────────┤
│ ▸ Nội dung  ── VI ──────────────── EN: 3/8 mục ⚠          │
│   Tên · Tagline · Tóm tắt                                  │
├────────────────────────────────────────────────────────────┤
│ ▸ Tính năng                                    + Thêm      │
│   ⠿ [icon] Đăng nhập OTP        ✎ 🗑                       │
│   ⠿ [icon] Magic link           ✎ 🗑                       │
├────────────────────────────────────────────────────────────┤
│ ▸ Mục nội dung                                 + Thêm      │
│   ⠿ Quick start      #quick-start        ▾ mở editor       │
│   ⠿ Cách dùng        #usage              ▸                 │
└────────────────────────────────────────────────────────────┘
```

### 8.2 Bốn quyết định UX

1. **Nút chuyển ngôn ngữ đặt trên cùng, dùng chung toàn trang** — không phải mỗi trường một cặp ô vi/en. Viết trọn vẹn một ngôn ngữ rồi chuyển. Ít nhiễu hơn hẳn khi có từ ba ngôn ngữ.
2. **Chỉ báo độ hoàn thiện bản dịch** (`EN: 3/8 mục ⚠`) đặt ngay cạnh nút chuyển. Với nội dung song ngữ bắt buộc, việc khó nhất là *biết mình còn thiếu gì*.
3. **Tách rõ khối "không theo ngôn ngữ" và "theo ngôn ngữ"** — đổi ngôn ngữ chỉ khối dưới thay đổi, không gây nhầm lẫn "sửa slug ở bản EN thì bản VI có đổi không".
4. **Kéo thả cho Feature và Section** — thứ tự trong CMS là thứ tự hiển thị thật.

### 8.3 Luồng lưu

Server Action → `requireAdmin()` → validate Zod → ghi qua `src/server/content/` → revalidate tag → toast xác nhận.

Tag cần revalidate:

| Thay đổi | Tag |
|---|---|
| Nội dung một app | `app:<slug>`, `search-index` |
| Tên / thứ tự / trạng thái publish | thêm `nav`, `apps-list` |
| Nội dung một trang docs | `doc:<slug>`, `search-index` |
| Ngôn ngữ bật/tắt | `nav`, và cần redeploy (xem §9) |

### 8.4 Xem trước bản nháp

`/[locale]/apps/[slug]?preview=<token>` — `force-dynamic`, đọc thẳng DB kể cả `status=DRAFT`, chỉ chấp nhận khi có session admin hợp lệ **và** token khớp `PREVIEW_SECRET`.

---

## 9. i18n

### 9.1 Hai tầng tách biệt

| Tầng | Ví dụ | Ở đâu | Sửa bằng |
|---|---|---|---|
| Chuỗi giao diện | "Tính năng", "Xem repo", nhãn nút | `src/i18n/messages/{vi,en}.json` | sửa code + deploy |
| Nội dung | Tên app, tagline, feature, thân Section | DB (`*Translation`) | CMS, không deploy |

Chuỗi giao diện sinh ra cùng lúc với code — bắt phải vào CMS nhập nhãn trước khi nút hiện chữ là sai luồng làm việc và dễ deploy ra bản thiếu chữ.

### 9.2 Định tuyến

Prefix luôn có: `/vi/apps/…`, `/en/apps/…`. Không dùng kiểu "locale mặc định không prefix" — SSG sinh URL tường minh, `hreflang` sạch, không có route mơ hồ giữa `/apps` và `/[locale]`.

### 9.3 Giới hạn đã biết: thêm ngôn ngữ cần một lần redeploy

Middleware của next-intl chạy ở edge và không nên chạm DB. Danh sách locale mà middleware dùng là file `src/i18n/locales.generated.ts`, sinh lúc `prebuild` từ bảng `Locale` bằng `scripts/generate-locales.ts`.

Hệ quả:
- Sửa **nội dung** ở bất kỳ ngôn ngữ nào → hiện ngay, không deploy
- **Thêm một ngôn ngữ mới** → thêm dòng vào `Locale` **và cần một lần redeploy**

Chấp nhận đánh đổi này: thêm ngôn ngữ là việc hiếm và dù sao cũng kéo theo hàng giờ dịch thuật; né nó thì phải bỏ middleware và tự viết lại toàn bộ negotiation, không tương xứng.

---

## 10. Auth

### 10.1 Bề mặt công khai

```ts
// src/server/auth/index.ts — phần còn lại của app CHỈ biết ba hàm này
export type SessionUser = { id: string; email: string; name?: string; roles: string[] }

export function getCurrentUser(): Promise<SessionUser | null>
export function requireAdmin(): Promise<SessionUser>   // không phải admin → redirect /admin/login
export function signOut(): Promise<void>
```

**Hiện tại:** `src/server/auth/providers/credentials.ts` — Auth.js Credentials, một tài khoản, `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (**hash bcrypt**, không phải mật khẩu thô).

**Tương lai:** thêm `providers/idms-oauth.ts` cài đúng ba hàm trên bằng Authorization Code + PKCE tới `api-web-store-apps`. Không file nào khác phải sửa.

### 10.2 Server Action là endpoint riêng

Trong Next.js, Server Action là endpoint HTTP độc lập. **Bảo vệ `layout.tsx` của `/admin` không bảo vệ các action.**

Quy tắc bắt buộc: **mọi server action ghi dữ liệu gọi `requireAdmin()` ở dòng đầu**, kể cả khi nó chỉ được gọi từ trang admin. Có test e2e gọi thẳng action khi chưa đăng nhập để chứng minh bị chặn.

### 10.3 Khác

- Rate-limit `/admin/login`: 5 lần / 15 phút theo IP
- Cookie: `httpOnly`, `secure`, `sameSite=lax`
- CSRF do Auth.js lo

---

## 11. Ảnh

Cloudflare R2, truy cập qua `@aws-sdk/client-s3`, bọc trong `src/server/media/`.

- Ảnh dùng ở ba chỗ: `App.logoUrl`, screenshot chèn trong markdown, OG image
- `Media` là thư viện dùng chung, không gắn cứng vào App — vì ảnh sơ đồ kiến trúc sẽ được dùng lại ở nhiều trang guide
- Upload: kiểm mime **bằng magic bytes** (không tin đuôi file), giới hạn dung lượng, đặt tên ngẫu nhiên
- Trong test: mock tầng `media/`, không gọi R2 thật

---

## 12. Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| Slug không tồn tại / chưa publish | `notFound()` → `not-found.tsx` theo locale, kèm gợi ý app khác |
| Thiếu bản dịch | Fallback locale mặc định + badge (§7.1) |
| Neon suspend / DB chết | Trang công khai không ảnh hưởng (HTML tĩnh trên CDN). `/admin` và preview hiện thông báo rõ ràng + nút thử lại |
| Markdown | `remark` + `rehype-sanitize`; code block tô màu bằng `shiki` lúc render, không cần JS client |
| Trùng slug | Thông báo tiếng Việt dễ hiểu, không để lộ lỗi Prisma `P2002` |
| Input server action | Zod, không có ngoại lệ |

Sanitize markdown dù nội dung do chính chủ viết: hôm nay một người viết, khi nối IDMS sẽ là nhiều người, và lúc đó không ai nhớ quay lại thêm sanitize.

---

## 13. Kiểm thử

### 13.1 Vitest

Tầng `src/server/content/` chạy trên **DB thật** (Neon branch `test` qua `DATABASE_URL_TEST`), không mock Prisma — thứ dễ sai nhất chính là câu query đa ngôn ngữ. `prisma migrate reset` trước mỗi lần chạy suite.

Ngoài ra: logic fallback bản dịch, renderer markdown + sanitize, bộ dựng search index, sinh anchor/slug, các schema Zod.

### 13.2 Playwright

**Công khai:** landing → mở trang app → đổi ngôn ngữ giữ nguyên trang → click ToC nhảy đúng anchor → slug sai ra 404.

**Quản trị:** đăng nhập → tạo app → thêm/xóa/kéo thả feature → upload ảnh → preview bản nháp → publish.

**Test cốt lõi:** sửa nội dung trong CMS → tải lại trang công khai → thấy nội dung mới. Đây là lời hứa trung tâm của cả hệ thống; revalidate hỏng thì mọi thứ khác vô nghĩa.

**Test bảo mật:** POST thẳng vào server action khi chưa đăng nhập → phải bị từ chối.

### 13.3 Ba quy ước rút từ kinh nghiệm trên chính máy này

1. **`vitest` không typecheck.** Suite xanh không chứng minh `tsc` sạch. Luôn chạy `tsc --noEmit` tách riêng trong CI, và chạy `npm run build` trước khi tuyên bố hoàn thành — không lấy số test xanh làm bằng chứng.
2. **Vitest chạy song song trên máy Windows này hay flaky khi máy tải nặng.** Một test fail dưới lần chạy song song chưa được coi là fail thật cho tới khi lặp lại được với `--maxWorkers=1`.
3. **Test component dùng `fireEvent`, không dùng `userEvent.type`** — chính vì lý do trên.

---

## 14. Hạ tầng và biến môi trường

| Hạng mục | Dịch vụ | Hạn mức miễn phí (kiểm tra 2026-08-17) |
|---|---|---|
| Hosting | Vercel Hobby | Cấm dùng cho mục đích thương mại |
| Database | Neon | 0.5 GB/project · 100 CU-hours/project · 10 branch/project · autosuspend sau 5 phút |
| DB test | Neon branch `test` | Chung hạn mức project |
| Ảnh | Cloudflare R2 | 10 GB/tháng · 1 triệu Class A · 10 triệu Class B · egress miễn phí |

```
DATABASE_URL              # Neon, branch chính
DATABASE_URL_TEST         # Neon, branch test
AUTH_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD_HASH       # bcrypt, KHÔNG phải mật khẩu thô
PREVIEW_SECRET
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL
NEXT_PUBLIC_SITE_URL
```

---

## 15. Nội dung seed ban đầu

Seed từ README công khai đã khảo sát ở §2. Nội dung sơ bộ, **có thể thiếu hoặc sai ở phần quick start** vì viết từ README chứ không từ mã nguồn — chủ đích là để chủ dự án sửa lại qua CMS.

Một cặp client/api là **một** bản ghi `App` (dùng `repoUrl` + `apiRepoUrl`), không phải hai — vì với người đọc docs thì đó là một sản phẩm.

| # | slug | kind | repoUrl | apiRepoUrl |
|---|---|---|---|---|
| 1 | `web-store-apps` | CORE | `web-store-apps` | `api-web-store-apps` |
| 2 | `match-cv` | SATELLITE | `client-web-app-match-cv` | `api-web-app-match-cv` |
| 3 | `app-manage-gym` | SATELLITE | `app-manage-gym` | — |
| 4 | `app-calculate-badminton` | SATELLITE | `app-calculate-badminton` | — |
| 5 | `app-AI-study-coach` | SATELLITE | `app-AI-study-coach` | — |
| 6 | `shorten-link` | SATELLITE | — (private) | — |

Bản ghi số 6 được tạo **rỗng**, chỉ có slug và `isRepoPrivate = true`, `status = DRAFT` — không có nội dung để seed vì repo private. Chủ dự án tự nhập qua CMS rồi publish.

**DocPage:** `home`, `ecosystem-overview`, `oauth-integration-guide`, `add-new-app-guide`.
**Locale:** `vi` (mặc định), `en`.

---

## 16. Quy trình thiết kế giao diện

Giao diện phải được duyệt **trước khi viết bất kỳ dòng code ứng dụng nào.**

**Công cụ:** MCP `jonthebeef/superdesign-mcp-claude-code` (không cần tài khoản, dùng LLM sẵn có của Claude Code), kèm skill `frontend-design`.

**Phong cách:** technical docs kiểu Stripe/Vercel — sạch, dày đặc thông tin, typography rõ thứ bậc, điểm nhấn bằng font mono, màu tiết chế. Ưu tiên đọc lâu không mỏi.

**Các bước:**
1. Dựng design system (màu, chữ, spacing, component)
2. Sinh mockup **HTML tĩnh** (HTML + Tailwind thuần, **không phải Next.js**) — sửa trong vài giây, vứt đi không tiếc
3. Publish gallery thành Artifact → chủ dự án xem trên trình duyệt bất kỳ
4. Lặp bước 2–3 tới khi được duyệt
5. Chỉ sau khi duyệt mới viết implementation plan và code ứng dụng

**Sáu màn hình:**

*Công khai* — (1) Landing: hero + sơ đồ hệ sinh thái + grid app · (2) Trang app: sidebar + nội dung + ToC + khối tính năng + badge "Private repo" · (3) Trang dev guide: code block, sơ đồ luồng OAuth, callout

*Quản trị* — (4) Editor app (màn phức tạp nhất) · (5) Thư viện ảnh · (6) Login

Cộng bản **mobile** cho màn 1 và 2 — docs hay được đọc trên điện thoại, layout ba cột sẽ sập nếu không thiết kế từ đầu.

> Cả Superdesign MCP lẫn skill chính thức đều là *design orchestrator* — chúng đưa ra chỉ dẫn, HTML cuối cùng vẫn do agent viết. Chất lượng phụ thuộc chủ yếu vào hướng thiết kế đã chốt, không phải vào công cụ.

---

## 17. Rủi ro và giả định

| # | Rủi ro / Giả định | Ứng phó |
|---|---|---|
| R1 | Nội dung seed viết từ README, quick start có thể sai | Nêu rõ ở §15; chủ dự án sửa qua CMS. Nếu cần chính xác cao, clone repo về đọc mã nguồn |
| R2 | `client-web-app-shorten-link` private, không có dữ liệu | Bản ghi rỗng + `isRepoPrivate = true` |
| R3 | Superdesign MCP là dự án cộng đồng, không rõ còn bảo trì; README hướng dẫn config vào `~/.claude-code/mcp-settings.json` đã lỗi thời | Đăng ký bằng `claude mcp add`. Nếu hỏng, lùi về skill `frontend-design` — kết quả xem được như nhau |
| R4 | Vercel Hobby cấm dùng thương mại | Trang portfolio cá nhân thì không sao; thương mại hoá thì phải lên Pro |
| R5 | Neon free 100 CU-hours/project, chạy e2e nhiều sẽ tiêu hao | Theo dõi; nếu thiếu thì tách branch test sang project Neon riêng (free tier cho tới 100 project) |
| R6 | Thêm ngôn ngữ mới cần redeploy | Chấp nhận, xem §9.3 |
| R7 | Chưa app vệ tinh nào nối IDMS — docs mô tả một phần là kiến trúc mục tiêu | Nội dung do người viết kiểm soát, phân biệt rõ hiện trạng và mục tiêu; hệ thống không tự suy diễn |
| R8 | Kiểm thử tầng content dùng DB qua mạng nên chậm hơn local | Chấp nhận để khỏi cài Docker; nếu quá chậm thì cân nhắc Docker Postgres sau |
| R9 | Branch `test` chỉ có **một**, mà `prisma migrate reset` xoá sạch dữ liệu. Hai phiên chạy suite cùng lúc (CI và máy local, hoặc hai phiên Claude song song) sẽ xoá dữ liệu của nhau giữa chừng → test fail một cách khó hiểu | Coi branch `test` là tài nguyên độc chiếm: không chạy hai suite cùng lúc. Nếu cần chạy song song thật, tạo thêm branch `test-ci` riêng cho CI (free tier cho tới 10 branch/project) |

---

## 18. Định nghĩa hoàn thành

- [ ] Sáu màn hình mockup được duyệt trước khi viết code ứng dụng
- [ ] Trang công khai render đúng cả `vi` và `en`, có fallback + badge
- [ ] CMS tạo/sửa/xóa được app, feature, section, trang docs, ảnh
- [ ] Sửa nội dung trong CMS → trang công khai đổi mà không cần deploy (có e2e chứng minh)
- [ ] Server action từ chối người chưa đăng nhập (có e2e chứng minh)
- [ ] Tìm kiếm phản ánh nội dung mới nhất
- [ ] `npm run build` và `tsc --noEmit` sạch
- [ ] Seed chạy được, cho ra 6 app (5 có nội dung + 1 rỗng) và 4 trang docs
