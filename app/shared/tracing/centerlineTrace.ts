import type { NormalizedTraceSettings, TraceLayerMeta, TraceResult } from "./types";

export type CenterlineRasterInput = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

type Point = { x: number; y: number };

type CenterlineTraceOptions = Pick<
  NormalizedTraceSettings,
  | "threshold"
  | "invert"
  | "lineColor"
  | "transparent"
  | "bgColor"
  | "preprocess"
  | "edgeThreshold"
  | "edgeThickness"
  | "centerlineMaxTraceSide"
  | "centerlineStrokeWidth"
  | "centerlineSimplifyTolerance"
  | "centerlineMinPathLength"
  | "turdSize"
  | "traceDiagnosticsMode"
  | "outputWidth"
  | "outputHeight"
  | "preserveAspectRatio"
>;

const DEFAULT_STROKE_COLOR = "#000000";
const DEFAULT_STROKE_WIDTH = 2;
const MAX_CENTERLINE_PIXELS = 1_800_000;
const MAX_SKELETON_PIXELS = 240_000;
const MAX_POLYLINES = 950;

export function traceCenterlineRasterToSvg(
  input: CenterlineRasterInput,
  settings: CenterlineTraceOptions = {},
): TraceResult {
  const started = now();
  const width = Math.max(1, Math.round(input.width || 1));
  const height = Math.max(1, Math.round(input.height || 1));
  const pixels = width * height;
  if (pixels > MAX_CENTERLINE_PIXELS) {
    throw new Error(
      "Centerline tracing is limited to smaller line-art images. Try a lower trace size or a filled-shape preset.",
    );
  }

  const timings: Record<string, number> = {};
  const t0 = now();
  let mask =
    settings.preprocess === "edge"
      ? buildContrastLineMask(input.data, width, height, settings)
      : buildBinaryLineMask(input.data, width, height, settings);
  mask = closeBinaryMask(mask, width, height, readCloseRadius(settings));
  mask = removeTinyComponents(mask, width, height, readComponentMinSize(settings));
  timings.binaryMask = now() - t0;

  const t1 = now();
  let skeleton: Uint8Array<ArrayBufferLike> = skeletonizeZhangSuen(
    mask,
    width,
    height,
  );
  skeleton = pruneShortSkeletonBranches(
    skeleton,
    width,
    height,
    readBranchPruneLength(settings),
  );
  skeleton = removeTinyComponents(
    skeleton,
    width,
    height,
    readSkeletonComponentMinSize(settings),
  );
  const skeletonPixels = countMaskPixels(skeleton);
  if (skeletonPixels > MAX_SKELETON_PIXELS) {
    throw new Error(
      "Centerline tracing found too many line pixels. Try a cleaner image, a higher threshold, or a filled-shape preset.",
    );
  }
  timings.skeletonize = now() - t1;

  const t2 = now();
  const tracedPolylines = traceSkeletonPolylines(skeleton, width, height, {
    minPoints: readMinPathLength(settings),
    minLength: readPolylineMinLength(settings),
    simplifyTolerance: readSimplifyTolerance(settings),
  });
  const polylines = tracedPolylines
    .sort((a, b) => polylineLength(b) - polylineLength(a))
    .slice(0, MAX_POLYLINES);
  timings.tracePolylines = now() - t2;

  const t3 = now();
  const svg = buildStrokeSvg(polylines, width, height, settings);
  timings.svgAssembly = now() - t3;
  timings.total = now() - started;

  const layers: TraceLayerMeta[] = polylines.length
    ? [
        {
          id: "centerline-stroke-1",
          label: "Centerline strokes",
          color: normalizeHexColor(settings.lineColor) || DEFAULT_STROKE_COLOR,
          originalColor:
            normalizeHexColor(settings.lineColor) || DEFAULT_STROKE_COLOR,
          visible: true,
          opacity: 1,
          originalOpacity: 1,
          kind: "stroke",
        },
      ]
    : [];

  const outputSize = resolveOutputDimensions(settings, width, height);
  const pathCount = polylines.length;
  return {
    svg,
    layers,
    width: outputSize.width,
    height: outputSize.height,
    engineUsed: "centerline",
    sourceKind: "raster",
    warnings:
      polylines.length >= MAX_POLYLINES
        ? [
            "Centerline tracing was capped to keep the SVG responsive. Try a cleaner or smaller source image for more strokes.",
          ]
        : [],
    timings,
    diagnostics:
      settings.traceDiagnosticsMode === "summary"
        ? {
            engine: "centerline",
            skeletonPixels,
            polylineCount: polylines.length,
            rawPolylineCount: tracedPolylines.length,
            sourcePixels: pixels,
          }
        : {},
    pathCount,
    svgBytes: byteLength(svg),
  };
}

