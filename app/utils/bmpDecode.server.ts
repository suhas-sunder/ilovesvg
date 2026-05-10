import { createRequire } from "node:module";

type SharpModule = typeof import("sharp");

const BMP_FILE_HEADER_BYTES = 14;
const BITMAPINFOHEADER_BYTES = 40;
const BI_RGB = 0;
const SUPPORTED_BITS_PER_PIXEL = new Set([24, 32]);

const requireFromHere = createRequire(import.meta.url);
let sharpModule: SharpModule | null = null;

export function isBmpBuffer(input: Buffer): boolean {
  return input.length >= BMP_FILE_HEADER_BYTES && input.slice(0, 2).toString("ascii") === "BM";
}

export async function normalizeBmpForSharp(input: Buffer): Promise<Buffer> {
  if (!isBmpBuffer(input)) return input;

  const decoded = decodeBmpToRgba(input);
  const sharp = getSharpForBmp();
  return sharp(decoded.rgba, {
    raw: {
      width: decoded.width,
      height: decoded.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function getSharpForBmp(): SharpModule {
  if (!sharpModule) {
    sharpModule = requireFromHere("sharp") as SharpModule;
  }
  return sharpModule;
}

function decodeBmpToRgba(input: Buffer): {
  rgba: Buffer;
  width: number;
  height: number;
} {
  const pixelOffset = input.readUInt32LE(10);
  const dibHeaderSize = input.readUInt32LE(14);
  if (dibHeaderSize < BITMAPINFOHEADER_BYTES) {
    throw new Error("Unsupported BMP header.");
  }

  const width = input.readInt32LE(18);
  const rawHeight = input.readInt32LE(22);
  const planes = input.readUInt16LE(26);
  const bitsPerPixel = input.readUInt16LE(28);
  const compression = input.readUInt32LE(30);

  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;

  if (width <= 0 || height <= 0 || planes !== 1) {
    throw new Error("Invalid BMP dimensions.");
  }
  if (!SUPPORTED_BITS_PER_PIXEL.has(bitsPerPixel) || compression !== BI_RGB) {
    throw new Error("Unsupported BMP format. Use an uncompressed 24-bit or 32-bit BMP.");
  }

  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
  const requiredBytes = pixelOffset + rowSize * height;
  if (pixelOffset < BMP_FILE_HEADER_BYTES + dibHeaderSize || requiredBytes > input.length) {
    throw new Error("Invalid BMP pixel data.");
  }

  const rgba = Buffer.alloc(width * height * 4);
  let alphaSum = 0;

  for (let y = 0; y < height; y++) {
    const sourceY = topDown ? y : height - 1 - y;
    const sourceRow = pixelOffset + sourceY * rowSize;
    for (let x = 0; x < width; x++) {
      const source = sourceRow + x * bytesPerPixel;
      const target = (y * width + x) * 4;
      rgba[target] = input[source + 2];
      rgba[target + 1] = input[source + 1];
      rgba[target + 2] = input[source];
      rgba[target + 3] = bytesPerPixel === 4 ? input[source + 3] : 255;
      alphaSum += rgba[target + 3];
    }
  }

  if (bytesPerPixel === 4 && alphaSum === 0) {
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  }

  return { rgba, width, height };
}
