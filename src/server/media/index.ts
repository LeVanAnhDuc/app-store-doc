import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Media } from "@prisma/client";

import { prisma } from "@/server/db";

import { readImageDimensions } from "./dimensions";
import { detectImageMime, extensionForMime } from "./mime";

/**
 * Tầng lưu ảnh — nơi DUY NHẤT trong repo biết Cloudflare R2 và SDK S3.
 * Test ranh giới ở `src/server/auth/boundary.test.ts` canh điều này.
 */

export { detectImageMime } from "./mime";
export type { ImageMime } from "./mime";

/** Trần kích thước tệp. Ảnh tài liệu vượt 5 MB gần như luôn là ảnh chưa nén. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

/** Biến nào còn thiếu để dùng được kho ảnh. Rỗng nghĩa là đủ. */
export function missingR2Env(): string[] {
  return (
    [
      ["R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID],
      ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID],
      ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY],
      ["R2_BUCKET", process.env.R2_BUCKET],
      ["R2_PUBLIC_BASE_URL", process.env.R2_PUBLIC_BASE_URL],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

/**
 * Kho ảnh đã dùng được chưa.
 *
 * Trang quản trị phải hỏi hàm này **trước** khi dựng vùng kéo-thả. Không hỏi thì
 * người dùng chọn tệp xong mới ăn lỗi — trong khi thiếu biến môi trường là thứ
 * biết được ngay từ đầu. Quy tắc thiết kế §7: nói thật về hiện trạng.
 */
export function isMediaConfigured(): boolean {
  return missingR2Env().length === 0;
}

function readConfig(): R2Config {
  const missing = missingR2Env();
  if (missing.length > 0) {
    throw new Error(`Chưa cấu hình kho ảnh R2. Thiếu biến môi trường: ${missing.join(", ")}.`);
  }

  return {
    accountId: process.env.R2_ACCOUNT_ID as string,
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    bucket: process.env.R2_BUCKET as string,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL as string,
  };
}

let client: S3Client | undefined;

/**
 * Client khởi tạo trễ, cùng lối với `src/server/db.ts`.
 *
 * Dựng ngay lúc import sẽ khiến mọi module chạm tầng này nổ ở thời điểm nạp khi
 * thiếu biến môi trường R2 — kéo sập cả `next build` lẫn test, dù đường chạy đó
 * không hề đụng tới việc tải ảnh.
 */
function getClient(config: R2Config): S3Client {
  if (!client) {
    client = new S3Client({
      // R2 không có khái niệm vùng; "auto" là giá trị bắt buộc của SDK S3.
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

/** Chỉ dùng cho test: buộc lần gọi sau dựng lại client với cấu hình mới. */
export function __resetR2Client(): void {
  client = undefined;
}

function publicUrlFor(config: R2Config, pathname: string): string {
  return `${config.publicBaseUrl.replace(/\/+$/, "")}/${pathname}`;
}

export type UploadInput = {
  bytes: Uint8Array;
  filename: string;
  alt?: string;
};

/**
 * Tải ảnh lên R2 rồi ghi bản ghi `Media`.
 *
 * Thứ tự bắt buộc: nhận dạng định dạng → kiểm dung lượng → đo rộng × cao → sinh đường
 * dẫn ngẫu nhiên → `PutObject` → chỉ khi lên kho thành công mới ghi DB. Ghi DB trước
 * sẽ để lại bản ghi trỏ tới ảnh không tồn tại nếu R2 lỗi.
 */
export async function uploadImage(file: UploadInput): Promise<Media> {
  // 1. Không tin đuôi tệp: soi magic bytes trước mọi thứ khác.
  const mimeType = detectImageMime(file.bytes);
  if (!mimeType) {
    throw new Error(
      `Tệp "${file.filename}" không phải ảnh hợp lệ. Chỉ nhận PNG, JPEG, WebP hoặc SVG.`,
    );
  }

  // 2. Kiểm kích thước sau khi biết chắc là ảnh, để lỗi báo về đúng nguyên nhân đầu tiên.
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Tệp "${file.filename}" nặng ${(file.bytes.byteLength / 1024 / 1024).toFixed(1)} MB, ` +
        `vượt giới hạn ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }

  // 3. Đo rộng × cao trên chính buffer đã có trong bộ nhớ, sau khi biết chắc là ảnh.
  // Hàm này không bao giờ ném: số đo là thứ "biết thì hay", không phải điều kiện để
  // nhận ảnh. Đọc không được thì `null` và ảnh vẫn lên — hiện đúng phần biết chắc.
  const dimensions = readImageDimensions(file.bytes);

  const config = readConfig();

  // 4. Tên tệp người dùng gửi lên không bao giờ chạm tới đường dẫn lưu trữ: nó vừa là
  // vector path traversal ("../../x"), vừa gây va chạm khi hai người cùng tải "logo.png".
  const pathname = `${randomUUID()}.${extensionForMime(mimeType)}`;

  // 5. Đưa lên kho trước.
  await getClient(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: pathname,
      Body: file.bytes,
      ContentType: mimeType,
      // Ảnh bất biến vì đường dẫn là UUID: sửa ảnh nghĩa là tải tệp mới, không ghi đè.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  // 6. Thành công rồi mới ghi bản ghi.
  return prisma.media.create({
    data: {
      url: publicUrlFor(config, pathname),
      pathname,
      alt: file.alt ?? null,
      sizeBytes: file.bytes.byteLength,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      mimeType,
    },
  });
}

/**
 * Xoá ảnh khỏi R2 rồi xoá bản ghi.
 *
 * Xoá trên R2 trước là cố ý: `DeleteObject` idempotent, nên nếu bước xoá DB hỏng thì
 * gọi lại `deleteImage` vẫn chạy đúng. Xoá bản ghi trước lại làm mất luôn `pathname`,
 * để lại tệp mồ côi không cách nào tìm ra.
 */
export async function deleteImage(id: string): Promise<void> {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return; // Đã xoá rồi thì coi như xong, để gọi lại được nhiều lần.

  const config = readConfig();
  await getClient(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: media.pathname }),
  );

  await prisma.media.delete({ where: { id } });
}

/** Danh sách ảnh cho bộ chọn ảnh trong CMS, mới nhất lên đầu. */
export function listImages(): Promise<Media[]> {
  return prisma.media.findMany({ orderBy: { createdAt: "desc" } });
}
