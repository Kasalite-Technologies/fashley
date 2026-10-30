import { describe, expect, it } from "vitest";
import { sanitizeImage, InMemoryMediaStore, createR2MediaStore } from "./media";

const te = new TextEncoder();
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typed = concat([te.encode(type), data]);
  return concat([u32be(data.length), typed, u32be(crc32(typed))]);
}
function makePng(): Uint8Array {
  const ihdr = concat([u32be(1), u32be(1), new Uint8Array([8, 2, 0, 0, 0])]);
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", te.encode("Comment\0SECRET_METADATA")),
    pngChunk("IDAT", new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0, 0, 0, 2, 0, 1])),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}
function jpegSegment(marker: number, data: Uint8Array): Uint8Array {
  const len = data.length + 2;
  return concat([new Uint8Array([0xff, marker, (len >> 8) & 255, len & 255]), data]);
}
function makeJpeg(): Uint8Array {
  const app0 = jpegSegment(
    0xe0,
    concat([te.encode("JFIF\0"), new Uint8Array([1, 1, 0, 0, 1, 0, 1, 0, 0])]),
  );
  const app1 = jpegSegment(0xe1, te.encode("Exif\0\0SECRET_METADATA"));
  const com = jpegSegment(0xfe, te.encode("SECRET_COMMENT"));
  const sof = jpegSegment(
    0xc0,
    concat([new Uint8Array([8, 0, 2, 0, 3, 1]), new Uint8Array([1, 0x11, 0])]),
  );
  const sos = jpegSegment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0]));
  const scan = new Uint8Array([0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33]);
  return concat([
    new Uint8Array([0xff, 0xd8]),
    app0,
    app1,
    com,
    sof,
    sos,
    scan,
    new Uint8Array([0xff, 0xd9]),
    te.encode("TRAILING_JUNK"),
  ]);
}
function webpChunk(type: string, data: Uint8Array): Uint8Array {
  const size = new Uint8Array([
    data.length & 255,
    (data.length >> 8) & 255,
    (data.length >> 16) & 255,
    (data.length >> 24) & 255,
  ]);
  const pad = data.length % 2 ? new Uint8Array([0]) : new Uint8Array(0);
  return concat([te.encode(type), size, data, pad]);
}
function makeWebp(type: "VP8L" | "VP8X"): Uint8Array {
  let image: Uint8Array;
  if (type === "VP8L") {
    const v = 2 | (1 << 14);
    image = webpChunk(
      "VP8L",
      new Uint8Array([0x2f, v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]),
    );
  } else {
    image = concat([
      webpChunk("VP8X", new Uint8Array([0x08, 0, 0, 0, 4, 0, 0, 3, 0, 0])),
      webpChunk("VP8L", new Uint8Array([0x2f, 4, 0xc0, 0, 0])),
    ]);
  }
  const body = concat([te.encode("WEBP"), image, webpChunk("EXIF", te.encode("SECRET_METADATA"))]);
  const riffSize = body.length;
  return concat([
    te.encode("RIFF"),
    new Uint8Array([
      riffSize & 255,
      (riffSize >> 8) & 255,
      (riffSize >> 16) & 255,
      (riffSize >> 24) & 255,
    ]),
    body,
  ]);
}
const has = (bytes: Uint8Array, text: string) =>
  new TextDecoder("latin1").decode(bytes).includes(text);

describe("sanitizeImage", () => {
  it("strips PNG ancillary metadata and parses dimensions", async () => {
    const out = await sanitizeImage(makePng(), "image/png");
    expect(out.mime).toBe("image/png");
    expect(out.widthPx).toBe(1);
    expect(out.heightPx).toBe(1);
    expect(has(out.bytes, "SECRET_METADATA")).toBe(false);
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("strips JPEG APP1/COM, trims trailing bytes after EOI", async () => {
    const out = await sanitizeImage(makeJpeg(), "image/jpeg");
    expect(out.widthPx).toBe(3);
    expect(out.heightPx).toBe(2);
    expect(has(out.bytes, "Exif")).toBe(false);
    expect(has(out.bytes, "SECRET")).toBe(false);
    expect(has(out.bytes, "TRAILING_JUNK")).toBe(false);
    expect(out.bytes.slice(-2)).toEqual(new Uint8Array([0xff, 0xd9]));
  });
  it("strips WebP EXIF and parses VP8L and VP8X dimensions", async () => {
    const lossy = await sanitizeImage(makeWebp("VP8L"), "image/webp");
    expect([lossy.widthPx, lossy.heightPx]).toEqual([3, 2]);
    expect(has(lossy.bytes, "SECRET_METADATA")).toBe(false);
    const extended = await sanitizeImage(makeWebp("VP8X"), "image/webp");
    expect([extended.widthPx, extended.heightPx]).toEqual([5, 4]);
    expect(has(extended.bytes, "SECRET_METADATA")).toBe(false);
    const riffSize =
      lossy.bytes[4]! | (lossy.bytes[5]! << 8) | (lossy.bytes[6]! << 16) | (lossy.bytes[7]! << 24);
    expect(riffSize).toBe(lossy.bytes.length - 8);
  });
  it("rejects mime mismatch, oversize, empty, and unsupported declared types", async () => {
    await expect(sanitizeImage(makePng(), "image/jpeg")).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
    await expect(sanitizeImage(new Uint8Array(10_485_761), "image/png")).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
    await expect(sanitizeImage(new Uint8Array(0), "image/png")).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
    await expect(sanitizeImage(makePng(), "image/gif")).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
  });
  it("rejects corrupt PNG CRC and truncated JPEG", async () => {
    // Corrupt the IHDR CRC: signature(8)+length(4)+type(4)+data(13) starts at offset 29.
    const badCrc = new Uint8Array(makePng());
    badCrc[29] = badCrc[29]! ^ 0xff;
    await expect(sanitizeImage(badCrc, "image/png")).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
    const truncated = makeJpeg().slice(0, -16);
    await expect(sanitizeImage(truncated, "image/jpeg")).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
  });
});

describe("media stores", () => {
  it("InMemoryMediaStore round-trips and reports missing objects", async () => {
    const store = new InMemoryMediaStore();
    await store.putPrivate("k", new Uint8Array([1, 2]));
    expect(await store.getPrivate("k")).toEqual(new Uint8Array([1, 2]));
    await store.deletePrivate("k");
    await expect(store.getPrivate("k")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("R2 adapter reports missing objects", async () => {
    const store = createR2MediaStore({
      async put() {},
      async get() {
        return null;
      },
      async delete() {},
    });
    await expect(store.getPrivate("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
