/**
 * Dữ liệu seed ban đầu — spec §15.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ĐỌC TRƯỚC KHI TIN NỘI DUNG TRONG FILE NÀY
 *
 * Toàn bộ chữ dưới đây được viết **từ README công khai** của các repo (khảo sát
 * GitHub ngày 2026-08-17, ghi lại ở spec §2), **không** từ mã nguồn và **không**
 * qua một lần chạy thử nào. Vì vậy:
 *
 * - Nội dung là **sơ bộ**. Nó tồn tại để CMS có gì để sửa, không phải để làm
 *   nguồn tham chiếu.
 * - Phần **"Chạy thử trong 5 phút" (`quick-start`) có thể thiếu hoặc sai**: số
 *   cổng, tên biến môi trường và tên script npm đều lấy từ README, mà README là
 *   thứ lạc hậu nhanh nhất trong một repo đang phát triển.
 * - `app-AI-study-coach` mới có `docs/`, chưa có mã chạy được; nội dung của nó
 *   nói đúng điều đó chứ không dựng ra một quick start không tồn tại.
 * - `shorten-link` là repo riêng tư, không đọc được, nên bản ghi của nó **không có
 *   nội dung** — chỉ có tên hiển thị, `isRepoPrivate = true`, `status = DRAFT`.
 *
 * Ai kiểm chứng được phần nào thì sửa phần đó **qua CMS** rồi bỏ dòng cảnh báo
 * tương ứng ở đây. Đừng sửa file này để "cập nhật nội dung": sau lần deploy đầu,
 * nguồn sự thật là cơ sở dữ liệu, và seed chạy lại sẽ ghi đè bản đã sửa.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ba quyết định về hình dạng dữ liệu (spec §11, §15):
 *
 * 1. **Một cặp client/api là MỘT bản ghi `App`** (`repoUrl` + `apiRepoUrl`), không
 *    phải hai — với người đọc tài liệu thì đó là một sản phẩm.
 * 2. **Điều hướng là một cây `NavNode`, seed dựng sẵn ba nút gốc.** `DocPage.group`
 *    đã bị xoá khỏi schema (spec §3.3): nó là chuỗi không theo ngôn ngữ nên sidebar
 *    bản tiếng Anh sẽ hiện chữ Việt. Thay nó là `NavNodeTranslation`, và mọi nhãn
 *    nút chứa trong file này đều khai đủ `vi` và `en`.
 * 3. **Không seed tab "Tham chiếu".** Chưa có nội dung nào cho nó, mà bất biến I2
 *    cấm publish một nút chứa rỗng — bấm vào sẽ chẳng xổ ra gì.
 *
 * Seed ghi bằng Prisma trực tiếp, không đi qua `src/server/content/mutations.ts`:
 * tầng đó gọi `revalidateTag`, mà `revalidateTag` chỉ chạy được trong một request
 * của Next. Trước lần deploy đầu cũng chưa có cache nào để làm mới.
 *
 * Chạy: `npx prisma db seed` (hoặc `npx tsx prisma/seed.ts`). Cần `DATABASE_URL`.
 * Chạy lại được nhiều lần: mọi bản ghi upsert theo `slug`/`code`, còn tính năng và
 * mục nội dung thì xoá rồi dựng lại — nên **id của chúng không bền qua các lần seed**.
 */
import { hasDatabase, prisma } from "../src/server/db";
import { assertNavInvariants, type NavKind, type NavRow } from "../src/server/content/nav";

/** Một đoạn chữ ở cả hai ngôn ngữ. Mọi nội dung seed đều phải có đủ cả hai. */
type Text = { vi: string; en: string };

type SeedFeature = {
  /** Tên icon lucide. Không theo ngôn ngữ. */
  icon?: string;
  title: Text;
  description?: Text;
};

type SeedSection = {
  /** Không theo ngôn ngữ: `#anchor` phải trỏ đúng một chỗ ở mọi bản dịch. */
  anchor: string;
  title: Text;
  /** Markdown thô. */
  body: Text;
};

type SeedApp = {
  slug: string;
  kind: "CORE" | "SATELLITE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  order: number;
  repoUrl?: string;
  apiRepoUrl?: string;
  demoUrl?: string;
  isRepoPrivate?: boolean;
  isStandalone?: boolean;
  techStack: string[];
  name: Text;
  tagline?: Text;
  summary?: Text;
  features: SeedFeature[];
  sections: SeedSection[];
};

type SeedDocPage = {
  slug: string;
  order: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: Text;
  description?: Text;
  sections: SeedSection[];
};

/**
 * Một nút của cây điều hướng.
 *
 * `id` do file này đặt chứ không để `cuid()` sinh: nhờ vậy chạy lại seed thì upsert
 * theo đúng id cũ, không bao giờ mọc ra một tab "Ứng dụng" thứ hai. Nút chứa khai
 * `label`; nút lá khai `appSlug` hoặc `docSlug` và **không** khai nhãn, vì nhãn của
 * nó là tên ứng dụng / tiêu đề trang, dịch một lần rồi dùng ở mọi nơi.
 */
type SeedNavNode = {
  id: string;
  label?: Text;
  appSlug?: string;
  docSlug?: string;
  children?: SeedNavNode[];
};

const GITHUB = "https://github.com/LeVanAnhDuc";

// ---------------------------------------------------------------------------
// Ngôn ngữ
// ---------------------------------------------------------------------------

const LOCALES = [
  { code: "vi", label: "Tiếng Việt", enabled: true, isDefault: true, order: 0 },
  { code: "en", label: "English", enabled: true, isDefault: false, order: 1 },
] as const;

// ---------------------------------------------------------------------------
// Sáu ứng dụng (spec §15)
// ---------------------------------------------------------------------------

