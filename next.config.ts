import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kiểu và lint chạy riêng bằng `npm run typecheck` / `npm run lint`,
  // nhưng vẫn để build tự kiểm để không lọt lỗi lên Vercel.
  typedRoutes: false,
};

export default nextConfig;