export function buildBinaryLineMask(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  settings: CenterlineTraceOptions = {},
): Uint8Array {
  const threshold = clampNumber(Number(settings.threshold ?? 180), 0, 255);
  const invert = settings.invert === true;
  const total = width * height;
  const out = new Uint8Array(total);
  const backgroundLuminance = estimateBackgroundLuminance(data, width, height);
  const contrastThreshold = 22;
  for (let i = 0; i < total; i += 1) {
    const offset = i * 4;
    const alpha = data[offset + 3] ?? 255;
    if (alpha < 18) continue;
    const r = data[offset] ?? 255;
    const g = data[offset + 1] ?? 255;
    const b = data[offset + 2] ?? 255;
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const active = invert
      ? luminance >= threshold ||
        (backgroundLuminance != null &&
          luminance - backgroundLuminance >= contrastThreshold)
      : luminance <= threshold ||
        (backgroundLuminance != null &&
          backgroundLuminance - luminance >= contrastThreshold);
    out[i] = active ? 1 : 0;
  }
  return out;
}

export function buildContrastLineMask(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  settings: CenterlineTraceOptions = {},
): Uint8Array {
  const baseMask = buildBinaryLineMask(data, width, height, settings);
  const out = new Uint8Array(baseMask.length);
  const edgeThreshold = clampNumber(Number(settings.edgeThreshold ?? 18), 4, 120);
  const neighborRadius = clampInt(
    Math.max(Number(settings.edgeThickness ?? 1) + 4, Number(settings.turdSize ?? 3)),
    3,
    9,
  );
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!hasVisibleAlpha(data, index)) continue;
      if (baseMask[index]) {
        if (hasLightOrTransparentNeighbor(baseMask, data, width, height, x, y, neighborRadius)) {
          out[index] = 1;
          continue;
        }
        if (localColorEdgeStrength(data, width, height, x, y) >= edgeThreshold) {
          out[index] = 1;
        }
        continue;
      }
      if (localColorEdgeStrength(data, width, height, x, y) >= edgeThreshold) {
        out[index] = 1;
      }
    }
  }
  return out;
}

function hasVisibleAlpha(data: Uint8Array | Uint8ClampedArray, index: number) {
  return (data[index * 4 + 3] ?? 255) >= 18;
}

function hasLightOrTransparentNeighbor(
  mask: Uint8Array,
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
) {
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    if (yy < 0 || yy >= height) return true;
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || xx >= width) return true;
      const candidate = yy * width + xx;
      const alpha = data[candidate * 4 + 3] ?? 255;
      if (alpha < 18 || !mask[candidate]) return true;
    }
  }
  return false;
}

function localColorEdgeStrength(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const index = y * width + x;
  const alpha = data[index * 4 + 3] ?? 255;
  let max = 0;
  const r = data[index * 4] ?? 255;
  const g = data[index * 4 + 1] ?? 255;
  const b = data[index * 4 + 2] ?? 255;
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    if (yy < 0 || yy >= height) continue;
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      if (xx < 0 || xx >= width || (xx === x && yy === y)) continue;
      const next = yy * width + xx;
      const nextAlpha = data[next * 4 + 3] ?? 255;
      const dr = r - (data[next * 4] ?? 255);
      const dg = g - (data[next * 4 + 1] ?? 255);
      const db = b - (data[next * 4 + 2] ?? 255);
      const da = (alpha - nextAlpha) * 0.45;
      max = Math.max(max, Math.hypot(dr, dg, db, da));
    }
  }
  return max;
}