const APPS: SeedApp[] = [
  {
    slug: "web-store-apps",
    kind: "CORE",
    status: "PUBLISHED",
    order: 0,
    repoUrl: `${GITHUB}/web-app-store`,
    techStack: [
      "Next.js 15",
      "React 19",
      "Tailwind v4",
      "shadcn/ui",
      "Zustand 5",
      "React Query 5",
      "next-intl",
      "Express",
      "MongoDB",
      "Redis",
    ],
    name: { vi: "Web Store Apps", en: "Web Store Apps" },
    tagline: {
      vi: "Cổng đăng nhập và bảng khởi chạy ứng dụng",
      en: "Sign-in gateway and app launcher",
    },
    summary: {
      vi:
        "Giao diện của IDMS. Người dùng đăng nhập một lần ở đây, sau đó mở được mọi " +
        "ứng dụng trong hệ sinh thái mà không phải đăng nhập lại.",
      en:
        "The face of IDMS. Users sign in once here and can then open every app in the " +
        "ecosystem without signing in again.",
    },
    features: [
      {
        icon: "mail",
        title: { vi: "Đăng nhập bằng email và mã OTP", en: "Sign in with email and an OTP" },
        description: {
          vi: "Mã dùng một lần gửi qua email, không cần đặt mật khẩu.",
          en: "A one-time code arrives by email, so there is no password to set.",
        },
      },
      {
        icon: "link",
        title: { vi: "Liên kết đăng nhập một chạm", en: "One-tap sign-in link" },
        description: {
          vi: "Bấm liên kết trong email là vào được, dùng cho máy không tiện gõ.",
          en: "Follow the link in the email; useful on devices that are awkward to type on.",
        },
      },
      {
        icon: "shield-check",
        title: { vi: "Xác thực hai bước", en: "Two-factor authentication" },
        description: {
          vi: "Bật thêm một bước xác nhận cho tài khoản cần bảo vệ chặt hơn.",
          en: "Adds a second confirmation step for accounts that need tighter protection.",
        },
      },
      {
        icon: "file-check",
        title: { vi: "Màn hình đồng ý quyền", en: "Consent screen" },
        description: {
          vi: "Ứng dụng xin quyền nào thì người dùng thấy đúng danh sách đó trước khi đồng ý.",
          en: "Whatever an app asks for is exactly what the user sees before agreeing.",
        },
      },
      {
        icon: "layout-grid",
        title: { vi: "Bảng khởi chạy ứng dụng", en: "App launcher" },
        description: {
          vi: "Một chỗ liệt kê mọi ứng dụng tài khoản đang có quyền mở.",
          en: "One place listing every app the account is allowed to open.",
        },
      },
      {
        icon: "boxes",
        title: { vi: "Đăng ký ứng dụng", en: "App registry" },
        description: {
          vi: "Khai một ứng dụng mới để lấy client id và địa chỉ chuyển hướng hợp lệ.",
          en: "Register a new app to get a client id and its allowed redirect URIs.",
        },
      },
    ],
    sections: [
      {
        anchor: "la-gi",
        title: { vi: "Là gì", en: "What it is" },
        body: {
          vi:
            "IDMS gồm hai kho mã: `api-web-store-apps` là máy chủ định danh (OAuth 2.0 / OIDC), " +
            "và `web-store-apps` là giao diện người dùng nhìn thấy — trang đăng nhập, màn hình " +
            "đồng ý quyền và bảng khởi chạy.\n\n" +
            "Mọi ứng dụng khác trong hệ sinh thái *dự kiến* lấy danh tính từ đây. Tính tới " +
            "17.08.2026 chưa ứng dụng vệ tinh nào nối xong.",
          en:
            "IDMS is two repositories: `api-web-store-apps` is the identity server (OAuth 2.0 / " +
            "OIDC), and `web-store-apps` is what users actually see — the sign-in page, the " +
            "consent screen and the launcher.\n\n" +
            "Every other app in the ecosystem is *expected* to take its identity from here. As " +
            "of 2026-08-17 no satellite app has finished wiring it up.",
        },
      },
      {
        anchor: "quick-start",
        title: { vi: "Chạy thử trong 5 phút", en: "Run it in five minutes" },
        body: {
          vi:
            "Cần Node 20 trở lên. Client và server nay nằm cùng một kho; server phải chạy " +
            "trước, mặc định ở cổng 5000 (`APP_PORT`).\n\n" +
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/web-app-store.git\n" +
            "cd web-app-store/server && yarn install && yarn dev\n" +
            "```\n\n" +
            "Rồi tới giao diện, ở một shell khác:\n\n" +
            "```bash\n" +
            "cd web-app-store/client && yarn install && yarn dev\n" +
            "```\n\n" +
            "Tên script lấy từ `package.json` của từng bên; chưa chạy thử nên số cổng và " +
            "biến môi trường vẫn nên đối chiếu với `.env.example`.",
          en:
            "Needs Node 20 or newer. The client and server now live in one repository; start " +
            "the server first, on port 5000 by default (`APP_PORT`).\n\n" +
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/web-app-store.git\n" +
            "cd web-app-store/server && yarn install && yarn dev\n" +
            "```\n\n" +
            "Then the front end, in a second shell:\n\n" +
            "```bash\n" +
            "cd web-app-store/client && yarn install && yarn dev\n" +
            "```\n\n" +
            "Script names come from each side's `package.json`; nothing was executed, so check " +
            "ports and environment variables against `.env.example`.",
        },
      },
      {
        anchor: "kien-truc",
        title: { vi: "Cách hoạt động", en: "How it works" },
        body: {
          vi:
            "Luồng dùng Authorization Code kèm PKCE. Access token và refresh token nằm trong " +
            "cookie `HttpOnly`, nên mã JavaScript của ứng dụng không đọc được chúng.\n\n" +
            "ID token mang claim `locale`, nhờ vậy người dùng chọn tiếng Việt ở IDMS thì các " +
            "ứng dụng khác mở ra cũng đúng ngôn ngữ đó.\n\n" +
            "Hàng đợi công việc (gửi email, dọn token hết hạn) chạy trên Redis kèm BullMQ.",
          en:
            "The flow is Authorization Code with PKCE. Access and refresh tokens live in " +
            "`HttpOnly` cookies, so application JavaScript cannot read them.\n\n" +
            "The ID token carries a `locale` claim, so a user who picks Vietnamese in IDMS gets " +
            "the same language in every app they open next.\n\n" +
            "Background work (sending email, clearing expired tokens) runs on Redis with BullMQ.",
        },
      },
    ],
  },

  {
    slug: "match-cv",
    kind: "SATELLITE",
    status: "PUBLISHED",
    order: 1,
    repoUrl: `${GITHUB}/web-app-match-cv`,
    techStack: [
      "TanStack Start",
      "Ant Design",
      "NestJS 11",
      "Prisma 6",
      "PostgreSQL",
      "pgvector",
      "OpenRouter",
    ],
    name: { vi: "Match CV", en: "Match CV" },
    tagline: {
      vi: "So khớp CV với tin tuyển dụng",
      en: "Match a CV against a job posting",
    },
    summary: {
      vi:
        "Đọc CV và mô tả công việc, rồi chỉ ra chỗ khớp và chỗ còn thiếu. Phần so khớp " +
        "dùng vector nhúng lưu trong PostgreSQL với pgvector.",
      en:
        "Reads a CV and a job description, then points out what matches and what is missing. " +
        "Matching runs on embeddings stored in PostgreSQL with pgvector.",
    },
    features: [
      {
        icon: "file-text",
        title: { vi: "Tải CV lên và bóc tách nội dung", en: "Upload a CV and extract its content" },
        description: {
          vi: "Nhận tệp PDF, tách ra kỹ năng, kinh nghiệm và học vấn.",
          en: "Takes a PDF and pulls out skills, experience and education.",
        },
      },
      {
        icon: "search",
        title: { vi: "Chấm điểm mức độ khớp", en: "Score how well it matches" },
        description: {
          vi: "So từng yêu cầu của tin tuyển dụng với nội dung CV, kèm mức tin cậy.",
          en: "Compares each requirement in the posting with the CV, with a confidence level.",
        },
      },
      {
        icon: "list-checks",
        title: { vi: "Chỉ ra phần còn thiếu", en: "Point out the gaps" },
        description: {
          vi: "Liệt kê yêu cầu chưa có bằng chứng trong CV, để biết cần bổ sung gì.",
          en: "Lists requirements the CV shows no evidence for, so you know what to add.",
        },
      },
    ],
    sections: [
      {
        anchor: "la-gi",
        title: { vi: "Là gì", en: "What it is" },
        body: {
          vi:
            "Hai kho mã: `client-web-app-match-cv` (TanStack Start + Ant Design) và " +
            "`api-web-app-match-cv` (NestJS 11 + Prisma 6 + PostgreSQL có pgvector). Phần gọi " +
            "mô hình ngôn ngữ đi qua OpenRouter.",
          en:
            "Two repositories: `client-web-app-match-cv` (TanStack Start + Ant Design) and " +
            "`api-web-app-match-cv` (NestJS 11 + Prisma 6 + PostgreSQL with pgvector). Calls to " +
            "language models go through OpenRouter.",
        },
      },
      {
        anchor: "quick-start",
        title: { vi: "Chạy thử trong 5 phút", en: "Run it in five minutes" },
        body: {
          vi:
            "Cần PostgreSQL có phần mở rộng `pgvector` và một khoá OpenRouter. Client và " +
            "server nay nằm cùng một kho; server mặc định ở cổng 5200, client ở 5300.\n\n" +
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/web-app-match-cv.git\n" +
            "cd web-app-match-cv/server && yarn install\n" +
            "npx prisma migrate deploy && yarn start:dev\n" +
            "```\n\n" +
            "Rồi tới giao diện, ở một shell khác:\n\n" +
            "```bash\n" +
            "cd web-app-match-cv/client && yarn install && yarn dev\n" +
            "```\n\n" +
            "Tên script lấy từ `package.json` của từng bên; chưa chạy thử nên tên biến môi " +
            "trường vẫn nên đối chiếu với `.env.example`.",
          en:
            "Needs PostgreSQL with the `pgvector` extension and an OpenRouter key. The client " +
            "and server now live in one repository; the server defaults to port 5200 and the " +
            "client to 5300.\n\n" +
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/web-app-match-cv.git\n" +
            "cd web-app-match-cv/server && yarn install\n" +
            "npx prisma migrate deploy && yarn start:dev\n" +
            "```\n\n" +
            "Then the front end, in a second shell:\n\n" +
            "```bash\n" +
            "cd web-app-match-cv/client && yarn install && yarn dev\n" +
            "```\n\n" +
            "Script names come from each side's `package.json`; nothing was executed, so check " +
            "environment variable names against `.env.example`.",
        },
      },
      {
        anchor: "tich-hop",
        title: { vi: "Trạng thái nối IDMS", en: "IDMS integration status" },
        body: {
          vi:
            "**Chưa nối.** README ghi rõ phần xác thực được để lại sau (\"auth defer\"), và ứng " +
            "dụng đang dùng một hàm `current-user` giả để chạy tiếp.\n\n" +
            "Nối vào IDMS nghĩa là thay hàm giả đó bằng luồng Authorization Code + PKCE — xem " +
            "trang hướng dẫn tích hợp OAuth.",
          en:
            "**Not connected.** The README says authentication is deferred, and the app runs on a " +
            "stubbed `current-user` helper for now.\n\n" +
            "Connecting to IDMS means replacing that stub with the Authorization Code + PKCE flow — " +
            "see the OAuth integration guide.",
        },
      },
    ],
  },

  {
    slug: "app-manage-gym",
    kind: "SATELLITE",
    status: "PUBLISHED",
    order: 2,
    repoUrl: `${GITHUB}/web-app-manage-gym`,
    techStack: ["Next.js 16", "React 19", "Prisma 7", "PostgreSQL", "Auth.js"],
    name: { vi: "Manage Gym", en: "Manage Gym" },
    tagline: {
      vi: "Quản lý phòng tập cho một người dùng",
      en: "Single-user gym management",
    },
    summary: {
      vi:
        "Theo dõi hội viên, gói tập và lịch tập của một phòng tập. Bản hiện tại dựng cho " +
        "đúng một người dùng: chủ phòng tập.",
      en:
        "Tracks members, plans and schedules for one gym. The current build is meant for exactly " +
        "one user: the owner.",
    },
    features: [
      {
        icon: "users",
        title: { vi: "Danh sách hội viên", en: "Member list" },
        description: {
          vi: "Thêm hội viên, xem gói đang dùng và ngày hết hạn.",
          en: "Add members, see their current plan and when it expires.",
        },
      },
      {
        icon: "calendar",
        title: { vi: "Lịch tập", en: "Training schedule" },
        description: {
          vi: "Xếp buổi tập theo tuần và biết buổi nào còn chỗ.",
          en: "Lay sessions out by week and see which ones still have room.",
        },
      },
      {
        icon: "receipt",
        title: { vi: "Gói tập và thanh toán", en: "Plans and payments" },
        description: {
          vi: "Ghi lại gói đã bán và các khoản đã thu.",
          en: "Records which plans were sold and what has been collected.",
        },
      },
    ],
    sections: [
      {
        anchor: "la-gi",
        title: { vi: "Là gì", en: "What it is" },
        body: {
          vi:
            "Một ứng dụng Next.js 16 dùng Prisma 7 với PostgreSQL, xác thực bằng Auth.js. " +
            "Toàn bộ nằm trong một kho mã duy nhất, không có máy chủ riêng.",
          en:
            "A Next.js 16 app on Prisma 7 with PostgreSQL, authenticating through Auth.js. " +
            "Everything lives in a single repository; there is no separate server.",
        },
      },
      {
        anchor: "quick-start",
        title: { vi: "Chạy thử trong 5 phút", en: "Run it in five minutes" },
        body: {
          vi:
            "Cần Node 20 trở lên và một PostgreSQL.\n\n" +
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/web-app-manage-gym.git\n" +
            "cd web-app-manage-gym && npm install\n" +
            "npx prisma migrate deploy && npm run dev\n" +
            "```\n\n" +
            "Phần này viết từ README, chưa chạy thử — danh sách biến môi trường có thể đã khác.",
          en:
            "Needs Node 20 or newer and a PostgreSQL database.\n\n" +
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/web-app-manage-gym.git\n" +
            "cd web-app-manage-gym && npm install\n" +
            "npx prisma migrate deploy && npm run dev\n" +
            "```\n\n" +
            "Written from the README and never executed — the environment variables may differ.",
        },
      },
      {
        anchor: "tich-hop",
        title: { vi: "Trạng thái nối IDMS", en: "IDMS integration status" },
        body: {
          vi:
            "**Chưa nối.** Ứng dụng chạy một người dùng duy nhất, email và mật khẩu khai thẳng " +
            "trong biến môi trường.\n\n" +
            "Đây là chỗ hưởng lợi rõ nhất khi nối IDMS: bỏ được mật khẩu trong env, và có ngay " +
            "nhiều người dùng với quyền khác nhau.",
          en:
            "**Not connected.** The app runs with a single user whose email and password sit in " +
            "environment variables.\n\n" +
            "This is where IDMS would help most: the password leaves the environment, and several " +
            "users with different permissions become possible.",
        },
      },
    ],
  },

  {
    slug: "app-calculate-badminton",
    kind: "SATELLITE",
    status: "PUBLISHED",
    order: 3,
    repoUrl: `${GITHUB}/app-calculate-badminton`,
    isStandalone: true,
    techStack: ["React 19", "Vite", "Tailwind v4", "localStorage"],
    name: { vi: "Calculate Badminton", en: "Calculate Badminton" },
    tagline: {
      vi: "Chia tiền sân cầu lông",
      en: "Split the cost of a badminton session",
    },
    summary: {
      vi:
        "Nhập tiền sân, tiền cầu và số người chơi, ứng dụng chia ra từng người phải trả bao " +
        "nhiêu. Không có máy chủ: mọi thứ nằm trong trình duyệt.",
      en:
        "Enter the court fee, the shuttlecock cost and who played; the app works out what each " +
        "person owes. There is no server: everything stays in the browser.",
    },
    features: [
      {
        icon: "calculator",
        title: { vi: "Chia tiền theo số buổi chơi", en: "Split by sessions played" },
        description: {
          vi: "Người chơi ít buổi trả ít hơn, không chia đều một cách máy móc.",
          en: "Whoever played fewer sessions pays less, instead of a flat split.",
        },
      },
      {
        icon: "hard-drive",
        title: { vi: "Lưu ngay trong trình duyệt", en: "Saved right in the browser" },
        description: {
          vi: "Dữ liệu nằm trong localStorage, không gửi đi đâu và không cần đăng nhập.",
          en: "Data sits in localStorage: nothing is sent anywhere and there is nothing to sign in to.",
        },
      },
    ],
    sections: [
      {
        anchor: "la-gi",
        title: { vi: "Là gì", en: "What it is" },
        body: {
          vi:
            "Một trang React 19 dựng bằng Vite, giao diện Tailwind v4. Không backend, không cơ " +
            "sở dữ liệu, không tài khoản.",
          en:
            "A React 19 page built with Vite and styled with Tailwind v4. No backend, no database, " +
            "no accounts.",
        },
      },
      {
        anchor: "quick-start",
        title: { vi: "Chạy thử trong 5 phút", en: "Run it in five minutes" },
        body: {
          vi:
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/app-calculate-badminton.git\n" +
            "cd app-calculate-badminton && npm install && npm run dev\n" +
            "```\n\n" +
            "Không cần biến môi trường nào.",
          en:
            "```bash\n" +
            "git clone https://github.com/LeVanAnhDuc/app-calculate-badminton.git\n" +
            "cd app-calculate-badminton && npm install && npm run dev\n" +
            "```\n\n" +
            "No environment variables needed.",
        },
      },
      {
        anchor: "tich-hop",
        title: { vi: "Vì sao chạy độc lập", en: "Why it stands alone" },
        body: {
          vi:
            "Ứng dụng **không** dự kiến nối IDMS. Nó không có dữ liệu cần bảo vệ và không có " +
            "trạng thái cần đồng bộ giữa các máy, nên thêm một bước đăng nhập chỉ làm nó khó " +
            "dùng hơn mà không đổi lại được gì.",
          en:
            "This app is **not** planned to join IDMS. It holds nothing worth protecting and keeps " +
            "no state that needs syncing between devices, so a sign-in step would only make it " +
            "harder to use with nothing gained.",
        },
      },
    ],
  },

  {
    slug: "app-AI-study-coach",
    kind: "SATELLITE",
    status: "PUBLISHED",
    order: 4,
    repoUrl: `${GITHUB}/web-app-AI-study-coach`,
    techStack: [],
    name: { vi: "AI Study Coach", en: "AI Study Coach" },
    tagline: {
      vi: "Trợ lý học tập — mới ở giai đoạn thiết kế",
      en: "A study assistant — still at the design stage",
    },
    summary: {
      vi:
        "Kho mã hiện chỉ có thư mục `docs/` với ba lần commit: chưa có mã chạy được, chưa " +
        "chọn xong công nghệ. Trang này ghi lại dự định, không phải một ứng dụng đang chạy.",
      en:
        "The repository currently holds only a `docs/` folder with three commits: no runnable " +
        "code yet, no technology chosen. This page records the intent, not a working app.",
    },
    features: [
      {
        icon: "notebook-pen",
        title: { vi: "Dự kiến: lập kế hoạch học", en: "Planned: build a study plan" },
        description: {
          vi: "Chia mục tiêu học thành các buổi ngắn theo thời gian rảnh thật.",
          en: "Break a learning goal into short sessions that fit the time actually available.",
        },
      },
      {
        icon: "message-circle-question",
        title: { vi: "Dự kiến: hỏi đáp theo tài liệu của bạn", en: "Planned: ask questions about your own material" },
        description: {
          vi: "Trả lời dựa trên tài liệu người học tải lên, không phải kiến thức chung.",
          en: "Answers grounded in the documents the learner uploads, not general knowledge.",
        },
      },
    ],
    sections: [
      {
        anchor: "la-gi",
        title: { vi: "Hiện trạng", en: "Where it stands" },
        body: {
          vi:
            "Tính tới 17.08.2026, `app-AI-study-coach` có ba commit và chỉ chứa thư mục `docs/`.\n\n" +
            "Không có quick start ở đây vì **chưa có gì để chạy**. Khi kho mã có bản chạy được, " +
            "thêm một mục nội dung mới qua trang quản trị.",
          en:
            "As of 2026-08-17, `app-AI-study-coach` has three commits and contains only a `docs/` " +
            "folder.\n\n" +
            "There is no quick start here because **there is nothing to run yet**. Once the " +
            "repository has something runnable, add a new section through the admin pages.",
        },
      },
      {
        anchor: "tich-hop",
        title: { vi: "Trạng thái nối IDMS", en: "IDMS integration status" },
        body: {
          vi:
            "**Chưa nối**, và cũng chưa có gì để nối. Vì ứng dụng bắt đầu từ con số không, đây " +
            "là chỗ dễ nhất để nối IDMS ngay từ đầu thay vì gắn thêm về sau.",
          en:
            "**Not connected**, and there is nothing to connect yet. Because the app starts from " +
            "zero, it is the easiest place to build IDMS in from the start instead of bolting it on later.",
        },
      },
    ],
  },

  {
    slug: "shorten-link",
    kind: "SATELLITE",
    status: "DRAFT",
    order: 5,
    isRepoPrivate: true,
    techStack: [],
    // Chỉ có tên hiển thị. Repo riêng tư nên không đọc được README, và bịa nội
    // dung cho một kho mã không đọc được thì tài liệu thành chỗ đăng phỏng đoán.
    // Bản ghi vẫn tồn tại để chủ dự án tự nhập rồi bấm Công khai.
    name: { vi: "Shorten Link", en: "Shorten Link" },
    features: [],
    sections: [],
  },
];

