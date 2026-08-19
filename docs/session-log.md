# Nhật ký phiên làm việc

**Ghi ngày:** 19.08.2026 · commit `6892d1d`

File này ghi lại **vì sao mọi thứ thành ra như thế**: quyết định nào đã chốt và lý do, cách làm việc, và những gì đã trả giá để biết. Nó khác [`status.md`](status.md) — file kia trả lời *"đang ở đâu, còn nợ gì"*, file này trả lời *"đã đi qua những gì"*.

Đọc nó khi bạn định **lật một quyết định** hoặc thấy một chỗ trong mã trông kỳ lạ. Nhiều thứ trông kỳ lạ vì có lý do, và lý do đó nằm ở đây.

---

## 1. Đường đi của dự án, ba chặng

| Chặng | Commit | Việc |
|---|---|---|
| **Dựng từ số không** | `3466e0e` → `555ec8a` (17.08) | Khảo sát hệ sinh thái GitHub → spec → mockup 6 màn → 17 task → chạy app thật |
| **Giao diện v3 + cây điều hướng** | `e423774` → `74db9e2` (18.08) | Lấy ý tưởng từ tài liệu Claude Code → mockup v2/v3 → spec → 9 task |
| **Trả nợ** | `1e5840e` → `6892d1d` (19.08) | Chín mục nợ trong `status.md` §4, làm hết |

Mỗi chặng đi cùng một lối: **khảo sát thật → spec → kế hoạch → subagent chạy song song → chạy app và xem tận mắt**. Không chặng nào bỏ bước cuối, và bước cuối là bước bắt được nhiều lỗi nhất.

---

## 2. Chín quyết định lớn, và vì sao

### 2.1 Nội dung nằm trong DB, không trong file Markdown

Yêu cầu gốc là *"trang docs cho hệ sinh thái"*. Giữa buổi brainstorm, yêu cầu đổi thành *"tôi muốn một trang CMS"* — sửa nội dung không phải deploy lại. Đó là chỗ dự án rẽ hướng: từ một trang tĩnh thành một ứng dụng full-stack có database, auth, và trang quản trị.

**Hệ quả bạn sẽ gặp:** nguồn sự thật là DB, **không phải** `prisma/seed.ts`. Sau lần deploy đầu, sửa nội dung qua CMS; đừng sửa seed.

### 2.2 SSG + revalidate theo tag, không phải SSR

Docs là nội dung **đọc nhiều ghi ít**. Trang công khai là HTML tĩnh trên CDN; khi CMS ghi, `revalidateTag` làm mới đúng trang đó. Chọn SSR sẽ khiến mỗi lượt xem là một truy vấn Neon, và người đọc thỉnh thoảng ăn cold start vì Neon tự ngủ sau 5 phút.

### 2.3 Locale là **dòng**, không phải **cột**

Mọi text nằm trong bảng `*Translation` với cột `locale`. Thêm tiếng thứ ba = thêm dữ liệu, **không migrate schema**.

Ngược lại, `DocPage.group` từng là một chuỗi phẳng không theo ngôn ngữ — nên nó **không dịch được**, và đó là lý do nó `null` ở mọi bản ghi suốt hai chặng đầu. Quyết định treo lâu nhất của dự án. Cây điều hướng (§2.6) giải nó: nút chứa là một `NavNode` thật, mà `NavNode` có bảng dịch.

### 2.4 Ba cửa duy nhất, có test canh

`src/server/content/` là nơi **duy nhất** chạm Prisma · `src/server/auth/` nơi duy nhất biết Auth.js · `src/server/media/` nơi duy nhất biết SDK S3.

Không phải quy ước trong tài liệu — có test tự động quét mã và đỏ nếu vi phạm (`src/server/auth/boundary.test.ts`). Nhờ vậy đổi cache, đổi DB, đổi nhà cung cấp lưu trữ, đổi cơ chế auth — mỗi thứ chỉ chạm một tầng.

### 2.5 Trang nói thật về hiện trạng

Tính tới hôm nay **chưa ứng dụng vệ tinh nào thực sự nối vào IDMS**. Trang chủ hiển thị đúng như vậy: sơ đồ đấu nối dùng **kiểu nét mang thông tin** — nét liền là đã nối, nét đứt là dự kiến, không nét là chạy độc lập.

