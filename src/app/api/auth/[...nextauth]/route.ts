// Endpoint của Auth.js. Nhập thẳng từ provider chứ không qua `@/server/auth`,
// vì bề mặt công khai của tầng auth cố ý không lộ `handlers` ra ngoài.
import { handlers } from "@/server/auth/providers/credentials";

export const { GET, POST } = handlers;
