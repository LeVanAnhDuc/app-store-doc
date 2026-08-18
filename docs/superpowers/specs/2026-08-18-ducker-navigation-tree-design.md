# Ducker — cây điều hướng và giao diện v3

**Ngày:** 2026-08-18
**Trạng thái:** Chờ duyệt
**Thay thế một phần:** [`2026-08-17-app-store-doc-design.md`](2026-08-17-app-store-doc-design.md) — §6 (data model), §7 (route), §8 (CMS), §9.3 (i18n)
**Mockup đã duyệt:** [`../../design/mockups/v3/index.html`](../../design/mockups/v3/index.html) · bản v2 (chỉ ngôn ngữ thị giác) ở `v2/`, bản v1 ở `mockups/`

---

## 1. Mục tiêu

Ba việc, làm cùng một đợt vì chúng chạm chung một tập file:

1. **Điều hướng do CMS quản.** Dải tab trên cùng và sidebar trái hiện là chrome cố định trong mã. Chúng phải thành dữ liệu, lồng sâu tuỳ ý, và sửa được qua trang quản trị.
2. **Đổi ngôn ngữ thị giác** sang hướng lấy từ trang tài liệu Claude Code: header hai tầng, tiêu đề serif, nền ấm, bản sáng gần như phi màu.
3. **Đổi tên dự án** từ *Atlas* thành **Ducker**.

## 2. Hiện trạng

Mã ứng dụng đã hoàn thành và chạy được: 111 test xanh, `tsc` sạch, `eslint` sạch, `next build` chạy được kể cả khi không có DB. Chưa deploy, chưa chạy migration thật — xem [`../../status.md`](../../status.md).

Điều hướng hiện tại:

| Chỗ | Nguồn |
|---|---|
| Dải nav trên cùng | Viết cứng trong `(public)/layout.tsx`, một phần dựng từ `listNav(locale)` |
| Sidebar trái | `DocPage.group` (chuỗi phẳng) và `App.kind` (`CORE`/`SATELLITE`) |
| Thứ tự | `order Int` trên từng bảng, sửa bằng kéo thả hoặc hai nút mũi tên |

Hai chỗ đau đã biết, spec này giải cả hai:

- **`DocPage.group` là chuỗi không theo ngôn ngữ** nên không dịch được. Đó là lý do nó đang `null` ở mọi bản ghi seed, và là quyết định treo trong `status.md`.
- **Sidebar chỉ có một tầng.** Không gom nhóm lồng nhau được.

## 3. Mô hình dữ liệu mới

### 3.1 Một cây, ba loại nút

```prisma
enum NavKind { CONTAINER APP DOC }

model NavNode {
  id           String    @id @default(cuid())
  parentId     String?              // null = nút gốc = một mục trên dải tab
  order        Int       @default(0)
  status       Status    @default(DRAFT)
  kind         NavKind
  appId        String?   @unique    // chỉ khi kind = APP
  docPageId    String?   @unique    // chỉ khi kind = DOC

  parent       NavNode?  @relation("NavTree", fields: [parentId], references: [id], onDelete: Restrict)
  children     NavNode[] @relation("NavTree")
  app          App?      @relation(fields: [appId], references: [id], onDelete: Cascade)
  docPage      DocPage?  @relation(fields: [docPageId], references: [id], onDelete: Cascade)
  translations NavNodeTranslation[]

  @@index([parentId, order])
}

model NavNodeTranslation {
  id      String  @id @default(cuid())
  nodeId  String
  locale  String
  label   String                     // chỉ dùng khi kind = CONTAINER
  node    NavNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  @@unique([nodeId, locale])
}
```

| Loại nút | Có con? | Có nội dung? | Nhãn lấy từ đâu | Bấm vào thì |
|---|---|---|---|---|
| `CONTAINER` | Có, sâu tuỳ ý | Không | `NavNodeTranslation.label` | Mở / đóng |
| `APP` | Không, luôn là lá | Có | `AppTranslation.name` | Mở `/[locale]/apps/<slug>` |
| `DOC` | Không, luôn là lá | Có | `DocPageTranslation.title` | Mở `/[locale]/docs/<slug>` |

