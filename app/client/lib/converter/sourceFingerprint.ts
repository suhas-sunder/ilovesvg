export type SourceFingerprint = {
  sha256: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
};

type SourceDimensions = {
  width?: number | null;
  height?: number | null;
};

const fingerprintPromiseByFile = new WeakMap<
  File,
  Promise<SourceFingerprint | null>
>();

export function getSourceFingerprint(
  file: File,
  dimensions?: SourceDimensions,
): Promise<SourceFingerprint | null> {
  const existing = fingerprintPromiseByFile.get(file);
  if (existing) return existing;

  const promise = createSourceFingerprint(file, dimensions);
  fingerprintPromiseByFile.set(file, promise);
  return promise;
}

export function clearSourceFingerprintCacheForTests() {
  // WeakMap cannot be cleared. Tests use fresh File objects, so this is a
  // no-op hook for a consistent cache-module test surface.
}

async function createSourceFingerprint(
  file: File,
  dimensions?: SourceDimensions,
): Promise<SourceFingerprint | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) return null;
  if (typeof file.arrayBuffer !== "function") return null;

  const buffer = await file.arrayBuffer();
  const digest = await subtle.digest("SHA-256", buffer);
  const hashBytes = new Uint8Array(digest);
  const knownDimensions = normalizeDimensions(dimensions);
  const probedDimensions =
    knownDimensions || (await readImageDimensionsIfAvailable(file));

  return {
    sha256: Array.from(hashBytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
    size: file.size,
    mime: file.type || inferMimeFromName(file.name),
    ...(probedDimensions || {}),
  };
}

function normalizeDimensions(
  dimensions?: SourceDimensions,
): { width: number; height: number } | null {
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  if (
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0
  ) {
    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }
  return null;
}

async function readImageDimensionsIfAvailable(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return {
        width: bitmap.width,
        height: bitmap.height,
      };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

function inferMimeFromName(fileName: string): string {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "";
}