Nguyên tắc này được viết thành quy tắc `design-rules.md` §7 và đã chặn nhiều thứ trong thực tế: trang ảnh không dựng vùng kéo-thả khi chưa cấu hình R2 · nút chứa rỗng không publish được · mục điều hướng chưa dựng xong hiện dạng chữ mờ không bấm được thay vì liên kết 404 · tab "Tham chiếu" không được seed vì chưa có nội dung.

### 2.6 Một cây điều hướng, ba loại nút

Dải tab trên cùng và sidebar trái là **cùng một cây** `NavNode` tự tham chiếu. Nút gốc (`parentId = null`) chính là tab; con cháu là sidebar.

Yêu cầu gốc là *"cha có con thì không có nội dung, chỉ toggle"*. Áp thẳng lên `App` sẽ khiến một ứng dụng có con **mất repo, tech stack, tính năng** — dữ liệu còn trong DB nhưng không đường nào tới được. Nên quy tắc đó **buộc** ra loại nút thứ ba: `CONTAINER` chỉ để gom. `App` và `DocPage` **luôn là lá**.

**URL giữ phẳng** (`/apps/<slug>`), cây chỉ điều khiển *cách hiển thị điều hướng*. Lồng URL theo cây sẽ kéo theo route catch-all, slug trùng giữa các nhánh, và mọi liên kết cũ gãy khi ai đó kéo một mục sang nhánh khác.

### 2.7 Không webfont, và Georgia bị cấm

Bộ chữ phủ đủ dấu tiếng Việt đều nặng, mà trang docs tải chậm là mất lý do tồn tại. Cá tính đến từ **cách sắp chữ**, không từ tên phông.

**Georgia bị cấm trong mọi font stack.** Nó thiếu glyph tiếng Việt dựng sẵn: `ế` render thành `ê` kèm dấu sắc rời lơ lửng. Trang tham chiếu (`code.claude.com/docs`) dùng `Georgia, "Times New Roman", serif` làm dự phòng — chép nguyên si thì **mọi tiêu đề tiếng Việt trên Windows đều vỡ**. Đã render sáu phông serif hệ thống và nhìn tận mắt; `tokens.test.ts` có test đỏ ngay nếu Georgia quay lại.

### 2.8 Cỡ chữ đo từ trang thật, không tự chọn

Mở năm trang docs lớn và đọc `getComputedStyle` của đoạn văn dài nhất:

| | Thân bài | Tỉ lệ dòng | H1 |
|---|---|---|---|
| Claude Code · Stripe · Next.js · MDN | **16** | 1.63–1.75 | 32–40 |
| Tailwind | 14 | 2.00 | 30 |
| **Ducker** | **16** | **1.75** | **36** |

Đo dòng chốt **66 ký tự** — hẹp hơn nhóm 86–96, vì tiếng Việt nhiều dấu và dòng dài thì mắt dễ lạc khi xuống dòng. Tỉ lệ dòng 1.75 không phải sở thích: dấu chồng (ế ữ ộ ằ) chạm chân dòng trên ở tỉ lệ chật.

### 2.9 Auth đơn giản trước, để ngỏ đổi sang IDMS

Một tài khoản, hash bcrypt trong env. Nhưng bọc sau lớp chỉ lộ ra bốn hàm. Ngày đổi sang IDMS OAuth, chỉ cần thêm `src/server/auth/providers/idms-oauth.ts` — không file nào khác phải sửa.

---

## 3. Cách làm việc, và vì sao nó bắt được lỗi

### 3.1 Subagent chạy song song, chia theo vùng file

Task rời nhau thì chạy đồng thời, mỗi agent được cấp một danh sách file và **bị dặn rõ agent khác đang giữ vùng nào**. Đợt nào cũng khép lại bằng: chạy toàn bộ test → `tsc` → `eslint` → `build` → commit.

Ba điều học được:
- **Agent hết hạn mức giữa đường không mất việc** nếu nó đã viết xong file test. Một lần Task 8 dừng đúng sau pha đỏ — agent sau chỉ việc làm test xanh, không phải đoán lại thiết kế.
- **Nhiều agent tranh nhau `.next`.** Gặp `ENOENT prerender-manifest.json` thì kiểm xem có `next build` nào đang chạy, đừng truy lỗi mã.
- **File test viết trước thì pin chặt interface.** `NavEditor.test.tsx` (20 test, 429 dòng) khoá cả tên kiểu, ~60 khoá nhãn, tên action, và quy ước DOM.

### 3.2 Xem tận mắt là bước bắt buộc, không phải bước tuỳ chọn