**Nút gốc (`parentId = null`) chính là dải tab trên cùng.** Con cháu của nút gốc đang mở tạo thành sidebar trái. Một cây, một trình soạn, một bộ quy tắc thứ tự.

### 3.2 Vì sao có loại nút thứ ba

Yêu cầu gốc: *cha có con thì không có nội dung, chỉ toggle mở con*. Áp thẳng quy tắc đó lên `App` sẽ khiến một ứng dụng có con mất repo, tech stack, tính năng, mục nội dung — dữ liệu vẫn nằm trong DB nhưng không đường nào tới được. Vô nghĩa.

Nên quy tắc **buộc** ra một loại nút chỉ để gom. `App` và `DocPage` vì vậy luôn là **lá**; toàn bộ cấu trúc cây do `CONTAINER` tạo ra. "Sâu tuỳ ý cho cả hai" khi đó có nghĩa: lồng `CONTAINER` sâu bao nhiêu cũng được, và đặt `APP` hay `DOC` ở bất kỳ tầng nào, trộn lẫn tự do.

### 3.3 Xoá `DocPage.group`

`group String?` bị **xoá**. Vai trò của nó chuyển sang `CONTAINER`, vốn có bảng dịch riêng nên tên nhóm song ngữ được. Đây là lời giải cho quyết định treo trong `status.md`.

### 3.4 `App.kind` thu hẹp vai trò

`App.kind` (`CORE`/`SATELLITE`) **giữ lại nhưng chỉ dùng cho huy hiệu** trên thẻ và trang ứng dụng. Nó **không còn quyết định vị trí trong sidebar** — vị trí do cây quyết định. Nhóm "Lõi"/"Vệ tinh" trở thành `CONTAINER` bình thường, chủ dự án tự đặt tên, đổi tên và xoá được.

`deriveIntegration()` không đổi: vẫn đọc `kind`, `isRepoPrivate`, `isStandalone`, và vẫn không bao giờ trả `"connected"`.

## 4. Bất biến

Sáu điều dưới đây **không diễn đạt được bằng schema**, phải kiểm ở `src/server/content/` và có test riêng. Cây tự tham chiếu là chỗ dễ sinh dữ liệu vô nghĩa nhất trong cả hệ thống.

| # | Bất biến | Vi phạm thì hỏng chuyện gì |
|---|---|---|
| I1 | Nút có con **phải** `kind = CONTAINER` | Một `APP` có con sẽ mất repo, tech stack, tính năng — dữ liệu còn nhưng không tới được |
| I2 | `CONTAINER` không có con đã publish thì **không publish được** | Tab mở ra chẳng có gì, hoặc mục bấm vào không xổ ra gì. Hứa thứ không có, trái §7 design-rules |
| I3 | **Không có chu trình** — nút không được là hậu duệ của chính nó | Vòng lặp vô hạn khi dựng cây, treo trang |
| I4 | Một `App`/`DocPage` chỉ được gắn vào **đúng một** nút | Trùng chỗ thì trang hiện hai lần trong sidebar và chỉ mục tìm kiếm đếm đôi. Ép bằng `@unique` trên `appId`/`docPageId` |
| I5 | `CONTAINER` phải có nhãn ở **locale mặc định** | Sidebar hiện một dòng trống bấm được, không ai đoán được nó là gì |
| I6 | Phải có **ít nhất một** nút gốc đã publish | Không có tab nào thì không có đường vào bất cứ đâu |

I1 và I4 ép được một phần ở tầng DB. I2, I3, I5, I6 phải kiểm bằng mã.

**Một lỗ hổng của I2 phải bịt riêng.** `NavNode.app` và `NavNode.docPage` dùng `onDelete: Cascade`, nên xoá một `App` sẽ xoá nút lá của nó **mà không đi qua tầng kiểm**. Nếu đó là con cuối cùng của một `CONTAINER` đang publish, ta còn lại một container rỗng đã publish — đúng thứ I2 cấm, nhưng cascade thì không biết. Vậy `deleteApp` và `deleteDocPage` trong `mutations.ts` phải **kiểm lại I2 trên cha sau khi xoá**, và tự hạ container rỗng xuống `DRAFT` kèm thông báo cho người dùng biết chuyện đó vừa xảy ra. Có test cho đúng tình huống này.

