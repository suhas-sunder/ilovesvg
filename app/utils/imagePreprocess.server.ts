import { createRequire } from "node:module";

type RGB = { r: number; g: number; b: number };

const req = createRequire(import.meta.url);

export async function neutralizeTransparencyCheckerboard(
  input: Buffer,
): Promise<Buffer> {
  try {
    const sharp = req("sharp") as typeof import("sharp");
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