function estimateBackgroundLuminance(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
) {
  const samples: number[] = [];
  const samplePixel = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3] ?? 255;
    if (alpha < 220) return;
    const r = data[offset] ?? 255;
    const g = data[offset + 1] ?? 255;
    const b = data[offset + 2] ?? 255;
    samples.push(r * 0.299 + g * 0.587 + b * 0.114);
  };
  const maxX = width - 1;
  const maxY = height - 1;
  const steps = 8;
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round((maxX * i) / steps);
    const y = Math.round((maxY * i) / steps);
    samplePixel(x, 0);
    samplePixel(x, maxY);
    samplePixel(0, y);
    samplePixel(maxX, y);
  }
  if (samples.length < 4) return null;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function skeletonizeZhangSuen(mask: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(mask);
  const toDelete: number[] = [];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 90) {
    changed = false;
    iterations += 1;
    toDelete.length = 0;
    collectZhangSuenDeletes(out, width, height, 0, toDelete);
    if (toDelete.length) {
      changed = true;
      for (const index of toDelete) out[index] = 0;
    }

    toDelete.length = 0;
    collectZhangSuenDeletes(out, width, height, 1, toDelete);
    if (toDelete.length) {
      changed = true;
      for (const index of toDelete) out[index] = 0;
    }
  }

  return out;
}

function collectZhangSuenDeletes(
  mask: Uint8Array,
  width: number,
  height: number,
  phase: 0 | 1,
  out: number[],
) {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      const p2 = mask[index - width] ? 1 : 0;
      const p3 = mask[index - width + 1] ? 1 : 0;
      const p4 = mask[index + 1] ? 1 : 0;
      const p5 = mask[index + width + 1] ? 1 : 0;
      const p6 = mask[index + width] ? 1 : 0;
      const p7 = mask[index + width - 1] ? 1 : 0;
      const p8 = mask[index - 1] ? 1 : 0;
      const p9 = mask[index - width - 1] ? 1 : 0;
      const neighbors = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      if (neighbors < 2 || neighbors > 6) continue;
      const transitions =
        (p2 === 0 && p3 === 1 ? 1 : 0) +
        (p3 === 0 && p4 === 1 ? 1 : 0) +
        (p4 === 0 && p5 === 1 ? 1 : 0) +
        (p5 === 0 && p6 === 1 ? 1 : 0) +
        (p6 === 0 && p7 === 1 ? 1 : 0) +
        (p7 === 0 && p8 === 1 ? 1 : 0) +
        (p8 === 0 && p9 === 1 ? 1 : 0) +
        (p9 === 0 && p2 === 1 ? 1 : 0);
      if (transitions !== 1) continue;
      if (phase === 0) {
        if (p2 * p4 * p6 !== 0) continue;
        if (p4 * p6 * p8 !== 0) continue;
      } else {
        if (p2 * p4 * p8 !== 0) continue;
        if (p2 * p6 * p8 !== 0) continue;
      }
      out.push(index);
    }
  }
}

function traceSkeletonPolylines(
  mask: Uint8Array,
  width: number,
  height: number,
  options: { minPoints: number; minLength: number; simplifyTolerance: number },
): Point[][] {
  const visitedEdges = new Set<string>();
  const polylines: Point[][] = [];
  const total = width * height;

  for (let index = 0; index < total; index += 1) {
    if (!mask[index]) continue;
    if (neighborIndices(mask, width, height, index).length === 2) continue;
    for (const next of neighborIndices(mask, width, height, index)) {
      const edge = edgeKey(index, next);
      if (visitedEdges.has(edge)) continue;
      const line = walkSkeleton(mask, width, height, index, next, visitedEdges);
      pushPolyline(polylines, line, options);
    }
  }

  for (let index = 0; index < total; index += 1) {
    if (!mask[index]) continue;
    const neighbors = neighborIndices(mask, width, height, index);
    const next = neighbors.find((candidate) => !visitedEdges.has(edgeKey(index, candidate)));
    if (next == null) continue;
    const line = walkSkeleton(mask, width, height, index, next, visitedEdges);
    pushPolyline(polylines, line, options);
  }

  return polylines;
}