Ngoài ra `kind` và cột trỏ phải khớp: `APP ⟺ appId != null`, `DOC ⟺ docPageId != null`, `CONTAINER ⟺ cả hai null`. Ép bằng CHECK constraint viết tay trong migration, cùng lối với `section_single_owner` đã có.

## 5. Đường dẫn

**URL giữ phẳng, không lồng theo cây:** `/[locale]/apps/<slug>`, `/[locale]/docs/<slug>`.

Cây chỉ điều khiển *cách hiển thị điều hướng*, không điều khiển đường dẫn. Lồng URL theo cây sẽ kéo theo route catch-all, bài toán slug trùng giữa các nhánh, và mọi liên kết cũ gãy khi ai đó kéo một mục sang nhánh khác — đổi lại không được lợi gì.

**`CONTAINER` không có URL riêng.** Bấm vào nó chỉ mở/đóng. Ai gõ thẳng địa chỉ nó thì chuyển tới **con đầu tiên đã publish** theo thứ tự cây; không có con nào publish thì `notFound()`.

**Ứng dụng chưa gắn vào cây** vẫn mở được bằng URL, và vẫn nằm trong chỉ mục tìm kiếm. Trang quản trị hiện cảnh báo *"chưa có trong điều hướng"*. Ẩn hẳn sẽ khiến người viết tưởng mình mất bài — mà bài thì vẫn còn nguyên trong DB.

## 6. Tầng truy vấn

Thêm vào `src/server/content/`:

```ts
// nav.ts — thuần, không chạm Prisma
/** Một dòng phẳng đọc từ DB, đã kèm mọi bản dịch cần để chọn nhãn. */
export type NavRow = {
  id: string;
  parentId: string | null;
  order: number;
  status: Status;
  kind: NavKind;
  /** Nhãn ứng viên theo locale: CONTAINER lấy từ NavNodeTranslation,
   *  APP từ AppTranslation.name, DOC từ DocPageTranslation.title. */
  labels: { locale: string; value: string }[];
  /** null với CONTAINER. */
  href: string | null;
};

export type NavTreeNode = {
  id: string; kind: NavKind; label: string; href: string | null;
  isFallback: boolean; children: NavTreeNode[];
};
/** Dựng cây từ danh sách phẳng. Ném lỗi nếu phát hiện chu trình (I3). */
export function buildNavTree(rows: NavRow[], locale: string, fallback: string): NavTreeNode[];
/** Đường từ gốc tới nút chứa href đã cho — để biết tab nào đang mở và mở sẵn nhánh nào. */
export function findTrail(tree: NavTreeNode[], href: string): NavTreeNode[];
/** Con lá đầu tiên đã publish, dùng khi ai đó mở thẳng URL của CONTAINER. */
export function firstLeafHref(node: NavTreeNode): string | null;
```

```ts
// queries.ts
getNavTree(locale: string): Promise<NavTreeNode[]>   // bọc unstable_cache, tag `nav`
getUnlinkedContent(): Promise<{ apps: AppCard[]; docs: DocPageRow[] }>  // không cache
```

```ts
// mutations.ts
createNavNode(input): Promise<NavNode>
updateNavNode(input): Promise<NavNode>
deleteNavNode(id): Promise<void>          // chỉ khi không còn con
moveNavNode(input: { id: string; parentId: string | null; index: number }): Promise<void>
reorderSiblings(input: { parentId: string | null; ids: string[] }): Promise<void>
```

Mọi hàm ghi kiểm I1–I6 trước khi ghi và ném lỗi tiếng Việt dễ hiểu. Mọi hàm ghi revalidate `tags.nav()`; đổi `status` hoặc gắn/gỡ nội dung thì thêm `tags.appsList()` và `tags.searchIndex()`.

