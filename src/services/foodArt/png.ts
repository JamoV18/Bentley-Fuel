import { createHash } from "node:crypto";

export interface ValidatedPng {
  width: number;
  height: number;
  checksumSha256: string;
  hasAlpha: boolean;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3];
}

export function parseImageSize(size: string): { width: number; height: number } {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid food-art image size: ${size}`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid food-art image size: ${size}`);
  }
  return { width, height };
}

export function validateMasterPng(
  bytes: Uint8Array,
  expectedSize: { width: number; height: number },
): ValidatedPng {
  if (bytes.byteLength < 100_000) {
    throw new Error(`Generated PNG is suspiciously small (${bytes.byteLength} bytes). Refusing to publish it as a master.`);
  }
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) throw new Error("Generated artwork is not a valid PNG file.");
  }
  const ihdrLength = readUint32(bytes, 8);
  const ihdrType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (ihdrLength !== 13 || ihdrType !== "IHDR") throw new Error("Generated PNG is missing a valid IHDR header.");

  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  const colorType = bytes[25];
  const hasAlpha = colorType === 4 || colorType === 6;

  if (width !== expectedSize.width || height !== expectedSize.height) {
    throw new Error(`Generated PNG is ${width}x${height}; expected the full-resolution ${expectedSize.width}x${expectedSize.height} master.`);
  }
  if (!hasAlpha) {
    throw new Error("Generated PNG has no alpha channel. Falcon Food Art masters must support a transparent background.");
  }

  return {
    width,
    height,
    hasAlpha,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