**Bộ test xanh không bắt được lỗi CSS.** CSS không khớp thì không báo lỗi gì — nó chỉ im lặng không áp dụng.

Bằng chứng: selector `.shiki` sai **sống sót qua 108 test**. Khối mã ra đơn sắc suốt nhiều commit mà không assertion nào thấy, vì `rehype-pretty-code` không gắn class đó — nó gắn `data-theme`.

Danh sách lỗi **chỉ tìm ra bằng cách mở trang và nhìn**:

| Lỗi | Vì sao test không thấy |
|---|---|
| Khối mã đơn sắc (`.shiki` sai) | CSS không khớp thì không báo lỗi |
| Danh sách markdown mất số thứ tự | Preflight Tailwind đặt `list-style: none` |
| Tiêu đề serif nhưng **weight 700** | Năm quy tắc `.title` đè lên `globals.css`; selector class thắng selector thẻ |
| `h1` trang quản trị **mono 14px**, nhỏ hơn thân bài | Không có gì so sánh cỡ giữa các trang |
| `DocsShell` chừa cột trống 208px | Nó chừa theo prop **có tồn tại**, không theo prop render ra gì |
| Nút "Chọn ảnh" vỡ hai dòng | Vẫn không cuộn ngang, vẫn trên 24px |
| `WireDiagram` nhãn "IDMS" thiếu `uppercase` | Không quy tắc nào kiểm được ý định |
| Nút chủ đề kéo dài hết cột sidebar | `.side` là flex column |
| Tagline rác `"Tagline vừa đổi lúc kiểm thử"` | E2E ghi thành công là xanh |

### 3.3 Đo trước khi viết, thay vì đoán rồi viết chú thích theo phỏng đoán

Vài lần việc này đổi hẳn kết quả:

- **`image-size` với SVG** — đoán *"SVG không đo được"* sẽ làm phần lớn ảnh sơ đồ của dự án mất số đo vô cớ. Đo thật: nó **suy được** kích thước từ `viewBox`, kể cả khi `width="100%"`.
- **Masthead ở 375px** — agent định thêm `flex-wrap` vì sợ chật, rồi đo: `106 + 72 + 60 + gap = 258px` trong lòng `343px`. Bỏ wrap đi.
- **Chống nháy màu** — thay vì khẳng định *"đã chống nháy"*, agent chạy **thí nghiệm đối chứng**: bản build thật, CPU chậm 20×, quay màn hình, một lượt có script và một lượt vô hiệu hoá nó. Đối chứng ra **2 khung tối**, bản thật ra **0**. Chính con số của lượt đối chứng mới làm số 0 kia có nghĩa.

### 3.4 Đọc mã trước khi tin tài liệu

`status.md` do chính mình viết mà **sai hai chỗ**, cả hai đều do agent phát hiện rồi kiểm chứng lại bằng mã:

- *"Không mutation nào ghi `DocPage.order`"* — sai. `saveDocPage` **đã** ghi nó từ ô số `#doc-order`.
- *"Deep-link `/en/admin/apps` rơi vào `/vi/admin/login`"* — mô tả sai. Điều hướng trong trình duyệt vẫn đúng ngôn ngữ nhờ `syncCookie` của next-intl; lỗi chỉ lộ ở **request nền**.

---

## 4. Mười cái bẫy đã trả giá để biết

Chi tiết đầy đủ trong [`status.md`](status.md) §5 và [`operations.md`](operations.md). Bản rút gọn:

1. **`$` trong `.env` phải escape thành `\$`.** Next expand biến, hash bcrypt (luôn chứa `$`) bị cắt từ 60 ký tự còn 48, và trang đăng nhập chỉ nói "sai mật khẩu". **Nháy đơn không cứu được** — đã thử cả bốn cách viết.
2. **Prisma CLI 7, vitest và tsx đều không đọc `.env`.** Chỉ Next đọc.
3. **`prisma migrate diff` thất bại âm thầm** khi thiếu config: in chuỗi rỗng, thoát **mã 0**, sinh file migration **0 byte** trông như thành công.
4. **Cache Next không tự mới khi ghi DB từ ngoài server đang chạy.** Nguồn có thể là `db seed`, một bộ e2e chạy trên cổng khác, hay `psql` gõ tay. Và cache nằm **trên đĩa** nên khởi động lại cũng không hết — phải `rm -rf .next`.
5. **Đổi `tokens.css`, `next.config.ts`, `.env` hay schema Prisma thì phải khởi động lại dev server.** Hot reload không đủ. Dev server giữ Prisma Client cũ sẽ làm **mọi trang 500**.
6. **Test đọc file bằng `indexOf` khắt khe hơn vẻ ngoài.** Đã vấp hai lần: một **chú thích** chứa chuỗi `@media` làm điểm cắt của `tokens.test.ts` lệch; một chú thích chứa `DROP COLUMN "group"` làm test kiểm thứ tự migration đỏ oan.
7. **`vitest` không typecheck.** Suite xanh không chứng minh `tsc` sạch — luôn chạy riêng.
8. **`revalidateTag(tag, "max")` là stale-while-revalidate.** Lượt xem **đầu tiên** sau khi ghi vẫn nhận bản cũ. Test kiểm một lần rồi kết luận sẽ đỏ ngẫu nhiên.
9. **`prisma migrate reset` bị Prisma 7 chặn với tác nhân AI**, đòi biến mang nguyên văn câu đồng ý của người dùng. Đường vòng: tạo database rỗng khác trong cùng container, deploy + seed lên đó rồi đếm, xong `DROP DATABASE`.
10. **Vitest song song hay flaky trên máy Windows này.** Test fail chưa được coi là fail thật cho tới khi lặp lại với `--maxWorkers=1`. Test component dùng `fireEvent`, **không** `userEvent.type`.

---

## 5. Bốn chỗ kế hoạch của mình sai, và agent sửa đúng

Ghi lại vì nó cho thấy nên đọc kế hoạch với thái độ nào:

- **Cách bắt chu trình sai hoàn toàn.** Kế hoạch bảo *"dùng tập `visited` khi đi xuống"*. Cách đó **không bao giờ bắt được** — nút trong vòng không có tổ tiên nào là nút gốc, nên cả vòng *không tới được*: cây vẫn dựng xong, không lỗi, dữ liệu lặng lẽ mất tích. Phải đi **lên** theo chuỗi cha.
- **Một khoá chết giữa hai bất biến** mà spec không thấy: cây chưa có nút gốc publish thì I2 (nút chứa rỗng không publish được) và I6 (phải có gốc publish) khoá cứng nhau — không thao tác đơn lẻ nào mở được.
- **Cờ `prisma migrate diff --to-schema-datamodel` không tồn tại** trên Prisma 7.9.1.
- **Một mâu thuẫn tự phủ định trong chính kế hoạch**: bước này bắt `grep "Atlas"` phải rỗng, bước kia bắt chép nguyên văn một test chứa regex `/\bAtlas\b/`.

Cũng có chỗ **mockup của chính dự án tự mâu thuẫn**: nó dùng emoji `✎ 🗑` làm ký hiệu nút, mà `design-rules` §5 cấm emoji làm ký hiệu. Đã dùng chữ.

---

## 6. Làm tiếp thế nào

1. **Mở [`status.md`](status.md) trước** — nó có trạng thái thật, việc đang chặn, và nợ còn lại.
2. **Dựng lại môi trường** theo `status.md` §2. Cần Postgres cục bộ; container Docker `app-store-doc-pg` cổng 15433.
3. **Việc còn lại duy nhất là deploy** — cần thông tin đăng nhập Neon, Cloudflare R2, Vercel. Từng bước ở [`operations.md`](operations.md).
4. **Trước khi dựng bất kỳ giao diện nào**, đọc [`design/design-rules.md`](design/design-rules.md). Mockup đã duyệt ở [`design/mockups/v3/index.html`](design/mockups/v3/index.html) — **mockup thắng** khi nó khác tài liệu.
5. **Nhật ký quyết định đầy đủ nằm trong thông điệp commit**, không phải trong file này:
   ```bash
   git log --format='%h %s%n%b'
   ```
   Mỗi commit ghi cả *lý do* của thay đổi, kể cả những chỗ làm khác kế hoạch và vì sao.

### Bốn thứ đừng lật mà không đọc lý do

- **`/admin/docs` không có nút sắp xếp** — `status.md` §4 giải thích: ô số nhận mọi số nguyên kể cả âm và trùng, còn nút mũi tên chỉ đúng khi cột là hoán vị liên tục.
- **URL giữ phẳng, không lồng theo cây** — §2.6 ở trên.
- **Không webfont, Georgia bị cấm** — §2.7, có test canh.
- **`KNOWN_DEBT` trong `tokens.test.ts` đang rỗng** — đừng thêm tên file vào đó để làm test xanh. Sửa cỡ chữ đi.