**Bảng revalidate không đổi so với spec cũ §8.3**, chỉ thêm: sửa cây → `nav`.

## 7. Trình soạn cây

Trang mới `/[locale]/admin/navigation`. Bố cục ba cột theo mockup mục 02: điều hướng quản trị · cây kéo thả · bảng thuộc tính.

**Cây** hiển thị nút gốc dưới nhãn *"Dải tab trên cùng"*, con cháu thụt vào. Mỗi hàng: tay cầm kéo · mũi xổ (chỉ `CONTAINER`) · tên · huy hiệu loại · số con · bộ nút thứ tự · sửa · xoá. Nút đang chọn viền accent.

**Bảng thuộc tính** đổi theo nút đang chọn. Với `CONTAINER` chỉ có: loại, nhãn từng ngôn ngữ, trạng thái, thứ tự — cộng một khối giải thích **tại chỗ** vì sao không có ô nội dung, và chỉ cách xử lý (thêm một nút `DOC` tên "Tổng quan" làm con đầu tiên).

**Thao tác:** thêm nút gốc · thêm con vào một nút · kéo thả để đổi cha và đổi thứ tự · bộ bốn nút thứ tự.

### 7.1 Bộ nút thứ tự

Component dùng chung `OrderControls`, bốn hành động trong phạm vi **anh em cùng cha**:

| Nút | Hành động |
|---|---|
| `⤒` | Đưa lên đầu |
| `↑` | Lên một bậc |
| `↓` | Xuống một bậc |
| `⤓` | Đưa xuống cuối |

Dùng lại ở **bốn chỗ**: nút gốc (thứ tự tab trái sang phải), nút con (thứ tự sidebar), `Feature`, `Section`.

`⤒` và `↑` **mờ và không bấm được** ở phần tử đầu; `⤓` và `↓` mờ ở phần tử cuối. Không có nút nào bấm vào mà không xảy ra gì.

Bắt buộc **dùng được bằng bàn phím** — mỗi nút là `<button>` thật, không phải `<div>` gắn `onClick`. Kéo thả mà không có đường bàn phím thì người chỉ dùng bàn phím bị loại khỏi CMS. Ràng buộc này đã có ở `SortableList` hiện tại, giữ nguyên.

## 8. Ngôn ngữ thị giác

Ghi đè §2 và §3 của [`design-rules.md`](../../design/design-rules.md). Mọi giá trị dưới đây **đo bằng điểm ảnh** trên `code.claude.com/docs`, không phỏng đoán.

### 8.1 Màu

| Token | Sáng | Tối |
|---|---|---|
| `--bg` | `#FDFDF7` | `#09090B` |
| `--surface` | `#FFFFFF` | `#131316` |
| `--fill` (mục đang chọn) | `#E4E4DE` | `#1E1916` |
| `--line` | `#E2E2DA` | `#26262A` |
| `--ink` | `#171717` | `#EDEDE9` |
| `--muted` | `#6B6B63` | `#94948B` |
| `--accent` | `#8A4B24` | `#D4A27F` |
| `--eyebrow` | `#171717` | `#D4A27F` |

Bảng trên là bộ lõi. **Bộ đầy đủ** — gồm `--fill-soft`, `--line-soft`, `--ink-2`, `--accent-bg` và mười token trạng thái — lấy nguyên văn từ khối `:root` của [`mockups/v3/index.html`](../../design/mockups/v3/index.html); mockup là bản đã duyệt nên khi nó khác tài liệu thì **mockup thắng**.

**Bản sáng gần như phi màu.** Đo được: eyebrow `#0E0E0E`, liên kết `#101828`, mục đang chọn chỉ là xám ấm. Nhấn mạnh đến từ **cỡ, đậm nhạt và nền đầy**, không từ hue. Cam đất chỉ sống ở bản tối. `--eyebrow` là token **đổi vai theo chủ đề** — sáng là mực, tối là accent.

Năm màu trạng thái **giữ nguyên vai trò**, chỉnh lại cho hợp nền ấm. Chúng mang thông tin thật, không phải trang trí.