function walkSkeleton(
  mask: Uint8Array,
  width: number,
  height: number,
  start: number,
  firstNext: number,
  visitedEdges: Set<string>,
): Point[] {
  const points = [indexToPoint(start, width), indexToPoint(firstNext, width)];
  visitedEdges.add(edgeKey(start, firstNext));
  let prev = start;
  let current = firstNext;
  let guard = 0;

  while (guard < mask.length) {
    guard += 1;
    const candidates = neighborIndices(mask, width, height, current).filter(
      (candidate) =>
        candidate !== prev && !visitedEdges.has(edgeKey(current, candidate)),
    );
    const unvisited = selectNextSkeletonNeighbor(width, prev, current, candidates);
    if (unvisited == null) break;
    visitedEdges.add(edgeKey(current, unvisited));
    prev = current;
    current = unvisited;
    points.push(indexToPoint(current, width));
    if (current === start) break;
  }

  return points;
}

function selectNextSkeletonNeighbor(
  width: number,
  previous: number,
  current: number,
  candidates: number[],
) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1 || previous < 0) return candidates[0];

  const currentPoint = indexToPoint(current, width);
  const previousPoint = indexToPoint(previous, width);
  const incoming = {
    x: currentPoint.x - previousPoint.x,
    y: currentPoint.y - previousPoint.y,
  };
  const incomingLength = Math.hypot(incoming.x, incoming.y) || 1;
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const candidatePoint = indexToPoint(candidate, width);
    const outgoing = {
      x: candidatePoint.x - currentPoint.x,
      y: candidatePoint.y - currentPoint.y,
    };
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y) || 1;
    const straightness =
      (incoming.x * outgoing.x + incoming.y * outgoing.y) /
      (incomingLength * outgoingLength);
    const diagonalPenalty =
      Math.abs(outgoing.x) === 1 && Math.abs(outgoing.y) === 1 ? 0.03 : 0;
    const score = straightness - diagonalPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (candidates.length > 1 && bestScore < 0.12) return null;
  return best;
}

function pushPolyline(
  polylines: Point[][],
  line: Point[],
  options: { minPoints: number; minLength: number; simplifyTolerance: number },
) {
  if (line.length < Math.max(2, options.minPoints)) return;
  const simplified = simplifyPolyline(line, options.simplifyTolerance);
  if (simplified.length >= 2 && polylineLength(simplified) >= options.minLength) {
    polylines.push(simplified);
  }
}

function neighborIndices(
  mask: Uint8Array,
  width: number,
  height: number,
  index: number,
) {
  const x = index % width;
  const y = Math.floor(index / width);
  const out: number[] = [];
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    if (yy < 0 || yy >= height) continue;
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      if (xx < 0 || xx >= width || (xx === x && yy === y)) continue;
      const candidate = yy * width + xx;
      if (mask[candidate]) out.push(candidate);
    }
  }
  return out;
}

function removeTinyComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minSize: number,
) {
  if (minSize <= 1) return mask;
  const out = new Uint8Array(mask);
  const visited = new Uint8Array(mask.length);
  const stack: number[] = [];
  const component: number[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (!out[i] || visited[i]) continue;
    stack.length = 0;
    component.length = 0;
    stack.push(i);
    visited[i] = 1;
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const next of neighborIndices(out, width, height, current)) {
        if (visited[next]) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (component.length >= minSize) continue;
    for (const pixel of component) out[pixel] = 0;
  }
  return out;
}

function closeBinaryMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  if (radius <= 0) return mask;
  return erodeMask(dilateMask(mask, width, height, radius), width, height, radius);
}

