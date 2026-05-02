import { getSharp } from "./conversionModules.server";
import {
  addConversionWarning,
  createConversionDiagnostics,
  endTimer,
  maybeLogConversionDiagnostics,
  startTimer,
  withTimer,
} from "./conversionDiagnostics.server";

type RGB = { r: number; g: number; b: number };

export type RasterTracePreprocessOptions = {
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
  threshold?: number;
  maxTraceSide?: number;
  removeColors?: string[];
  removeColorTolerance?: number;
  brightness?: number;
  contrast?: number;
  edgeThreshold?: number;
  edgeThickness?: number;
  noiseReduction?: number;
  gapCloseStrength?: number;
  minIslandPx?: number;
  holeFillPx?: number;
};

const MAX_PREPROCESS_SIDE = 3000;
const MAX_PREPROCESS_MP = 24;
const MIN_TRACE_DIMENSION = 2;

export async function normalizeRasterForTrace(
  input: Buffer,
  opts: RasterTracePreprocessOptions,
): Promise<Buffer> {
  const diagnostics = createConversionDiagnostics({
    routeId: "shared-raster-normalize",
    mode: opts.preprocess === "edge" ? "edge-trace" : "single-trace",
    uploadBytes: input.length,
    selectedColorRemovalCount: Array.isArray(opts.removeColors)
      ? opts.removeColors.length
      : 0,
  });

  try {
    const sharp = await getSharp();

    let sourceInput = await withTimer(
      diagnostics,
      "neutralizeTransparency",
      () => neutralizeTransparencyCheckerboard(input),
    );
    const removeColors = normalizeRemoveColors(opts.removeColors);
    const removeColorTolerance = clampNumber(opts.removeColorTolerance ?? 18, 0, 160);

    if (removeColors.length > 0) {
      sourceInput = await withTimer(
        diagnostics,
        "removeSelectedColors",
        () =>
          removeSelectedColorsFromRaster(
            sourceInput,
            removeColors,
            removeColorTolerance,
          ),
      );
    }

    let base = sharp(sourceInput).rotate();

    try {
      startTimer(diagnostics, "metadata");
      const metadata = await base.metadata();
      endTimer(diagnostics, "metadata");
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      diagnostics.sourceWidth = width;
      diagnostics.sourceHeight = height;
      ensureTraceableDimensions(width, height);
      const mp = (width * height) / 1_000_000;
      const maxTraceSide = Math.round(
        clampNumber(opts.maxTraceSide ?? MAX_PREPROCESS_SIDE, 64, MAX_PREPROCESS_SIDE),
      );
      if (
        width > maxTraceSide ||
        height > maxTraceSide ||
        mp > MAX_PREPROCESS_MP
      ) {
        base = base.resize({
          width: maxTraceSide,
          height: maxTraceSide,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
    } catch (error) {
      endTimer(diagnostics, "metadata");
      if (isTraceDimensionError(error)) throw error;
    }

    const brightness = clampNumber(opts.brightness ?? 0, -50, 50);
    const contrast = clampNumber(opts.contrast ?? 0, -50, 75);
    if (brightness !== 0) {
      base = base.modulate({ brightness: Math.max(0.05, 1 + brightness / 100) });
    }
    if (contrast !== 0) {
      const factor = Math.max(0.1, 1 + contrast / 100);
      base = base.linear(factor, 128 * (1 - factor));
    }

    if (opts.noiseReduction && opts.noiseReduction > 0) {
      base = base.median(Math.round(clampNumber(opts.noiseReduction, 1, 5)));
    }

    if (opts.preprocess === "edge") {
      return await withTimer(diagnostics, "edgeMask", () =>
        buildEdgeTraceMask(base, sourceInput, opts, sharp),
      );
    }

    const prepared = await withTimer(diagnostics, "grayscaleRaw", () =>
      base
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .removeAlpha()
        .grayscale()
        .gamma()
        .normalize()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );

    const width = prepared.info.width | 0;
    const height = prepared.info.height | 0;
    diagnostics.traceWidth = width;
    diagnostics.traceHeight = height;
    ensureTraceableDimensions(width, height);
    let gray: Buffer<ArrayBufferLike> = Buffer.from(prepared.data as Buffer);
    startTimer(diagnostics, "maskCleanup");
    gray = applyBinaryCleanup(gray, width, height, opts);
    endTimer(diagnostics, "maskCleanup");

    return await withTimer(diagnostics, "encodeMaskPng", () =>
      sharp(gray, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer(),
    );
  } catch (error) {
    if (isTraceDimensionError(error)) throw error;
    addConversionWarning(
      diagnostics,
      "Raster preprocessing fell back to the original upload.",
    );
    return input;
  } finally {
    maybeLogConversionDiagnostics(diagnostics);
  }
}

export async function neutralizeTransparencyCheckerboard(
  input: Buffer,
): Promise<Buffer> {
  try {
    const sharp = await getSharp();
    const pattern = await detectCheckerboardBackground(input, sharp);

    if (!pattern) return input;

    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width | 0;
    const height = info.height | 0;
    const channels = info.channels | 0;

    if (width <= 0 || height <= 0 || channels < 4) return input;

    const raw = data as Buffer;
    const removable = findBorderConnectedCheckerPixels(
      raw,
      width,
      height,
      channels,
      pattern.colors,
      pattern.tolerance,
    );

    if (!removable) return input;

    let removed = 0;
    for (let i = 0; i < removable.length; i++) {
      if (!removable[i]) continue;

      const off = i * channels;
      raw[off] = 255;
      raw[off + 1] = 255;
      raw[off + 2] = 255;
      raw[off + 3] = 0;
      removed++;
    }

    if (removed < Math.max(16, Math.round((width * height) * 0.005))) {
      return input;
    }

    return await sharp(raw, {
      raw: { width, height, channels: channels as 1 | 2 | 3 | 4 },
    })
      .png()
      .toBuffer();
  } catch {
    return input;
  }
}

async function detectCheckerboardBackground(
  input: Buffer,
  sharp: typeof import("sharp"),
): Promise<{ colors: RGB[]; tolerance: number } | null> {
  const { data, info } = await sharp(input)
    .resize({
      width: 720,
      height: 720,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width | 0;
  const height = info.height | 0;
  const channels = info.channels | 0;
  if (width <= 4 || height <= 4 || channels < 4) return null;

  const raw = data as Buffer;
  const total = width * height;
  const edgeSampleCount = Math.max(1, width * 2 + height * 2 - 4);
  const histogram = new Map<string, { count: number; edgeCount: number; rgb: RGB }>();
  let candidateCount = 0;
  let edgeCandidateCount = 0;

  for (let i = 0; i < total; i++) {
    const off = i * channels;
    const a = raw[off + 3];
    if (a < 245) continue;

    const rgb = { r: raw[off], g: raw[off + 1], b: raw[off + 2] };
    if (!isLightNeutral(rgb)) continue;

    const x = i % width;
    const y = Math.floor(i / width);
    const key = quantizeRgbKey(rgb, 8);
    const bucket = histogram.get(key) ?? {
      count: 0,
      edgeCount: 0,
      rgb: parseRgbKey(key),
    };

    bucket.count++;
    candidateCount++;

    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      bucket.edgeCount++;
      edgeCandidateCount++;
    }

    histogram.set(key, bucket);
  }

  if (candidateCount / total < 0.08) return null;
  if (edgeCandidateCount / edgeSampleCount < 0.35) return null;

  const buckets = Array.from(histogram.values())
    .filter((bucket) => bucket.count / total >= 0.008)
    .sort((a, b) => b.count - a.count);

  if (buckets.length < 2) return null;

  let first: (typeof buckets)[number] | null = null;
  let second: (typeof buckets)[number] | null = null;

  for (const bucket of buckets) {
    if (!first) {
      first = bucket;
      continue;
    }

    const delta = colorDistance(first.rgb, bucket.rgb);
    if (delta >= 8 && delta <= 70) {
      second = bucket;
      break;
    }
  }

  if (!first || !second) return null;

  const topCoverage = (first.count + second.count) / Math.max(candidateCount, 1);
  const edgeCoverage =
    (first.edgeCount + second.edgeCount) / Math.max(edgeCandidateCount, 1);

  if (topCoverage < 0.45 || edgeCoverage < 0.45) return null;

  return {
    colors: [first.rgb, second.rgb],
    tolerance: 20,
  };
}

function findBorderConnectedCheckerPixels(
  raw: Buffer,
  width: number,
  height: number,
  channels: number,
  colors: RGB[],
  tolerance: number,
): Uint8Array | null {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  function isCandidate(index: number) {
    if (visited[index]) return false;

    const off = index * channels;
    if (raw[off + 3] < 245) return false;

    const rgb = { r: raw[off], g: raw[off + 1], b: raw[off + 2] };
    if (!isLightNeutral(rgb)) return false;

    return colors.some((color) => colorDistance(rgb, color) <= tolerance);
  }

  function enqueue(index: number) {
    if (!isCandidate(index)) return;
    visited[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  return tail > 0 ? visited : null;
}

function isLightNeutral(rgb: RGB) {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return min >= 178 && max - min <= 10;
}

async function buildEdgeTraceMask(
  base: import("sharp").Sharp,
  sourceInput: Buffer,
  opts: RasterTracePreprocessOptions,
  sharp: typeof import("sharp"),
) {
  const { data, info } = await base
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .grayscale()
    .blur(opts.blurSigma > 0 ? opts.blurSigma : undefined)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width | 0;
  const height = info.height | 0;
  ensureTraceableDimensions(width, height);

  if (width <= 1 || height <= 1) {
    return await sharp(sourceInput)
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale()
      .gamma()
      .normalize()
      .png()
      .toBuffer();
  }

  const src = data as Buffer;
  let out: Buffer<ArrayBufferLike> = Buffer.alloc(width * height, 255);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const edgeThreshold = clampNumber(opts.edgeThreshold ?? 18, 0, 160);
  const edgeBoost = clampNumber(opts.edgeBoost ?? 1, 0.25, 3);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      let n = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const value = src[(y + j) * width + (x + i)];
          gx += value * kx[n];
          gy += value * ky[n];
          n++;
        }
      }
      const magnitude = Math.sqrt(gx * gx + gy * gy) * edgeBoost;
      out[y * width + x] =
        magnitude < edgeThreshold ? 255 : 255 - Math.min(255, magnitude);
    }
  }

  const edgeThickness = Math.round(clampNumber(opts.edgeThickness ?? 1, 1, 4));
  if (edgeThickness > 1) {
    out = dilateDarkPixels(out, width, height, edgeThickness - 1);
  }
  out = applyBinaryCleanup(out, width, height, opts);

  if (isFlatBuffer(out)) {
    return await sharp(sourceInput)
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .grayscale()
      .gamma()
      .normalize()
      .png()
      .toBuffer();
  }

  return await sharp(out, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

async function removeSelectedColorsFromRaster(
  input: Buffer,
  colors: RGB[],
  tolerance: number,
) {
  const sharp = await getSharp();
  const { data, info } = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width | 0;
  const height = info.height | 0;
  const channels = info.channels | 0;
  if (!width || !height || channels < 4) return input;

  const raw = Buffer.from(data as Buffer);
  for (let i = 0; i < width * height; i++) {
    const off = i * channels;
    const pixel = { r: raw[off], g: raw[off + 1], b: raw[off + 2] };
    if (colors.some((color) => colorDistance(pixel, color) <= tolerance)) {
      raw[off] = 255;
      raw[off + 1] = 255;
      raw[off + 2] = 255;
      raw[off + 3] = 0;
    }
  }

  return await sharp(raw, {
    raw: { width, height, channels: channels as 1 | 2 | 3 | 4 },
  })
    .png()
    .toBuffer();
}

function applyBinaryCleanup(
  gray: Buffer<ArrayBufferLike>,
  width: number,
  height: number,
  opts: RasterTracePreprocessOptions,
): Buffer<ArrayBufferLike> {
  if (!width || !height) return gray;
  const threshold = clampNumber(opts.threshold ?? 128, 0, 255);
  const minIslandPx = Math.round(clampNumber(opts.minIslandPx ?? 0, 0, 120));
  const holeFillPx = Math.round(clampNumber(opts.holeFillPx ?? 0, 0, 120));
  const gapCloseStrength = Math.round(
    clampNumber(opts.gapCloseStrength ?? 0, 0, 3),
  );

  if (!minIslandPx && !holeFillPx && !gapCloseStrength) return gray;

  let mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = gray[i] <= threshold ? 1 : 0;
  }

  if (gapCloseStrength > 0) {
    mask = erodeDarkPixels(
      dilateBinaryMask(mask, width, height, gapCloseStrength),
      width,
      height,
      gapCloseStrength,
    );
  }
  if (minIslandPx > 0) {
    removeSmallComponents(mask, width, height, minIslandPx, 1, 0, true);
  }
  if (holeFillPx > 0) {
    removeSmallComponents(mask, width, height, holeFillPx, 0, 1, false);
  }

  const out = Buffer.alloc(mask.length);
  for (let i = 0; i < mask.length; i++) {
    out[i] = mask[i] ? 0 : 255;
  }
  return out;
}

function removeSmallComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  maxSize: number,
  targetValue: 0 | 1,
  replacementValue: 0 | 1,
  allowBorder: boolean,
) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const component = new Int32Array(Math.max(1, maxSize + 1));

  for (let start = 0; start < total; start++) {
    if (visited[start] || mask[start] !== targetValue) continue;

    let head = 0;
    let tail = 0;
    let count = 0;
    let touchesBorder = false;
    function enqueue(index: number) {
      if (visited[index] || mask[index] !== targetValue) return;
      visited[index] = 1;
      queue[tail++] = index;
    }

    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesBorder = true;
      }
      if (count <= maxSize) component[count] = index;
      count++;

      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y < height - 1) enqueue(index + width);
    }

    if (count <= maxSize && (allowBorder || !touchesBorder)) {
      for (let i = 0; i < count; i++) mask[component[i]] = replacementValue;
    }
  }

}

