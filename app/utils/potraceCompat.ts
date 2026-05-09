import { createRequire } from "node:module";
import { Potrace } from "@kcaitech/potrace-ts";

const TRACE_CACHE_TTL_MS = 10 * 60 * 1000;
const TRACE_CACHE_MAX_ITEMS = 32;
const TRACE_CACHE_MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const TRACE_CACHE_MAX_ITEM_BYTES = 2 * 1024 * 1024;
const TRACE_MAX_INPUT_BYTES = 16 * 1024 * 1024;
const TRACE_MAX_PIXELS = 24_000_000;
const TRACE_MAX_SIDE = 8000;
const TRACE_TIMEOUT_MS = 20_000;
const TRACE_CACHE_VERSION = "trace-v2-kcaitech-potrace";
const TRACE_ALLOWED_SIGNATURES = new Set([
  "png",
  "jpg",
  "webp",
  "gif",
  "avif",
  "bmp",
  "tiff",
]);

type SharpModule = typeof import("sharp");
type TraceTurnPolicy = "black" | "white" | "left" | "right" | "minority" | "majority";
type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};
type NormalizedPotraceOptions = {
  turnPolicy: TraceTurnPolicy;
  turdSize: number;
  alphaMax: number;
  optCurve: boolean;
  optTolerance: number;
  threshold: number;
  blackOnWhite: boolean;
  color: string;
  background: string;
  width: number;
  height: number;
};

type TraceCacheEntry = {
  svg: string;
  bytes: number;
  expiresAt: number;
  lastUsedAt: number;
};

const requireFromHere = createRequire(import.meta.url);
let sharpModule: SharpModule | null = null;

function getTraceCache(): Map<string, TraceCacheEntry> {
  const globalState = globalThis as typeof globalThis & {
    __ilovesvg_trace_cache?: Map<string, TraceCacheEntry>;
  };
  if (!globalState.__ilovesvg_trace_cache) {
    globalState.__ilovesvg_trace_cache = new Map<string, TraceCacheEntry>();
  }
  return globalState.__ilovesvg_trace_cache;
}

async function getSharpForTrace(): Promise<SharpModule> {
  if (!sharpModule) {
    sharpModule = requireFromHere("sharp") as SharpModule;
  }
  return sharpModule;
}

export async function traceBitmapToSvg(
  input: Buffer,
  options: Record<string, unknown>,
): Promise<string> {
  validateTraceInputBasics(input);

  const cacheKey = createTraceCacheKey(input, options);
  const cached = readTraceCache(cacheKey);
  if (cached) return cached;

  const svg = await withTraceTimeout(traceBitmapToSvgUncached(input, options));
  writeTraceCache(cacheKey, svg);
  return svg;
}

async function traceBitmapToSvgUncached(
  input: Buffer,
  options: Record<string, unknown>,
): Promise<string> {
  const sharp = await getSharpForTrace();
  const signature = detectRasterSignature(input);
  if (!signature || !TRACE_ALLOWED_SIGNATURES.has(signature)) {
    throw new Error("Unsupported trace image type. Please upload a supported raster image.");
  }

  let metadata: Awaited<ReturnType<ReturnType<SharpModule>["metadata"]>>;
  try {
    metadata = await sharp(input, { limitInputPixels: TRACE_MAX_PIXELS }).rotate().metadata();
  } catch {
    throw new Error("Could not read the uploaded image. Try a different file.");
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  validateTraceDimensions(width, height);

  let raw: Awaited<ReturnType<ReturnType<SharpModule>["toBuffer"]>>;
  try {
    raw = await sharp(input, { limitInputPixels: TRACE_MAX_PIXELS })
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new Error("Could not prepare the uploaded image for tracing.");
  }

  const rawWidth = raw.info.width | 0;
  const rawHeight = raw.info.height | 0;
  const channels = raw.info.channels | 0;
  validateTraceDimensions(rawWidth, rawHeight);
  if (channels !== 4) {
    throw new Error("Could not prepare the uploaded image for tracing.");
  }

  const normalized = normalizePotraceOptions(options, rawWidth, rawHeight);
  const imageData: ImageDataLike = {
    data: new Uint8ClampedArray(raw.data),
    width: rawWidth,
    height: rawHeight,
  };

  const tracer = new Potrace(imageData as ImageData, () => {});
  applyPotraceOptions(tracer, normalized);
  return tracer.getSVG();
}

function applyPotraceOptions(tracer: Potrace, options: NormalizedPotraceOptions) {
  const mutable = tracer as unknown as {
    _params: Record<string, unknown>;
    _processed: boolean;
    _validateParameters?: (params: NormalizedPotraceOptions) => void;
  };

  mutable._validateParameters?.(options);
  mutable._params = {
    ...mutable._params,
    ...options,
  };
  mutable._processed = false;
}

function normalizePotraceOptions(
  options: Record<string, unknown>,
  width: number,
  height: number,
): NormalizedPotraceOptions {
  const invert = readBoolean(options.invert, false);
  return {
    turnPolicy: normalizeTurnPolicy(options.turnPolicy ?? options.turnpolicy),
    turdSize: Math.round(clampNumber(options.turdSize ?? options.turdsize, 2, 0, 2048)),
    alphaMax: clampNumber(options.alphaMax ?? options.alphamax, 1, 0, 1.334),
    optCurve: readBoolean(options.optCurve ?? options.optcurve, true),
    optTolerance: clampNumber(options.optTolerance ?? options.opttolerance, 0.2, 0, 10),
    threshold: Math.round(clampNumber(options.threshold, 128, 0, 255)),
    blackOnWhite: readBoolean(options.blackOnWhite, !invert),
    color: normalizeColor(options.color, "#000000"),
    background: normalizeBackground(options.background),
    width,
    height,
  };
}

function normalizeTurnPolicy(value: unknown): TraceTurnPolicy {
  const normalized = String(value || "minority").toLowerCase();
  if (
    normalized === "black" ||
    normalized === "white" ||
    normalized === "left" ||
    normalized === "right" ||
    normalized === "minority" ||
    normalized === "majority"
  ) {
    return normalized;
  }
  return "minority";
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeColor(value: unknown, fallback: string) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return color;
  if (/^[a-z]+$/i.test(color) || color === "auto") return color;
  return fallback;
}

function normalizeBackground(value: unknown) {
  const color = String(value || "transparent").trim();
  if (color === "transparent") return color;
  return normalizeColor(color, "transparent");
}

function validateTraceInputBasics(input: Buffer) {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new Error("No image data was received for tracing.");
  }
  if (input.length > TRACE_MAX_INPUT_BYTES) {
    throw new Error("Image too large for tracing. Please resize and try again.");
  }
}

function validateTraceDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error("Image is too small to trace safely.");
  }
  const pixels = width * height;
  if (width > TRACE_MAX_SIDE || height > TRACE_MAX_SIDE || pixels > TRACE_MAX_PIXELS) {
    throw new Error("Image dimensions are too large for tracing. Please resize and try again.");
  }
}

function withTraceTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Conversion timed out. Please try a smaller or simpler image."));
    }, TRACE_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function createTraceCacheKey(input: Buffer, options: Record<string, unknown>) {
  let hash = 2166136261;
  hash = updateHash(hash, TRACE_CACHE_VERSION);
  hash = updateHash(hash, stableStringify(options));

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input[i] ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return `${input.length}:${hash >>> 0}`;
}

function updateHash(hash: number, value: string) {
  let next = hash;
  for (let i = 0; i < value.length; i++) {
    next ^= value.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next;
}

function readTraceCache(key: string): string | null {
  const cache = getTraceCache();
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  entry.lastUsedAt = now;
  return entry.svg;
}

function writeTraceCache(key: string, svg: string) {
  const bytes = svg.length * 2;
  if (bytes <= 0 || bytes > TRACE_CACHE_MAX_ITEM_BYTES) return;

  const cache = getTraceCache();
  const now = Date.now();
  cache.set(key, {
    svg,
    bytes,
    expiresAt: now + TRACE_CACHE_TTL_MS,
    lastUsedAt: now,
  });
  pruneTraceCache(cache, now);
}

function pruneTraceCache(cache: Map<string, TraceCacheEntry>, now = Date.now()) {
  let totalBytes = 0;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
      continue;
    }
    totalBytes += entry.bytes;
  }

  if (cache.size <= TRACE_CACHE_MAX_ITEMS && totalBytes <= TRACE_CACHE_MAX_TOTAL_BYTES) {
    return;
  }

  const entries = Array.from(cache.entries()).sort(
    (a, b) => a[1].lastUsedAt - b[1].lastUsedAt,
  );
  for (const [key, entry] of entries) {
    if (cache.size <= TRACE_CACHE_MAX_ITEMS && totalBytes <= TRACE_CACHE_MAX_TOTAL_BYTES) {
      break;
    }
    cache.delete(key);
    totalBytes -= entry.bytes;
  }
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function detectRasterSignature(input: Buffer):
  | "png"
  | "jpg"
  | "webp"
  | "gif"
  | "avif"
  | "bmp"
  | "tiff"
  | null {
  if (input.length < 4) return null;
  if (input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e && input[3] === 0x47) return "png";
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return "jpg";
  if (input.slice(0, 4).toString("ascii") === "RIFF" && input.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  if (input.slice(0, 6).toString("ascii") === "GIF87a" || input.slice(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (input.slice(0, 2).toString("ascii") === "BM") return "bmp";
  if (
    (input[0] === 0x49 && input[1] === 0x49 && input[2] === 0x2a && input[3] === 0x00) ||
    (input[0] === 0x4d && input[1] === 0x4d && input[2] === 0x00 && input[3] === 0x2a)
  ) {
    return "tiff";
  }
  if (input.length >= 12 && input.slice(4, 8).toString("ascii") === "ftyp") {
    const brand = input.slice(8, 16).toString("ascii");
    if (/avi[f s]|mif1/.test(brand)) return "avif";
  }
  return null;
}