Ba trạng thái chủ đề (`:root` / `@media` bọc `:root:not([data-theme="light"])` / `:root[data-theme="dark"]`) **không đổi** so với quy tắc hiện hành.

### 8.2 Chữ

```css
--serif: Constantia, "New York", "Iowan Old Style", Cambria, "Sitka Text",
         Charter, Palatino, "Palatino Linotype", "Times New Roman", serif;
```

**Georgia bị loại khỏi stack một cách cố ý.** Nó thiếu glyph tiếng Việt dựng sẵn: `ế` render thành `ê` kèm dấu sắc rời lơ lửng, `ằ` cũng vỡ. Trang tham chiếu dùng `Georgia, "Times New Roman", serif` làm dự phòng — chép nguyên si thì **mọi tiêu đề tiếng Việt trên Windows đều vỡ**. Đã render sáu phông serif hệ thống và nhìn tận mắt; Constantia, Cambria, Sitka Text, Palatino Linotype, Times New Roman, Book Antiqua đều đúng.

- **Tiêu đề: serif, `font-weight: 400`, `letter-spacing: 0`.** Trang tham chiếu đặt H1 ở 36px/400/normal. Đây là thứ tạo cảm giác "tài liệu" thay vì "bảng điều khiển". Bỏ hẳn tracking âm cũ (`−0.022em`).
- **Thân bài giữ sans, `line-height: 1.75`** — ràng buộc dấu tiếng Việt chồng nhau, không đổi.
- **Nhãn và mã giữ mono**, hoa, `letter-spacing .09em–.15em`.
- **Vẫn không dùng webfont.** Không `next/font`, không Google Fonts, không `@font-face`.

### 8.2.1 Bậc cỡ — đo từ năm trang docs lớn

Bậc cỡ hiện hành nhỏ hơn chuẩn một cách hệ thống: thân bài 14.5px, nền chung 14px, sidebar 13.5px, nhãn mono 10px. Thay vì tự chọn, đã mở năm trang docs và đọc `getComputedStyle` của đoạn văn dài nhất trong bài:

| Trang | Thân bài | Cao dòng | Tỉ lệ | H1 | H2 | Sidebar | ~ký tự/dòng |
|---|---|---|---|---|---|---|---|
| Claude Code docs | 16 | 26.4 | 1.65 | 36 | 16 | 14 | 86 |
| Stripe docs | 16 | 26 | 1.63 | 32 | 24 | — | 62 |
| Next.js docs | 16 | 27.2 | 1.70 | 36 | 24 | 14 | 86 |
| Tailwind docs | 14 | 28 | 2.00 | 30 | 18 | 14 | 96 |
| MDN | 16 | 28 | 1.75 | 40 | 24 | 16 | 96 |
| **Ducker v3** | **16** | **28** | **1.75** | **36** | **26** | **15** | **66** |

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

**Đo dòng 66 ký tự** — giữa Stripe (62) và nhóm còn lại (86–96). Chọn phía hẹp vì tiếng Việt nhiều dấu, dòng dài mắt dễ lạc khi xuống dòng.

Ngoại lệ được phép: nhãn **mono viết hoa** ở 11–11.5px. Chữ hoa mono đọc lớn hơn cỡ danh nghĩa, và đây là mức trang tham chiếu cũng dùng cho eyebrow. Không được hạ bất kỳ **văn xuôi** nào xuống dưới 14px.

### 8.2.2 Ngưỡng vùng bấm

**WCAG 2.2 SC 2.5.8 đòi vùng bấm tối thiểu 24×24 CSS px.** Bộ nút thứ tự ở bản hiện hành chỉ cao khoảng 18px — **không đạt**. Bốn nút nhỏ nằm sát nhau là chỗ dễ bấm nhầm nhất trong cả trang quản trị, mà bấm nhầm `⤓` thay vì `↓` thì mục nhảy thẳng xuống cuối.

Thêm token `--tap: 28px` (chọn 28 chứ không phải 24 để còn chỗ thở) và áp `min-height`/`min-width` cho **mọi** phần tử bấm được: nút thứ tự, mục sidebar, ô nhập, nút, nút chuyển ngôn ngữ, ô tìm kiếm.

