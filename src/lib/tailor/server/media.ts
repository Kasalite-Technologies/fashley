import { err } from "./errors";
import type { MediaStore } from "./config";

export const MAX_IMAGE_BYTES = 10_485_760;
const MAX_DIMENSION = 16_384;

export interface SanitizedImage {
  mime: "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  sha256: string;
}

function reject(message: string): never {
  throw err("UPLOAD_REJECTED", message);
}

type ImageMime = SanitizedImage["mime"];
const MIME_BY_FORMAT: Record<string, ImageMime> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function checkDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  )
    reject("Image dimensions are out of range.");
}
const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32be = (b: Uint8Array, o: number) =>
  b[o]! * 0x1000000 + ((b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!);
const u32le = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function sniff(input: Uint8Array): ImageMime | null {
  if (input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff)
    return "image/jpeg";
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (input.length >= 8 && pngSig.every((v, i) => input[i] === v)) return "image/png";
  if (
    input.length >= 12 &&
    String.fromCharCode(...input.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...input.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

function rebuildJpeg(input: Uint8Array): { bytes: Uint8Array; widthPx: number; heightPx: number } {
  const parts: Uint8Array[] = [input.slice(0, 2)];
  let pos = 2;
  let width = 0;
  let height = 0;
  let sawSof = false;
  let sawEoi = false;
  while (pos < input.length) {
    if (input[pos] !== 0xff) reject("Corrupt JPEG structure.");
    const segStart = pos;
    let p = pos + 1;
    while (p < input.length && input[p] === 0xff) p++;
    if (p >= input.length) reject("Truncated JPEG.");
    const marker = input[p]!;
    pos = p + 1;
    if (marker === 0x00 || marker === 0xd8) reject("Corrupt JPEG structure.");
    if (marker === 0xd9) reject("JPEG has no scan data.");
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.slice(segStart, pos));
      continue;
    }
    if (pos + 2 > input.length) reject("Truncated JPEG segment.");
    const segLen = u16be(input, pos);
    if (segLen < 2 || pos + segLen > input.length) reject("Truncated JPEG segment.");
    const segEnd = pos + segLen;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (segLen < 7) reject("Corrupt JPEG frame header.");
      height = u16be(input, pos + 3);
      width = u16be(input, pos + 5);
      sawSof = true;
    }
    if (marker === 0xda) {
      if (!sawSof) reject("JPEG scan precedes frame header.");
      parts.push(input.slice(segStart, segEnd));
      let eoiEnd = -1;
      for (let i = segEnd; i + 1 < input.length; i++) {
        if (input[i] !== 0xff) continue;
        const next = input[i + 1]!;
        if (next === 0xd9) {
          eoiEnd = i + 2;
          break;
        }
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) i++;
      }
      if (eoiEnd < 0) reject("JPEG is missing its end marker.");
      parts.push(input.slice(segEnd, eoiEnd));
      sawEoi = true;
      break;
    }
    // Metadata-stripping rebuild (not a pixel re-encode): drop APP1 (EXIF/XMP) and COM.
    if (marker !== 0xe1 && marker !== 0xfe) parts.push(input.slice(segStart, segEnd));
    pos = segEnd;
  }
  if (!sawSof || !sawEoi) reject("Corrupt JPEG structure.");
  checkDimensions(width, height);
  return { bytes: concat(parts), widthPx: width, heightPx: height };
}

function rebuildPng(input: Uint8Array): { bytes: Uint8Array; widthPx: number; heightPx: number } {
  const parts: Uint8Array[] = [input.slice(0, 8)];
  const keep = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
  let pos = 8;
  let width = 0;
  let height = 0;
  let sawIdat = false;
  let sawIend = false;
  let first = true;
  while (pos < input.length) {
    if (pos + 8 > input.length) reject("Truncated PNG chunk.");
    const len = u32be(input, pos);
    const type = String.fromCharCode(...input.slice(pos + 4, pos + 8));
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    const crcEnd = dataEnd + 4;
    if (len > 0x7fffffff || crcEnd > input.length) reject("Truncated PNG chunk.");
    if (first && type !== "IHDR") reject("PNG must start with IHDR.");
    first = false;
    if (keep.has(type)) {
      const stored = u32be(input, dataEnd);
      if (crc32(input.slice(pos + 4, dataEnd)) !== stored) reject("PNG chunk CRC mismatch.");
      if (type === "IHDR") {
        if (len !== 13) reject("Corrupt PNG header.");
        width = u32be(input, dataStart);
        height = u32be(input, dataStart + 4);
      }
      if (type === "IDAT") sawIdat = true;
      parts.push(input.slice(pos, crcEnd));
    }
    pos = crcEnd;
    if (type === "IEND") {
      sawIend = true;
      break;
    }
  }
  if (!sawIdat || !sawIend) reject("Corrupt PNG structure.");
  checkDimensions(width, height);
  // Metadata-stripping rebuild (not a pixel re-encode): only IHDR/PLTE/IDAT/IEND survive.
  return { bytes: concat(parts), widthPx: width, heightPx: height };
}