function dilateDarkPixels(
  gray: Buffer<ArrayBufferLike>,
  width: number,
  height: number,
  radius: number,
): Buffer<ArrayBufferLike> {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = gray[i] < 240 ? 1 : 0;
  const dilated = dilateBinaryMask(mask, width, height, radius);
  const out = Buffer.from(gray);
  for (let i = 0; i < dilated.length; i++) {
    if (dilated[i]) out[i] = Math.min(out[i], 0);
  }
  return out;
}

function dilateBinaryMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!mask[index]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
}

function erodeDarkPixels(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          keep = false;
          break;
        }
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width || !mask[ny * width + nx]) {
            keep = false;
            break;
          }
        }
      }
      out[y * width + x] = keep ? 1 : 0;
    }
  }
  return out;
}

function normalizeRemoveColors(colors: unknown): RGB[] {
  if (!Array.isArray(colors)) return [];
  const out: RGB[] = [];
  for (const color of colors) {
    const parsed = parseHexColor(String(color || ""));
    if (!parsed) continue;
    out.push(parsed);
    if (out.length >= 12) break;
  }
  return out;
}

function parseHexColor(value: string): RGB | null {
  const raw = value.trim().toLowerCase();
  let hex = "";
  if (/^#[0-9a-f]{6}$/.test(raw)) hex = raw.slice(1);
  else if (/^#[0-9a-f]{3}$/.test(raw)) {
    hex = `${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  } else return null;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function ensureTraceableDimensions(width: number, height: number) {
  if (width >= MIN_TRACE_DIMENSION && height >= MIN_TRACE_DIMENSION) return;
  const error = new Error(
    "Image is too small to trace safely. Please use an image at least 2x2 pixels.",
  ) as Error & { code?: string };
  error.code = "TRACE_IMAGE_TOO_SMALL";
  throw error;
}

function isTraceDimensionError(error: unknown) {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "TRACE_IMAGE_TOO_SMALL"
  );
}

function isFlatBuffer(buffer: Buffer) {
  if (buffer.length === 0) return true;
  const first = buffer[0];
  for (let i = 1; i < buffer.length; i++) {
    if (Math.abs(buffer[i] - first) > 2) return false;
  }
  return true;
}

function colorDistance(a: RGB, b: RGB) {
  return Math.sqrt(
    (a.r - b.r) * (a.r - b.r) +
      (a.g - b.g) * (a.g - b.g) +
      (a.b - b.b) * (a.b - b.b),
  );
}

function quantizeRgbKey(rgb: RGB, step: number) {
  const q = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value / step) * step));

  return `${q(rgb.r)},${q(rgb.g)},${q(rgb.b)}`;
}

function parseRgbKey(key: string): RGB {
  const [r, g, b] = key.split(",").map((part) => Number(part) || 0);
  return { r, g, b };
}