Có test tự động quét toàn trang và **fail nếu còn phần tử bấm được nào dưới 24×24** — không dựa vào mắt người soát.

### 8.3 Bố cục

Header hai tầng: **masthead** (thương hiệu, tìm kiếm, ngôn ngữ, CTA) và **dải tab** (nút gốc của cây, gạch chân mục đang mở). Dưới đó ba cột: sidebar trái · nội dung · mục lục phải.

Mục đang chọn ở sidebar dùng **viên nền đầy** `--fill`, không phải vạch màu.

**Trang tham chiếu bỏ mục lục phải** để bảng có đủ chiều ngang — đây là ràng buộc bố cục thật, không phải sở thích.

Trên điện thoại: dải tab **cuộn ngang**, sidebar gập thành nút mở ngăn kéo đặt ngay đầu bài.

## 9. Đổi tên

*Atlas* → **Ducker** ở: `brand.*` trong `src/i18n/messages/{vi,en}.json`, `README.md`, `CLAUDE.md`, `docs/status.md`, `docs/operations.md`, seed. Slug repo và tên package **không đổi** — `app-store-doc` vẫn là tên kho mã.

## 10. Một repo là một dự án

**Model đã đúng sẵn:** `App` có `repoUrl` + `apiRepoUrl` nên một cặp client/api là **một** bản ghi. Không cần đổi schema.

Việc phải làm là ở **giao diện và seed**: trang ứng dụng hiện hai liên kết *"Repo giao diện"* và *"Repo máy chủ"* trong cùng một mục, và tuyệt đối không tạo hai nút cây cho hai kho mã của cùng một dự án. Mockup v2 từng sai chỗ này (liệt kê "API Web Store Apps" riêng); v3 đã sửa.

## 11. Migration và seed

Migration `0002_nav_tree`, sinh **offline** bằng `prisma migrate diff --from-empty --to-schema` rồi nối tay các CHECK constraint — cùng lối `0001_init`.

Thứ tự bắt buộc trong migration:

1. Tạo `NavNode`, `NavNodeTranslation`, enum `NavKind`
2. **Chuyển dữ liệu**: mỗi `DocPage.group` khác `null` thành một `CONTAINER` (nhãn = chính chuỗi group, đặt ở locale mặc định); mỗi `App`/`DocPage` thành một nút lá gắn vào container tương ứng; app không có group thì gắn vào container dựng từ `kind`
3. Chỉ sau khi (2) xong mới `DROP COLUMN "DocPage"."group"`

Đảo thứ tự là mất sạch thông tin nhóm. Với DB hiện tại thì `group` đang `null` hết nên bước (2) chỉ dựng container từ `kind`, nhưng bước này vẫn phải viết đúng để migration an toàn trên DB đã có dữ liệu.

`prisma/seed.ts` dựng sẵn cây: ba nút gốc **Hệ sinh thái · Ứng dụng · Hướng dẫn**; dưới *Ứng dụng* là hai container *Lõi* và *Vệ tinh*. **Không seed tab "Tham chiếu"** — chưa có nội dung, mà nút chứa rỗng thì I2 cấm publish.

## 12. Kiểm thử

**Thuần, không cần DB** — `buildNavTree` (dựng đúng thứ tự và độ sâu, phát hiện chu trình, fallback nhãn), `findTrail`, `firstLeafHref`, và toàn bộ hàm kiểm I1–I6.

**Cần DB** (`*.db.test.ts`, cổng `describe.skipIf`) — `moveNavNode` giữ đúng thứ tự anh em, xoá nút còn con bị chặn, gắn một App vào hai nút bị chặn bởi `@unique`.

**Component** — `OrderControls` (⤒ mờ ở phần tử đầu, ⤓ mờ ở cuối, đổi chỗ được bằng bàn phím, dùng `fireEvent` **không** dùng `userEvent.type`), `NavTree` (nút chứa toggle chứ không điều hướng, nút lá điều hướng chứ không toggle).