function rebuildWebp(input: Uint8Array): { bytes: Uint8Array; widthPx: number; heightPx: number } {
  const riffEnd = u32le(input, 4) + 8;
  if (riffEnd < 12 || riffEnd > input.length) reject("Truncated WebP.");
  const chunks: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  let pos = 12;
  while (pos + 8 <= riffEnd) {
    const type = String.fromCharCode(...input.slice(pos, pos + 4));
    const size = u32le(input, pos + 4);
    const dataStart = pos + 8;
    const paddedEnd = dataStart + size + (size % 2);
    if (dataStart + size > riffEnd || paddedEnd > riffEnd) reject("Truncated WebP chunk.");
    const data = input.slice(dataStart, dataStart + size);
    if (type === "VP8X") {
      if (size < 10) reject("Corrupt WebP VP8X header.");
      width = (data[4]! | (data[5]! << 8) | (data[6]! << 16)) + 1;
      height = (data[7]! | (data[8]! << 8) | (data[9]! << 16)) + 1;
    } else if (type === "VP8 ") {
      if (size < 10 || data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a)
        reject("Corrupt WebP lossy header.");
      width = u16le(data, 6) & 0x3fff;
      height = u16le(data, 8) & 0x3fff;
    } else if (type === "VP8L") {
      if (size < 5 || data[0] !== 0x2f) reject("Corrupt WebP lossless header.");
      const v = u32le(data, 1);
      width = (v & 0x3fff) + 1;
      height = ((v >>> 14) & 0x3fff) + 1;
    }
    // Metadata-stripping rebuild (not a pixel re-encode): drop EXIF and XMP chunks.
    if (type !== "EXIF" && type !== "XMP " && type !== "XMP") {
      const chunk = input.slice(pos, Math.min(paddedEnd, riffEnd));
      if (type === "VP8X" && chunk.length >= 9) {
        const copy = new Uint8Array(chunk);
        copy[8] = copy[8]! & ~0x0c;
        chunks.push(copy);
      } else chunks.push(chunk);
    }
    pos = paddedEnd;
  }
  if (!width || !height) reject("Corrupt WebP structure.");
  checkDimensions(width, height);
  const body = concat([new TextEncoder().encode("WEBP"), ...chunks]);
  const header = new Uint8Array(8);
  header.set(new TextEncoder().encode("RIFF"), 0);
  const total = body.length;
  header[4] = total & 0xff;
  header[5] = (total >>> 8) & 0xff;
  header[6] = (total >>> 16) & 0xff;
  header[7] = (total >>> 24) & 0xff;
  return { bytes: concat([header, body]), widthPx: width, heightPx: height };
}
/**
 * Metadata-stripping rebuild, not a pixel re-encode: validates container
 * structure and dimensions, drops known metadata segments/chunks, and hashes
 * the rebuilt bytes. Pixel data is carried through unchanged.
 */
export async function sanitizeImage(
  input: Uint8Array,
  declaredMime: string,
): Promise<SanitizedImage> {
  if (!input.length) reject("Upload is empty.");
  if (input.length > MAX_IMAGE_BYTES) reject("Upload exceeds the maximum size.");
  if (!Object.values(MIME_BY_FORMAT).includes(declaredMime as ImageMime))
    reject("Declared image type is not supported.");
  const sniffed = sniff(input);
  if (!sniffed || sniffed !== declaredMime)
    reject("Image contents do not match the declared type.");
  const rebuilt =
    sniffed === "image/jpeg"
      ? rebuildJpeg(input)
      : sniffed === "image/png"
        ? rebuildPng(input)
        : rebuildWebp(input);
  const digest = await crypto.subtle.digest("SHA-256", rebuilt.bytes as BufferSource);
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return {
    mime: sniffed,
    bytes: rebuilt.bytes,
    widthPx: rebuilt.widthPx,
    heightPx: rebuilt.heightPx,
    sha256,
  };
}

export class InMemoryMediaStore implements MediaStore {
  readonly objects = new Map<string, Uint8Array>();
  async putPrivate(key: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(key, new Uint8Array(bytes));
  }
  async getPrivate(key: string): Promise<Uint8Array> {
    const found = this.objects.get(key);
    if (!found) throw err("NOT_FOUND", "Media object not found.");
    return new Uint8Array(found);
  }
  async deletePrivate(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export interface R2BucketLike {
  put(key: string, value: Uint8Array): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<unknown>;
}

export function createR2MediaStore(bucket: R2BucketLike): MediaStore {
  return {
    async putPrivate(key, bytes) {
      await bucket.put(key, bytes);
    },
    async getPrivate(key) {
      const object = await bucket.get(key);
      if (!object) throw err("NOT_FOUND", "Media object not found.");
      return new Uint8Array(await object.arrayBuffer());
    },
    async deletePrivate(key) {
      await bucket.delete(key);
    },
  };
}
