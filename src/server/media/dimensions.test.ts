import { describe, it, expect } from "vitest";

import { readImageDimensions } from "./dimensions";

/**
 * Ảnh dựng tay ở mức tối thiểu — chỉ cần đủ phần header mà `image-size` đọc.
 * Không nhúng tệp thật vào repo: một PNG thật nhỏ nhất cũng vài trăm byte, và
 * điều đang kiểm là "đọc được header" chứ không phải "giải mã được ảnh".
 */

/** PNG: chữ ký 8 byte + khối IHDR mang rộng/cao dạng big-endian 32 bit. */
function png(width: number, height: number): Uint8Array {
  const buf = Buffer.alloc(33);
  buf.write("\x89PNG\r\n\x1a\n", 0, "binary");
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf.writeUInt8(8, 24); // bit depth
  buf.writeUInt8(6, 25); // color type
  return new Uint8Array(buf);
}

/**
 * JPEG: SOI + APP0/JFIF + SOF0 + EOI. Chú ý JPEG để **CAO trước RỘNG** trong SOF0.
 *
 * Khối APP0 là bắt buộc chứ không phải cho đẹp: `image-size` từ chối một tệp chỉ có
 * SOI + SOF0 với "Invalid JPG, no size found". Đã thử và nhận đúng lỗi đó.
 */
function jpeg(width: number, height: number): Uint8Array {
  const sof = Buffer.alloc(21);
  sof.writeUInt16BE(0xffc0, 0); // SOF0
  sof.writeUInt16BE(17, 2); // độ dài khung
  sof.writeUInt8(8, 4); // độ chính xác
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof.writeUInt8(3, 9); // ba thành phần màu
  sof.set([0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01], 10);

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0xff, 0xd8]), // SOI
      Buffer.from([0xff, 0xe0, 0x00, 0x10]),
      Buffer.from("JFIF\0"),
      Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
      sof,
      Buffer.from([0xff, 0xd9]), // EOI
    ]),
  );
}

/** WebP dạng VP8L: RIFF....WEBPVP8L, rộng/cao gói trong 14 bit mỗi chiều. */
function webp(width: number, height: number): Uint8Array {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8);
  buf.write("VP8L", 12);
  buf.writeUInt32LE(10, 16);
  buf.writeUInt8(0x2f, 20); // dấu hiệu VP8L
  const w = width - 1;
  const h = height - 1;
  const bits = w | (h << 14);
  buf.writeUInt32LE(bits >>> 0, 21);
  return new Uint8Array(buf);
}

const svg = (attrs: string): Uint8Array =>
  new Uint8Array(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}></svg>`));

describe("readImageDimensions", () => {
  it("đọc được kích thước PNG", () => {
    expect(readImageDimensions(png(1280, 653))).toEqual({ width: 1280, height: 653 });
  });

  it("đọc được kích thước JPEG — và không đảo rộng với cao", () => {
    // JPEG lưu CAO trước RỘNG trong khung SOF. Ảnh không vuông mới lộ ra lỗi đảo.
    expect(readImageDimensions(jpeg(800, 600))).toEqual({ width: 800, height: 600 });
  });

  it("đọc được kích thước WebP", () => {
    expect(readImageDimensions(webp(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it("SVG có width/height thì lấy đúng hai số đó", () => {
    expect(readImageDimensions(svg('width="64" height="32"'))).toEqual({ width: 64, height: 32 });
  });

  it("SVG chỉ có viewBox vẫn suy ra được kích thước", () => {
    // Rất nhiều sơ đồ xuất từ Figma/Excalidraw chỉ có viewBox. Trả null ở đây
    // nghĩa là phần lớn ảnh sơ đồ của dự án mất số đo mà không có lý do thật.
    expect(readImageDimensions(svg('viewBox="0 0 100 50"'))).toEqual({ width: 100, height: 50 });
  });

  it("SVG khai width=100% thì lấy tỉ lệ từ viewBox, không lấy số 100", () => {
    // "100%" là chỉ dẫn co giãn theo khung chứa, không phải số đo pixel.
    expect(readImageDimensions(svg('width="100%" height="100%" viewBox="0 0 20 10"'))).toEqual({
      width: 20,
      height: 10,
    });
  });

  it("dữ liệu rác trả null chứ KHÔNG ném — đo hỏng không được làm hỏng lượt tải lên", () => {
    expect(readImageDimensions(new Uint8Array(Buffer.from("khong-phai-anh-gi-ca")))).toBeNull();
  });

  it("buffer rỗng trả null", () => {
    // `image-size` ném "Offset is outside the bounds of the DataView" ở đây.
    expect(readImageDimensions(new Uint8Array(0))).toBeNull();
  });

  it("ảnh cụt giữa header trả null", () => {
    expect(readImageDimensions(png(100, 100).slice(0, 12))).toBeNull();
  });

  it("số đo không hợp lệ trả null chứ không trả 0", () => {
    // Ghi 0 vào DB tệ hơn ghi null: `0×0` trông như một số đo thật.
    expect(readImageDimensions(png(0, 0))).toBeNull();
  });
});
