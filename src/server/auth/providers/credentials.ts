/**
 * Cài đặt auth hiện tại: Auth.js Credentials, một tài khoản quản trị duy nhất.
 *
 * Đây là **file duy nhất** trong dự án biết tới `next-auth`. Khi chuyển sang
 * IDMS OAuth, thêm `providers/idms-oauth.ts` cài đúng ba hàm `getCurrentUser`,
 * `requireAdmin`, `signOut` rồi đổi một dòng re-export trong `../index.ts`.
 * Không file nào khác phải sửa.
 */
import NextAuth, { AuthError, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { LOGIN_PATH, loginRedirectPath } from "../login-path";
import type { SessionUser } from "../types";

/** Vai trò duy nhất hiện có. `requireAdmin` kiểm tra đúng chuỗi này. */
const ADMIN_ROLE = "admin";

const isProduction = process.env.NODE_ENV === "production";

/** Đọc mảng vai trò từ payload không rõ kiểu của JWT/session. */
function readRoles(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((r): r is string => typeof r === "string") : [];
}

const {
  handlers: authHandlers,
  auth,
  signIn: authSignIn,
  signOut: authSignOut,
} = NextAuth({
  // Vercel đặt sẵn host qua header; không bật thì preview deployment gãy callback.
  trustHost: true,
  // Không có bảng session trong DB — token nằm gọn trong cookie.
  session: { strategy: "jwt" },
  // Đường dẫn trần, không tiền tố ngôn ngữ: đây là lối thoát nội bộ của Auth.js
  // (ta không dùng — trang đăng nhập gọi thẳng `signInWithPassword`), và nó là
  // hằng số cấu hình nên không đọc được ngôn ngữ của request. Mọi chuyển hướng
  // do chính ta phát ra đều đi qua `loginRedirectPath()` và **có** tiền tố.
  pages: { signIn: LOGIN_PATH },
  cookies: {
    sessionToken: {
      name: isProduction ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // `secure` chỉ bật ngoài môi trường dev: localhost chạy http, đặt cứng
        // `true` thì trình duyệt vứt cookie và không ai đăng nhập được khi dev.
        secure: isProduction,
      },
    },
  },
  providers: [
    Credentials({
      name: "Tài khoản quản trị",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        const adminEmail = process.env.ADMIN_EMAIL ?? "";
        const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";

        // Thiếu cấu hình thì từ chối, tuyệt đối không mở cửa.
        if (!email || !password || !adminEmail || !passwordHash) return null;
        if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) return null;

        // Env chứa **hash bcrypt**. Không bao giờ so sánh mật khẩu thô.
        const matched = await bcrypt.compare(password, passwordHash);
        if (!matched) return null;

        const user: User & { roles: string[] } = {
          id: ADMIN_ROLE,
          email: adminEmail,
          name: "Quản trị viên",
          roles: [ADMIN_ROLE],
        };
        return user;
      },
    }),
  ],
  callbacks: {
    // Vai trò chỉ có mặt ở lần đăng nhập đầu; gắn vào token để các request sau còn thấy.
    jwt({ token, user }) {
      if (user) token.roles = readRoles((user as { roles?: unknown }).roles);
      return token;
    },
    session({ session, token }) {
      // `Object.assign` thay vì gán trực tiếp: kiểu `User` của Auth.js không có
      // `roles`, và ta cố ý không augment module để tránh lệ thuộc kiểu của nó.
      Object.assign(session.user, { id: token.sub ?? ADMIN_ROLE, roles: readRoles(token.roles) });
      return session;
    },
  },
});

/** Route handler cho `/api/auth/*`. Chỉ `src/app/api/auth/[...nextauth]` dùng. */
export const handlers = authHandlers;

/** Người dùng đang đăng nhập, hoặc `null`. Không ném lỗi. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string | null; name?: string | null; roles?: unknown }
    | undefined;

  if (!user?.email) return null;

  return {
    id: user.id ?? user.email,
    email: user.email,
    name: user.name ?? undefined,
    roles: readRoles(user.roles),
  };
}

/**
 * Bắt buộc là quản trị viên.
 *
 * Server Action là endpoint HTTP riêng — bảo vệ layout không bảo vệ action.
 * Mọi action ghi dữ liệu phải gọi hàm này ở dòng đầu tiên.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  // Giữ nguyên ngôn ngữ người dùng đang dùng: đá về `/admin/login` trần là giao
  // việc đoán ngôn ngữ cho middleware, và middleware đoán trượt ở mọi request
  // nền. Xem `../login-path.ts`.
  if (!user || !user.roles.includes(ADMIN_ROLE)) redirect(await loginRedirectPath());
  return user;
}

/**
 * Thử đăng nhập bằng email và mật khẩu. `true` là thành công (cookie phiên đã
 * được đặt), `false` là sai thông tin.
 *
 * Hàm này tồn tại để trang đăng nhập **không** phải biết tới Auth.js. Nó không
 * chuyển hướng: nơi gọi còn phải giới hạn tần suất trước, rồi tự quyết đi đâu
 * sau khi thành công. Ngày đổi sang IDMS OAuth, hàm này biến thành lệnh chuyển
 * hướng tới nhà cung cấp và trang đăng nhập không đổi một dòng nào.
 *
 * `redirect: false` là bắt buộc: để mặc định thì Auth.js ném `NEXT_REDIRECT`
 * ngay bên trong, và khối `catch` dưới đây sẽ nuốt mất chuyển hướng thật.
 */
export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  try {
    await authSignIn("credentials", { email, password, redirect: false });
    return true;
  } catch (error) {
    // Sai email hoặc mật khẩu: Auth.js ném `CredentialsSignin`, một `AuthError`.
    if (error instanceof AuthError) return false;
    // Mọi lỗi khác (thiếu `AUTH_SECRET`, mạng, cấu hình) phải nổi lên: nuốt nó
    // thì người dùng chỉ thấy "sai mật khẩu" và không bao giờ lần ra nguyên nhân.
    throw error;
  }
}

/** Đăng xuất rồi đưa về trang đăng nhập, đúng ngôn ngữ đang dùng. */
export async function signOut(): Promise<void> {
  await authSignOut({ redirectTo: await loginRedirectPath() });
}