function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = false;
      for (let yy = y - radius; yy <= y + radius && !on; yy += 1) {
        if (yy < 0 || yy >= height) continue;
        for (let xx = x - radius; xx <= x + radius; xx += 1) {
          if (xx < 0 || xx >= width) continue;
          if (mask[yy * width + xx]) {
            on = true;
            break;
          }
        }
      }
      if (on) out[y * width + x] = 1;
    }
  }
  return out;
}

function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = true;
      for (let yy = y - radius; yy <= y + radius && keep; yy += 1) {
        if (yy < 0 || yy >= height) {
          keep = false;
          break;
        }
        for (let xx = x - radius; xx <= x + radius; xx += 1) {
          if (xx < 0 || xx >= width || !mask[yy * width + xx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[y * width + x] = 1;
    }
  }
  return out;
}

function pruneShortSkeletonBranches(
  mask: Uint8Array,
  width: number,
  height: number,
  minLength: number,
) {
  if (minLength <= 1) return mask;
  let out = new Uint8Array(mask);
  for (let pass = 0; pass < 2; pass += 1) {
    const remove = new Set<number>();
    for (let index = 0; index < out.length; index += 1) {
      if (!out[index] || neighborIndices(out, width, height, index).length !== 1) {
        continue;
      }
      const branch = collectEndpointBranch(out, width, height, index, minLength);
      if (branch.length > 0 && branch.length < minLength) {
        for (const pixel of branch) remove.add(pixel);
      }
    }
    if (remove.size === 0) break;
    const next = new Uint8Array(out);
    for (const pixel of remove) next[pixel] = 0;
    out = next;
  }
  return out;
}

function collectEndpointBranch(
  mask: Uint8Array,
  width: number,
  height: number,
  start: number,
  maxLength: number,
) {
  const branch = [start];
  let previous = -1;
  let current = start;
  while (branch.length < maxLength) {
    const neighbors = neighborIndices(mask, width, height, current);
    if (neighbors.length > 2) break;
    const next = neighbors.find((candidate) => candidate !== previous);
    if (next == null) break;
    previous = current;
    current = next;
    const degree = neighborIndices(mask, width, height, current).length;
    if (degree > 2) break;
    branch.push(current);
    if (degree <= 1) break;
  }
  return branch;
}

function buildStrokeSvg(
  polylines: Point[][],
  sourceWidth: number,
  sourceHeight: number,
  settings: CenterlineTraceOptions,
) {
  const output = resolveOutputDimensions(settings, sourceWidth, sourceHeight);
  const stroke = normalizeHexColor(settings.lineColor) || DEFAULT_STROKE_COLOR;
  const strokeWidth = clampNumber(
    Number(settings.centerlineStrokeWidth ?? DEFAULT_STROKE_WIDTH),
    0.1,
    30,
  );
  const background =
    settings.transparent === false
      ? `<rect x="0" y="0" width="${sourceWidth}" height="${sourceHeight}" fill="${escapeAttr(
          normalizeHexColor(settings.bgColor) || "#ffffff",
        )}" />`
      : "";
  const paths = polylines.map((line, index) => {
    const d = line
      .map((point, pointIndex) => {
        const cmd = pointIndex === 0 ? "M" : "L";
        return `${cmd}${formatNumber(point.x + 0.5)} ${formatNumber(point.y + 0.5)}`;
      })
      .join(" ");
    return `<path data-stroke-layer-id="centerline-stroke-1" data-layer-label="Centerline strokes" data-layer-color="${stroke}" d="${d}" />`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${output.width}" height="${output.height}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">${background}<g fill="none" stroke="${escapeAttr(
    stroke,
  )}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</g></svg>`;
}

function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  simplifyRange(points, 0, points.length - 1, tolerance * tolerance, keep);
  return points.filter((_point, index) => keep[index]);
}

function simplifyRange(
  points: Point[],
  start: number,
  end: number,
  toleranceSq: number,
  keep: Uint8Array,
) {
  if (end <= start + 1) return;
  let maxDistance = 0;
  let maxIndex = start;
  for (let i = start + 1; i < end; i += 1) {
    const distance = perpendicularDistanceSq(points[i], points[start], points[end]);
    if (distance <= maxDistance) continue;
    maxDistance = distance;
    maxIndex = i;
  }
  if (maxDistance <= toleranceSq) return;
  keep[maxIndex] = 1;
  simplifyRange(points, start, maxIndex, toleranceSq, keep);
  simplifyRange(points, maxIndex, end, toleranceSq, keep);
}

function polylineLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

function perpendicularDistanceSq(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return (point.x - a.x) ** 2 + (point.y - a.y) ** 2;
  }
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
  const projectionX = a.x + t * dx;
  const projectionY = a.y + t * dy;
  return (point.x - projectionX) ** 2 + (point.y - projectionY) ** 2;
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function indexToPoint(index: number, width: number): Point {
  return { x: index % width, y: Math.floor(index / width) };
}

function countMaskPixels(mask: Uint8Array) {
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) count += mask[i] ? 1 : 0;
  return count;
}

function readMinPathLength(settings: CenterlineTraceOptions) {
  return clampInt(Number(settings.centerlineMinPathLength ?? 5), 2, 80);
}

function readTurdSize(settings: CenterlineTraceOptions) {
  return clampInt(Number(settings.turdSize ?? 3), 1, 80);
}

function readComponentMinSize(settings: CenterlineTraceOptions) {
  return clampInt(
    Math.max(readMinPathLength(settings) * 3, readTurdSize(settings) * 5, 14),
    4,
    180,
  );
}

function readSkeletonComponentMinSize(settings: CenterlineTraceOptions) {
  return clampInt(Math.max(readMinPathLength(settings) * 2, 10), 4, 120);
}

function readBranchPruneLength(settings: CenterlineTraceOptions) {
  return clampInt(Math.max(readMinPathLength(settings) * 2, readTurdSize(settings) * 2), 4, 80);
}

function readPolylineMinLength(settings: CenterlineTraceOptions) {
  return clampNumber(
    Math.max(readMinPathLength(settings) * 2.5, readTurdSize(settings) * 3, 10),
    4,
    160,
  );
}

function readCloseRadius(settings: CenterlineTraceOptions) {
  const strokeWidth = Number(settings.centerlineStrokeWidth ?? DEFAULT_STROKE_WIDTH);
  const minPathLength = readMinPathLength(settings);
  if (settings.preprocess === "edge" && strokeWidth <= 3 && minPathLength <= 12) return 0;
  if (strokeWidth >= 3 || minPathLength >= 8) return 1;
  return 1;
}

function readSimplifyTolerance(settings: CenterlineTraceOptions) {
  return clampNumber(Number(settings.centerlineSimplifyTolerance ?? 1.1), 0, 8);
}

function resolveOutputDimensions(
  settings: Pick<
    NormalizedTraceSettings,
    "outputWidth" | "outputHeight" | "preserveAspectRatio"
  >,
  width: number,
  height: number,
) {
  let outputWidth = Math.round(Number(settings.outputWidth || 0));
  let outputHeight = Math.round(Number(settings.outputHeight || 0));
  if (!outputWidth && !outputHeight) return { width, height };
  if (settings.preserveAspectRatio !== false) {
    const ratio = width / height || 1;
    if (outputWidth && !outputHeight) outputHeight = Math.max(1, Math.round(outputWidth / ratio));
    else if (!outputWidth && outputHeight) outputWidth = Math.max(1, Math.round(outputHeight * ratio));
    else if (outputWidth && outputHeight) outputHeight = Math.max(1, Math.round(outputWidth / ratio));
  }
  return {
    width: clampInt(outputWidth || width, 1, 6000),
    height: clampInt(outputHeight || height, 1, 6000),
  };
}

function normalizeHexColor(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}

function byteLength(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

function escapeAttr(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clampNumber(value, min, max));
}

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