**E2E** — thêm một container, kéo một app vào, publish, rồi kiểm trang công khai thấy đúng nhánh mới mà không cần deploy.

**Kiểm giao diện** — trang phải render đúng ở **cả ba trạng thái chủ đề**, và không màn nào cuộn ngang ở 375px. Bài học từ đợt trước: bộ test xanh **không** bắt được lỗi CSS — selector `.shiki` sai tồn tại qua cả 108 test vì CSS không khớp thì không báo lỗi. Nên đợt này bắt buộc **chạy app thật và xem tận mắt** trước khi báo hoàn thành.

## 13. Rủi ro

| # | Rủi ro | Ứng phó |
|---|---|---|
| R1 | Migration chuyển dữ liệu chạy trên DB đã có nội dung thật | Chưa deploy nên DB thật còn rỗng. Vẫn viết bước chuyển đổi đúng, và thử trên bản sao trước khi chạy thật |
| R2 | Cây sâu quá 3–4 tầng thì người đọc mất phương hướng | Mô hình cho phép sâu tuỳ ý theo yêu cầu, nhưng trình soạn **cảnh báo** (không chặn) từ tầng thứ tư |
| R3 | Ứng dụng bị bỏ quên ngoài cây | `getUnlinkedContent()` và cảnh báo ở trang quản trị. Trang công khai vẫn mở được bằng URL |
| R4 | Đổi serif làm vỡ dấu tiếng Việt trên máy thiếu phông | Stack có 9 mức dự phòng, Georgia bị loại. Đã kiểm sáu phông bằng mắt |
| R5 | Sửa CSS diện rộng (~30 file `.module.css`) dễ sót chỗ | Kiểm bằng ảnh chụp từng màn ở cả ba trạng thái chủ đề, không dựa vào test |
| R6 | `DocPage.group` bị xoá — mã nào còn đọc nó sẽ gãy | `tsc` bắt được hết vì đây là trường có kiểu |

## 14. Ngoài phạm vi

- Lồng URL theo cây (§5)
- Sửa `api-web-store-apps` để hỗ trợ đăng ký OAuth client
- Trình soạn block-based (`SectionTranslation.body` vẫn giữ cửa mở)
- Đổi sang đăng nhập qua IDMS
- Nội dung thật cho tab "Tham chiếu"
- Đo kích thước ảnh khi upload (nợ cũ trong `status.md`)

## 15. Định nghĩa hoàn thành

- [ ] `NavNode` + `NavNodeTranslation` có trong schema, migration `0002_nav_tree` sinh offline kèm CHECK constraint
- [ ] `DocPage.group` đã xoá, dữ liệu cũ đã chuyển thành `CONTAINER`
- [ ] Sáu bất biến I1–I6 có hàm kiểm và có test
- [ ] `/admin/navigation` thêm/sửa/xoá/kéo thả/đổi thứ tự được, dùng được bằng bàn phím
- [ ] `OrderControls` dùng ở đủ bốn chỗ, nút mờ đúng lúc
- [ ] Dải tab và sidebar trái dựng từ `getNavTree`, không còn chỗ nào viết cứng
- [ ] `CONTAINER` chuyển hướng tới con đầu tiên đã publish
- [ ] `design-rules.md` §2 và §3 viết lại; không còn mã màu tím trong mã
- [ ] Bậc cỡ mới áp đủ: thân bài 16px, sidebar 15px, không văn xuôi nào dưới 14px
- [ ] Test tự động quét vùng bấm, fail nếu còn phần tử nào dưới 24×24 (WCAG 2.2 SC 2.5.8)
- [ ] Không webfont; Georgia không xuất hiện trong bất kỳ stack nào
- [ ] Tên Ducker ở mọi chỗ người dùng nhìn thấy
- [ ] Trang ứng dụng hiện hai liên kết repo trong một mục
- [ ] `npm run test:run`, `npm run typecheck`, `npm run lint`, `npm run build` đều sạch
- [ ] **Đã chạy app thật và xem tận mắt** đủ ba trạng thái chủ đề và mốc 375px
