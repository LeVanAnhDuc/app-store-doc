import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Chưa cấu hình DB thì trang tĩnh dựng rỗng thay vì làm hỏng build.
 * Mọi hàm đọc dữ liệu phải hỏi hàm này trước khi chạm `prisma`.
 */
export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Prisma 7 bắt buộc truyền driver adapter cho `new PrismaClient()`;
 * gọi mà không có adapter sẽ ném lỗi ngay lúc khởi tạo.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Chưa cấu hình DATABASE_URL nên không kết nối được cơ sở dữ liệu. " +
        "Hãy kiểm tra `hasDatabase()` trước khi truy vấn.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (!client) {
    client = globalForPrisma.prisma ?? createPrismaClient();
    // Hot reload của Next tạo lại module liên tục; không giữ lại thì mỗi lần sửa
    // code là thêm một connection pool cho tới khi Postgres từ chối kết nối.
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Client khởi tạo trễ: chỉ dựng thật khi có truy vấn đầu tiên.
 *
 * Nếu dựng ngay lúc import, mọi module `import { prisma }` sẽ nổ ở thời điểm nạp
 * khi thiếu `DATABASE_URL` — kéo sập cả `next build` lẫn test. Proxy đẩy lỗi lùi
 * tới lúc thực sự cần DB, đúng tinh thần "chế độ không có DB".
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient() as unknown as Record<string | symbol, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