// ---------------------------------------------------------------------------
// Bốn trang hướng dẫn (spec §15)
// ---------------------------------------------------------------------------

const DOC_PAGES: SeedDocPage[] = [
  {
    slug: "home",
    order: 0,
    // DRAFT là cố ý: trang chủ `/[locale]` hiện dựng từ chuỗi giao diện và danh
    // sách ứng dụng, chưa kết xuất bản ghi này, còn `/[locale]/docs/home` thì cố
    // tình 404. Publish nó sẽ đưa một liên kết chết vào chỉ mục tìm kiếm.
    status: "DRAFT",
    title: { vi: "Trang chủ", en: "Home" },
    description: {
      vi: "Nội dung dành cho trang chủ. Chưa được trang nào kết xuất.",
      en: "Content meant for the home page. Nothing renders it yet.",
    },
    sections: [
      {
        anchor: "gioi-thieu",
        title: { vi: "Một tài khoản, mọi ứng dụng", en: "One account, every app" },
        body: {
          vi:
            "IDMS cấp danh tính cho toàn bộ hệ sinh thái. Trang này ghi lại từng ứng dụng làm " +
            "gì, chạy thế nào, và nối vào IDMS ra sao.",
          en:
            "IDMS provides identity for the whole ecosystem. This site records what each app does, " +
            "how to run it, and how it connects to IDMS.",
        },
      },
      {
        anchor: "doc-tu-dau",
        title: { vi: "Bắt đầu từ đâu", en: "Where to start" },
        body: {
          vi:
            "Chưa biết gì về hệ sinh thái thì đọc **Tổng quan hệ sinh thái** trước. Đang cần " +
            "nối một ứng dụng vào IDMS thì đi thẳng tới **Hướng dẫn tích hợp OAuth**.",
          en:
            "New to the ecosystem? Read the **ecosystem overview** first. Already wiring an app " +
            "into IDMS? Go straight to the **OAuth integration guide**.",
        },
      },
    ],
  },

  {
    slug: "ecosystem-overview",
    order: 1,
    status: "PUBLISHED",
    title: { vi: "Tổng quan hệ sinh thái", en: "Ecosystem overview" },
    description: {
      vi: "Các ứng dụng hiện có, ứng dụng nào đã nối IDMS và ứng dụng nào chưa.",
      en: "Which apps exist, which are wired into IDMS and which are not.",
    },
    sections: [
      {
        anchor: "hai-lop",
        title: { vi: "Lõi và vệ tinh", en: "Core and satellites" },
        body: {
          vi:
            "Hệ sinh thái có **một lõi** và **nhiều ứng dụng vệ tinh**.\n\n" +
            "Lõi là IDMS: `api-web-store-apps` cấp token, `web-store-apps` là giao diện đăng " +
            "nhập và bảng khởi chạy. Vệ tinh là các ứng dụng nghiệp vụ; mỗi ứng dụng tự lo dữ " +
            "liệu của mình và chỉ hỏi lõi một câu: *người đang dùng là ai*.",
          en:
            "The ecosystem has **one core** and **several satellite apps**.\n\n" +
            "The core is IDMS: `api-web-store-apps` issues tokens, `web-store-apps` is the " +
            "sign-in screen and the launcher. The satellites are the product apps; each keeps its " +
            "own data and asks the core exactly one question: *who is using this*.",
        },
      },
      {
        anchor: "hien-trang",
        title: { vi: "Hiện trạng, không phải kiến trúc mong muốn", en: "Current state, not the target architecture" },
        body: {
          vi:
            "Tính tới **17.08.2026, chưa ứng dụng vệ tinh nào thực sự nối vào IDMS.**\n\n" +
            "| Ứng dụng | Trạng thái |\n" +
            "|---|---|\n" +
            "| Match CV | Chưa nối — README ghi \"auth defer\" |\n" +
            "| Manage Gym | Chưa nối — một người dùng, mật khẩu trong env |\n" +
            "| Calculate Badminton | Chạy độc lập, không dự kiến nối |\n" +
            "| AI Study Coach | Chưa có mã chạy được |\n" +
            "| Shorten Link | Repo riêng tư, không đọc được |\n\n" +
            "Sơ đồ ở trang chủ vẽ đúng như vậy: nét liền chỉ dành cho kết nối đã có thật.",
          en:
            "As of **2026-08-17, no satellite app is actually wired into IDMS.**\n\n" +
            "| App | State |\n" +
            "|---|---|\n" +
            "| Match CV | Not connected — the README says auth is deferred |\n" +
            "| Manage Gym | Not connected — single user, password in the environment |\n" +
            "| Calculate Badminton | Standalone by design, no integration planned |\n" +
            "| AI Study Coach | No runnable code yet |\n" +
            "| Shorten Link | Private repository, cannot be read |\n\n" +
            "The diagram on the home page says the same thing: a solid line means a connection " +
            "that already exists.",
        },
      },
      {
        anchor: "chon-cach-nao",
        title: { vi: "Ứng dụng nào nên nối", en: "Which apps should connect" },
        body: {
          vi:
            "Nối IDMS đáng làm khi ứng dụng **có dữ liệu riêng của từng người** hoặc **có nhiều " +
            "vai trò sử dụng**. Manage Gym và Match CV đều thuộc nhóm đó.\n\n" +
            "Ứng dụng không lưu gì ngoài trình duyệt — như Calculate Badminton — thì nối vào chỉ " +
            "thêm một bước chặn giữa người dùng và việc họ muốn làm.",
          en:
            "Joining IDMS is worth it when an app **holds data belonging to individual people** or " +
            "**has more than one kind of user**. Manage Gym and Match CV both qualify.\n\n" +
            "An app that stores nothing outside the browser — Calculate Badminton, for instance — " +
            "gains only an extra step between the user and what they came to do.",
        },
      },
    ],
  },

  {
    slug: "oauth-integration-guide",
    order: 2,
    status: "PUBLISHED",
    title: { vi: "Hướng dẫn tích hợp OAuth", en: "OAuth integration guide" },
    description: {
      vi: "Năm bước nối một ứng dụng vào IDMS bằng Authorization Code kèm PKCE.",
      en: "Five steps to connect an app to IDMS with Authorization Code plus PKCE.",
    },
    sections: [
      {
        anchor: "yeu-cau",
        title: { vi: "Cần có trước", en: "Before you start" },
        body: {
          vi:
            "Đăng ký ứng dụng trong bảng quản trị của IDMS để lấy `client_id` và khai địa chỉ " +
            "chuyển hướng. Địa chỉ khai sai một ký tự là bước 3 trả lỗi `redirect_uri_mismatch`.\n\n" +
            "**Không** cần `client_secret`: ứng dụng chạy trong trình duyệt dùng PKCE thay cho bí mật.",
          en:
            "Register the app in the IDMS admin screens to get a `client_id` and to declare the " +
            "redirect URI. One wrong character there and step 3 fails with `redirect_uri_mismatch`.\n\n" +
            "You do **not** need a `client_secret`: browser apps use PKCE instead of a secret.",
        },
      },
      {
        anchor: "luong",
        title: { vi: "Luồng năm bước", en: "The five-step flow" },
        body: {
          vi:
            "1. Sinh `code_verifier` ngẫu nhiên, băm SHA-256 thành `code_challenge`.\n" +
            "2. Lưu `code_verifier` vào `sessionStorage` — nó phải sống qua lần chuyển trang.\n" +
            "3. Chuyển người dùng sang IDMS kèm `client_id`, `redirect_uri`, `code_challenge`, `state`.\n" +
            "4. Người dùng đăng nhập và đồng ý quyền; IDMS chuyển họ về `redirect_uri` kèm `code`.\n" +
            "5. Gửi `code` cùng `code_verifier` lên máy chủ, nhận access token và ID token.",
          en:
            "1. Generate a random `code_verifier`, then SHA-256 it into a `code_challenge`.\n" +
            "2. Keep the `code_verifier` in `sessionStorage` — it has to survive the navigation.\n" +
            "3. Send the user to IDMS with `client_id`, `redirect_uri`, `code_challenge` and `state`.\n" +
            "4. The user signs in and consents; IDMS returns them to `redirect_uri` with a `code`.\n" +
            "5. Exchange the `code` together with the `code_verifier` for an access token and an ID token.",
        },
      },
      {
        anchor: "buoc-3",
        title: { vi: "Bước 3 — chuyển người dùng", en: "Step 3 — send the user over" },
        body: {
          vi:
            "```\n" +
            "GET /oauth/authorize\n" +
            "  ?response_type=code\n" +
            "  &client_id=<client_id>\n" +
            "  &redirect_uri=<đúng địa chỉ đã khai>\n" +
            "  &code_challenge=<băm SHA-256 của code_verifier>\n" +
            "  &code_challenge_method=S256\n" +
            "  &state=<chuỗi ngẫu nhiên, kiểm lại ở bước 4>\n" +
            "```\n\n" +
            "`state` không phải thủ tục cho đủ: thiếu nó thì kẻ khác gửi được một `code` của họ " +
            "vào phiên của người dùng.",
          en:
            "```\n" +
            "GET /oauth/authorize\n" +
            "  ?response_type=code\n" +
            "  &client_id=<client_id>\n" +
            "  &redirect_uri=<exactly the registered address>\n" +
            "  &code_challenge=<SHA-256 of the code_verifier>\n" +
            "  &code_challenge_method=S256\n" +
            "  &state=<random string, checked again in step 4>\n" +
            "```\n\n" +
            "`state` is not paperwork: without it, someone else can push their own `code` into your " +
            "user's session.",
        },
      },
      {
        anchor: "buoc-5",
        title: { vi: "Bước 5 — đổi mã lấy token", en: "Step 5 — exchange the code for tokens" },
        body: {
          vi:
            "Bước này chạy ở **máy chủ của ứng dụng**, không chạy trong trình duyệt.\n\n" +
            "```bash\n" +
            "curl -X POST https://<idms>/oauth/token \\\n" +
            "  -d grant_type=authorization_code \\\n" +
            "  -d code=<code> \\\n" +
            "  -d code_verifier=<code_verifier> \\\n" +
            "  -d client_id=<client_id> \\\n" +
            "  -d redirect_uri=<redirect_uri>\n" +
            "```\n\n" +
            "Đặt token vào cookie `HttpOnly`. Để trong `localStorage` là mở đường cho mọi đoạn " +
            "script trên trang đọc được nó.",
          en:
            "This step runs on **your app's server**, not in the browser.\n\n" +
            "```bash\n" +
            "curl -X POST https://<idms>/oauth/token \\\n" +
            "  -d grant_type=authorization_code \\\n" +
            "  -d code=<code> \\\n" +
            "  -d code_verifier=<code_verifier> \\\n" +
            "  -d client_id=<client_id> \\\n" +
            "  -d redirect_uri=<redirect_uri>\n" +
            "```\n\n" +
            "Store the tokens in `HttpOnly` cookies. Keeping them in `localStorage` hands them to " +
            "every script on the page.",
        },
      },
      {
        anchor: "loi-thuong-gap",
        title: { vi: "Ba lỗi hay gặp", en: "Three common failures" },
        body: {
          vi:
            "- `redirect_uri_mismatch`: địa chỉ gửi lên khác địa chỉ đã khai, thường vì thiếu " +
            "hoặc thừa dấu `/` ở cuối.\n" +
            "- `invalid_grant` ở bước 5: `code_verifier` không khớp — hay xảy ra khi trang được " +
            "tải lại giữa bước 2 và bước 5, làm mất `sessionStorage`.\n" +
            "- Người dùng quay lại mà vẫn chưa đăng nhập: ứng dụng đọc access token từ " +
            "`localStorage` thay vì đọc cookie do máy chủ đặt.",
          en:
            "- `redirect_uri_mismatch`: the address sent does not match the registered one, usually " +
            "a missing or extra trailing `/`.\n" +
            "- `invalid_grant` at step 5: the `code_verifier` does not match — common when the page " +
            "reloads between steps 2 and 5 and `sessionStorage` is lost.\n" +
            "- The user comes back still signed out: the app reads the access token from " +
            "`localStorage` instead of the cookie the server set.",
        },
      },
    ],
  },

  {
    slug: "add-new-app-guide",
    order: 3,
    status: "PUBLISHED",
    title: { vi: "Thêm một ứng dụng vào trang này", en: "Add an app to this site" },
    description: {
      vi: "Các bước để một ứng dụng mới có trang tài liệu, không cần deploy lại.",
      en: "How a new app gets its documentation page, with no redeploy needed.",
    },
    sections: [
      {
        anchor: "chuan-bi",
        title: { vi: "Chuẩn bị", en: "What to prepare" },
        body: {
          vi:
            "Cần ba thứ: **tên hiển thị** (viết hoa đầu từ, cách nhau bằng khoảng trắng — " +
            "\"Manage Gym\", không phải \"app-manage-gym\"), **slug** cho địa chỉ trang, và một " +
            "câu **mô tả một dòng**.\n\n" +
            "Nếu ứng dụng có cặp client/api thì đó vẫn là **một** bản ghi: điền cả `repoUrl` và " +
            "`repoUrl máy chủ`. Với người đọc tài liệu, hai kho mã đó là một sản phẩm.",
          en:
            "Three things: a **display name** (capitalised words separated by spaces — " +
            "\"Manage Gym\", never \"app-manage-gym\"), a **slug** for the URL, and a one-line " +
            "**description**.\n\n" +
            "If the app is a client/api pair it is still **one** record: fill in both the repo and " +
            "the server repo. To a reader, those two repositories are one product.",
        },
      },
      {
        anchor: "cac-buoc",
        title: { vi: "Các bước", en: "The steps" },
        body: {
          vi:
            "1. Mở trang quản trị, mục **Ứng dụng**, thêm bản ghi mới ở trạng thái **Bản nháp**.\n" +
            "2. Điền khối **Thông tin chung**: slug, phân loại, công nghệ, liên kết kho mã.\n" +
            "3. Viết bản tiếng Việt: tên, mô tả một dòng, tóm tắt, tính năng, các mục nội dung.\n" +
            "4. Bấm **Xem thử** để đọc lại trên đúng giao diện trang công khai.\n" +
            "5. Chuyển nút ngôn ngữ sang **EN** và dịch dần. Không cần dịch xong hết mới lưu " +
            "được: chỉ báo cạnh nút ngôn ngữ cho biết còn thiếu mấy mục.\n" +
            "6. Đổi trạng thái sang **Công khai**. Trang xuất hiện ngay, không cần deploy lại.",
          en:
            "1. In the admin pages, open **Apps** and add a record as a **draft**.\n" +
            "2. Fill in the **General** block: slug, kind, tech stack, repository links.\n" +
            "3. Write the Vietnamese version: name, one-line description, summary, features, sections.\n" +
            "4. Press **Preview** to read it back in the real public design.\n" +
            "5. Switch the language button to **EN** and translate as you go. You do not have to " +
            "finish first: the meter next to the button tells you how many items are still missing.\n" +
            "6. Switch the status to **Published**. The page appears immediately, with no redeploy.",
        },
      },
      {
        anchor: "viet-noi-dung",
        title: { vi: "Viết nội dung cho người đọc", en: "Writing for the reader" },
        body: {
          vi:
            "Mỗi ứng dụng nên có ít nhất ba mục: **Là gì**, **Chạy thử trong 5 phút**, và " +
            "**Trạng thái nối IDMS**.\n\n" +
            "Mục cuối là mục hay bị viết sai nhất: hãy ghi *hiện trạng*, không ghi dự định. " +
            "Ứng dụng chưa nối thì nói là chưa nối. Trang tài liệu nói quá một bước sẽ khiến " +
            "người đọc mất buổi chiều đi tìm một tính năng không tồn tại.",
          en:
            "Every app should have at least three sections: **what it is**, **how to run it**, and " +
            "**its IDMS integration status**.\n\n" +
            "That last one is the easiest to get wrong: write the *current state*, not the plan. If " +
            "an app is not connected, say so. Documentation that overstates by one step costs a " +
            "reader an afternoon hunting for a feature that does not exist.",
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Cây điều hướng (spec §11)
// ---------------------------------------------------------------------------

/**
 * Ba nút gốc = ba mục trên dải tab. Con cháu của tab đang mở là sidebar trái.
 *
 * Không có tab **Tham chiếu**: chưa có `App` hay `DocPage` nào thuộc về nó, và I2
 * chặn publish một nút chứa rỗng. Thêm nó vào đây mà không có nội dung sẽ làm chính
 * `assertNavInvariants` ở dưới ném lỗi trước khi ghi được dòng nào — đó là ý đồ.
 *
 * *Ứng dụng* có thêm một tầng (*Lõi* / *Vệ tinh*) vì đó là khác biệt duy nhất giữa
 * sáu ứng dụng mà người đọc cần biết trước khi bấm. *Hệ sinh thái* và *Hướng dẫn*
 * chỉ có một tầng: bốn trang tài liệu không đủ nhiều để đáng gom nhóm.
 */
const NAV_TREE: SeedNavNode[] = [
  {
    id: "nav-ecosystem",
    label: { vi: "Hệ sinh thái", en: "Ecosystem" },
    children: [
      { id: "nav-doc-ecosystem-overview", docSlug: "ecosystem-overview" },
      // `home` đang DRAFT (xem ghi chú ở bản ghi của nó), nên nút này cũng DRAFT và
      // không hiện ra sidebar. Vẫn gắn vào cây để nó không nằm trong danh sách
      // "nội dung chưa gắn vào đâu" của trang quản trị.
      { id: "nav-doc-home", docSlug: "home" },
    ],
  },
  {
    id: "nav-apps",
    label: { vi: "Ứng dụng", en: "Apps" },
    children: [
      {
        id: "nav-apps-core",
        label: { vi: "Lõi", en: "Core" },
        children: [{ id: "nav-app-web-store-apps", appSlug: "web-store-apps" }],
      },
      {
        id: "nav-apps-satellite",
        label: { vi: "Vệ tinh", en: "Satellites" },
        children: [
          { id: "nav-app-match-cv", appSlug: "match-cv" },
          { id: "nav-app-manage-gym", appSlug: "app-manage-gym" },
          { id: "nav-app-calculate-badminton", appSlug: "app-calculate-badminton" },
          { id: "nav-app-ai-study-coach", appSlug: "app-AI-study-coach" },
          // Repo riêng tư, bản ghi rỗng và đang DRAFT — nút cũng DRAFT.
          { id: "nav-app-shorten-link", appSlug: "shorten-link" },
        ],
      },
    ],
  },
  {
    id: "nav-guides",
    label: { vi: "Hướng dẫn", en: "Guides" },
    children: [
      { id: "nav-doc-oauth-integration-guide", docSlug: "oauth-integration-guide" },
      { id: "nav-doc-add-new-app-guide", docSlug: "add-new-app-guide" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Ghi dữ liệu
// ---------------------------------------------------------------------------

/** Thân bài lưu dạng JSON có discriminator, giống hệt đường ghi của CMS. */
function markdown(content: string) {
  return { type: "markdown", content };
}

async function seedLocales(): Promise<void> {
  for (const locale of LOCALES) {
    await prisma.locale.upsert({
      where: { code: locale.code },
      create: locale,
      update: { label: locale.label, enabled: locale.enabled, order: locale.order },
    });
  }

  // `isDefault` đặt riêng và đặt sau: hai dòng cùng `isDefault = true` là vi phạm
  // bất biến spec §6.4, và trong một vòng lặp upsert thì luôn có một khoảnh khắc
  // như vậy. Hạ hết rồi dựng đúng một dòng lên.
  await prisma.locale.updateMany({ data: { isDefault: false } });
  await prisma.locale.update({
    where: { code: LOCALES.find((l) => l.isDefault)!.code },
    data: { isDefault: true },
  });
}

async function seedApp(app: SeedApp): Promise<void> {
  const general = {
    kind: app.kind,
    status: app.status,
    order: app.order,
    repoUrl: app.repoUrl ?? null,
    apiRepoUrl: app.apiRepoUrl ?? null,
    demoUrl: app.demoUrl ?? null,
    isRepoPrivate: app.isRepoPrivate ?? false,
    isStandalone: app.isStandalone ?? false,
    techStack: app.techStack,
  };

  const row = await prisma.app.upsert({
    where: { slug: app.slug },
    create: { slug: app.slug, ...general },
    update: general,
    select: { id: true },
  });

  for (const code of ["vi", "en"] as const) {
    await prisma.appTranslation.upsert({
      where: { appId_locale: { appId: row.id, locale: code } },
      create: {
        appId: row.id,
        locale: code,
        name: app.name[code],
        tagline: app.tagline?.[code] ?? null,
        summary: app.summary?.[code] ?? null,
      },
      update: {
        name: app.name[code],
        tagline: app.tagline?.[code] ?? null,
        summary: app.summary?.[code] ?? null,
      },
    });
  }

  // Xoá rồi dựng lại: seed là ảnh chụp một trạng thái đã biết, nên nó không cần
  // giữ id. Bù lại, chạy lại seed **ghi đè** phần đã sửa qua CMS — đó là lý do
  // seed chỉ nên chạy một lần, lúc dựng môi trường.
  await prisma.feature.deleteMany({ where: { appId: row.id } });
  for (const [index, feature] of app.features.entries()) {
    await prisma.feature.create({
      data: {
        appId: row.id,
        order: index,
        icon: feature.icon ?? null,
        translations: {
          create: (["vi", "en"] as const).map((code) => ({
            locale: code,
            title: feature.title[code],
            description: feature.description?.[code] ?? null,
          })),
        },
      },
    });
  }

  await prisma.section.deleteMany({ where: { appId: row.id } });
  for (const [index, section] of app.sections.entries()) {
    await prisma.section.create({
      data: {
        appId: row.id,
        order: index,
        anchor: section.anchor,
        translations: {
          create: (["vi", "en"] as const).map((code) => ({
            locale: code,
            title: section.title[code],
            body: markdown(section.body[code]),
          })),
        },
      },
    });
  }
}

async function seedDocPage(page: SeedDocPage): Promise<void> {
  // Không còn `group`: cột đã bị xoá ở migration `0002_nav_tree`, nhóm sidebar giờ
  // do `NAV_TREE` phía trên quyết định. Trường này sống sót qua `tsc` vì nó nằm
  // trong một biến được spread — TypeScript chỉ soát trường lạ trên object literal
  // viết thẳng tại chỗ — nên chỉ `prisma` lúc chạy mới báo "Unknown argument".
  const general = {
    order: page.order,
    status: page.status,
  };

  const row = await prisma.docPage.upsert({
    where: { slug: page.slug },
    create: { slug: page.slug, ...general },
    update: general,
    select: { id: true },
  });

  for (const code of ["vi", "en"] as const) {
    await prisma.docPageTranslation.upsert({
      where: { docPageId_locale: { docPageId: row.id, locale: code } },
      create: {
        docPageId: row.id,
        locale: code,
        title: page.title[code],
        description: page.description?.[code] ?? null,
      },
      update: {
        title: page.title[code],
        description: page.description?.[code] ?? null,
      },
    });
  }

  await prisma.section.deleteMany({ where: { docPageId: row.id } });
  for (const [index, section] of page.sections.entries()) {
    await prisma.section.create({
      data: {
        docPageId: row.id,
        order: index,
        anchor: section.anchor,
        translations: {
          create: (["vi", "en"] as const).map((code) => ({
            locale: code,
            title: section.title[code],
            body: markdown(section.body[code]),
          })),
        },
      },
    });
  }
}

/**
 * Xoá sạch cây điều hướng cũ, từ lá lên gốc.
 *
 * Phải xoá theo tầng: khoá ngoại `NavNode.parentId` dùng `ON DELETE RESTRICT`, nên
 * một `deleteMany` không điều kiện sẽ đụng phải nút cha trước nút con và Postgres
 * chặn ngay. Vòng lặp dưới đây bóc dần lớp lá.
 *
 * Xoá rồi dựng lại — thay vì chỉ upsert — vì `0002_nav_tree` cũng dựng nút chứa
 * (từ `DocPage.group` và `App.kind`) với id ngẫu nhiên. Chỉ upsert thì trên một DB
 * đã migrate kèm dữ liệu sẽ còn lại hai nút "Vệ tinh": một của migration nay đã
 * rỗng (vi phạm I2) và một của seed. Xoá nút điều hướng **không** chạm nội dung:
 * `Cascade` chỉ đi theo chiều App/DocPage bị xoá thì nút lá của nó biến mất.
 */
async function clearNavTree(): Promise<void> {
  for (let pass = 0; pass < 64; pass += 1) {
    const nodes = await prisma.navNode.findMany({ select: { id: true, parentId: true } });
    if (nodes.length === 0) return;

    const parents = new Set(nodes.map((node) => node.parentId).filter((id) => id !== null));
    const leaves = nodes.filter((node) => !parents.has(node.id)).map((node) => node.id);
    if (leaves.length === 0) break; // chỉ xảy ra khi dữ liệu cũ có chu trình

    await prisma.navNode.deleteMany({ where: { id: { in: leaves } } });
  }

  throw new Error(
    "[seed] Không xoá hết được cây điều hướng cũ: còn nút mà không nút nào là lá. " +
      "Dữ liệu trong bảng NavNode có chu trình — sửa `parentId` của một nút trong vòng rồi chạy lại.",
  );
}

/**
 * Dựng cây điều hướng.
 *
 * Trạng thái của nút lá **đi theo** trạng thái nội dung nó trỏ tới. Nếu không, một
 * `DocPage` còn nháp vẫn hiện tên trong sidebar rồi dẫn tới trang 404 — tệ hơn là
 * không hiện. Nút chứa thì luôn `PUBLISHED`, và I2 tự bảo đảm nút chứa nào cũng có
 * ít nhất một con đã publish.
 *
 * Kiểm I1–I6 **trước khi ghi dòng nào**: seed đi thẳng qua Prisma nên không được
 * `mutations.ts` canh, và một cây sai bất biến sẽ chỉ nổ ra ở lần đầu người dùng
 * bấm Lưu trong CMS — xa chỗ gây lỗi hàng tuần.
 */
async function seedNavTree(): Promise<void> {
  const apps = new Map(
    (await prisma.app.findMany({ select: { id: true, slug: true, status: true } })).map((app) => [
      app.slug,
      app,
    ]),
  );
  const docs = new Map(
    (await prisma.docPage.findMany({ select: { id: true, slug: true, status: true } })).map(
      (doc) => [doc.slug, doc],
    ),
  );

  const defaultLocale = LOCALES.find((locale) => locale.isDefault)!.code;

  /** Thứ tự trong mảng là thứ tự tạo: cha luôn nằm trước con để khoá ngoại thoả. */
  const planned: {
    row: NavRow;
    appId: string | null;
    docPageId: string | null;
    labels: { locale: string; label: string }[];
  }[] = [];

  const walk = (nodes: SeedNavNode[], parentId: string | null): void => {
    nodes.forEach((node, index) => {
      const app = node.appSlug === undefined ? undefined : apps.get(node.appSlug);
      const doc = node.docSlug === undefined ? undefined : docs.get(node.docSlug);

      if (node.appSlug !== undefined && app === undefined) {
        throw new Error(`[seed] Nút "${node.id}" trỏ tới ứng dụng "${node.appSlug}" không có trong DB.`);
      }
      if (node.docSlug !== undefined && doc === undefined) {
        throw new Error(`[seed] Nút "${node.id}" trỏ tới trang "${node.docSlug}" không có trong DB.`);
      }

      const kind: NavKind = app ? "APP" : doc ? "DOC" : "CONTAINER";

      // Nhãn của lá lấy từ nội dung, nên ở đây chỉ nút chứa cần bản dịch riêng.
      const labels =
        kind === "CONTAINER"
          ? (["vi", "en"] as const).map((code) => ({ locale: code, label: node.label![code] }))
          : [];

      if (kind === "CONTAINER" && node.label === undefined) {
        throw new Error(`[seed] Nút chứa "${node.id}" chưa có nhãn — I5 đòi nhãn ở locale mặc định.`);
      }

      // Nhãn dùng để kiểm bất biến: lá vẫn phải có nhãn nào đó, và nhãn của nó là
      // tên nội dung — lấy từ chính dữ liệu seed phía trên chứ không hỏi lại DB.
      const seedLabels = node.appSlug
        ? APPS.find((a) => a.slug === node.appSlug)!.name
        : node.docSlug
          ? DOC_PAGES.find((d) => d.slug === node.docSlug)!.title
          : node.label!;

      planned.push({
        row: {
          id: node.id,
          parentId,
          order: index,
          status: app?.status ?? doc?.status ?? "PUBLISHED",
          kind,
          labels: (["vi", "en"] as const).map((code) => ({ locale: code, value: seedLabels[code] })),
          href: app ? `/${defaultLocale}/apps/${app.slug}` : doc ? `/${defaultLocale}/docs/${doc.slug}` : null,
        },
        appId: app?.id ?? null,
        docPageId: doc?.id ?? null,
        labels,
      });

      if (node.children !== undefined) {
        if (kind !== "CONTAINER") {
          throw new Error(`[seed] Nút "${node.id}" có con nhưng trỏ tới nội dung — I1 đòi lá không có con.`);
        }
        walk(node.children, node.id);
      }
    });
  };

  walk(NAV_TREE, null);

  assertNavInvariants(
    planned.map((item) => item.row),
    defaultLocale,
  );

  await clearNavTree();

  for (const { row, appId, docPageId, labels } of planned) {
    await prisma.navNode.create({
      data: {
        id: row.id,
        parentId: row.parentId,
        order: row.order,
        status: row.status,
        kind: row.kind,
        appId,
        docPageId,
        translations: { create: labels },
      },
    });
  }

  const roots = planned.filter((item) => item.row.parentId === null).length;
  console.log(`[seed] Cây điều hướng: ${planned.length} nút, ${roots} nút gốc (dải tab).`);
}

/** Anchor trùng trong cùng một trang làm mục lục nhảy sai chỗ (spec §6.4). */
function assertUniqueAnchors(): void {
  const owners: { label: string; anchors: string[] }[] = [
    ...APPS.map((app) => ({ label: `ứng dụng "${app.slug}"`, anchors: app.sections.map((s) => s.anchor) })),
    ...DOC_PAGES.map((page) => ({ label: `trang "${page.slug}"`, anchors: page.sections.map((s) => s.anchor) })),
  ];

  for (const owner of owners) {
    const seen = new Set<string>();
    for (const anchor of owner.anchors) {
      if (seen.has(anchor)) {
        throw new Error(
          `Dữ liệu seed sai: ${owner.label} có hai mục cùng anchor "${anchor}". ` +
            "Mục lục và liên kết # sẽ nhảy sai chỗ. Sửa một trong hai anchor.",
        );
      }
      seen.add(anchor);
    }
  }
}

async function main(): Promise<void> {
  if (!hasDatabase()) {
    console.error(
      "[seed] Thiếu DATABASE_URL nên không kết nối được cơ sở dữ liệu.\n" +
        "[seed] Khai biến đó (xem .env.example) rồi chạy `npx prisma migrate deploy` trước khi seed.",
    );
    process.exit(1);
  }

  // Kiểm dữ liệu trước khi ghi dòng nào: một anchor trùng thì thà dừng ở đây còn
  // hơn để lại một trang có mục lục nhảy sai chỗ.
  assertUniqueAnchors();

  await seedLocales();
  console.log(`[seed] ${LOCALES.length} ngôn ngữ.`);

  for (const app of APPS) {
    await seedApp(app);
    console.log(
      `[seed] Ứng dụng ${app.name.vi} (${app.slug}): ` +
        `${app.features.length} tính năng, ${app.sections.length} mục.`,
    );
  }

  for (const page of DOC_PAGES) {
    await seedDocPage(page);
    console.log(`[seed] Trang ${page.title.vi} (${page.slug}): ${page.sections.length} mục.`);
  }

  // Cây dựng sau cùng: nút lá trỏ tới `App`/`DocPage` bằng khoá ngoại nên nội dung
  // phải tồn tại trước.
  await seedNavTree();

  console.log("[seed] Xong. Nội dung là bản sơ bộ viết từ README — sửa lại qua trang quản trị.");
}

main()
  .catch((error) => {
    console.error("[seed] Lỗi:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
