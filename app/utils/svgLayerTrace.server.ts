import {
  getSharp,
  traceBitmapToSvg as traceBitmapToSvgWithPotrace,
} from "./conversionModules.server";
import {
  createConversionDiagnostics,
  endTimer,
  maybeLogConversionDiagnostics,
  startTimer,
  withTimer,
} from "./conversionDiagnostics.server";
import { sanitizeSvgMarkup } from "./svgSanitize.server";
import {
  resolveOutputDimensions,
  type SortLayersBy,
} from "./converterSettings.server";
import { filterFillStrokePathTags } from "~/shared/tracing/fillStrokeSvg";
import { normalizeBmpForSharp } from "./bmpDecode.server";

export type TraceMode = "single" | "layered";
export type SvgLayerKind = "fill" | "stroke";

export type SvgLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  pathTags?: string;
  opacity?: number;
  originalOpacity?: number;
  kind?: SvgLayerKind;
};

export type EditableSvgLayer = SvgLayerMeta;

export type LayerTurnPolicy =
  | "black"
  | "white"
  | "left"
  | "right"
  | "minority"
  | "majority";

export type LayeredColorSvgOptions = {
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  optTolerance: number;
  turdSize: number;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  transparent: boolean;
  bgColor: string;
  turnPolicy: LayerTurnPolicy;
  removeColors?: string[];
  removeColorTolerance?: number;
  layerAlpha?: number;
  backgroundAlpha?: number;
  colorMergeTolerance?: number;
  posterizeStrength?: number;
  sortLayersBy?: SortLayersBy;
  brightness?: number;
  contrast?: number;
  fillStrokeWidth?: number;
  fillStrokeColor?: string;
  outputWidth?: number;
  outputHeight?: number;
  preserveAspectRatio?: boolean;
};

type NormalizedLayeredColorSvgOptions = Omit<
  LayeredColorSvgOptions,
  | "removeColors"
  | "removeColorTolerance"
  | "layerAlpha"
  | "backgroundAlpha"
  | "colorMergeTolerance"
  | "posterizeStrength"
  | "sortLayersBy"
  | "brightness"
  | "contrast"
  | "fillStrokeWidth"
  | "fillStrokeColor"
  | "outputWidth"
  | "outputHeight"
  | "preserveAspectRatio"
> & {
  removeColors: RGB[];
  removeColorTolerance: number;
  layerAlpha: number;
  backgroundAlpha: number;
  colorMergeTolerance: number;
  posterizeStrength: number;
  sortLayersBy: SortLayersBy;
  brightness: number;
  contrast: number;
  fillStrokeWidth: number;
  fillStrokeColor: string;
  outputWidth: number;
  outputHeight: number;
  preserveAspectRatio: boolean;
};

export const MIN_LAYER_COUNT = 2;
export const MAX_LAYER_COUNT = 40;
export const MAX_TRACE_SIDE_DEFAULT = 1600;
export const MAX_TRACE_SIDE = 3000;
const MIN_TRACE_DIMENSION = 2;

export const BASE_LAYERED_COLOR_DEFAULTS: LayeredColorSvgOptions = {
  layerCount: 5,
  maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
  minRegionPercent: 0.35,
  optTolerance: 0.45,
  turdSize: 4,
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
  transparent: true,
  bgColor: "#ffffff",
  turnPolicy: "majority",
};

type RGB = { r: number; g: number; b: number };

type TraceLayerBuildItem = {
  id: string;
  label: string;
  color: string;
  pixelPercent: number;
  pathTags: string;
};

export function readLayerTurnPolicy(value: string): LayerTurnPolicy {
  if (
    ["black", "white", "left", "right", "minority", "majority"].includes(
      value,
    )
  ) {
    return value as LayerTurnPolicy;
  }
  return "majority";
}

export function clampLayerNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function withSynchronousTimer<T>(
  diagnostics: ReturnType<typeof createConversionDiagnostics> | undefined,
  label: string,
  fn: () => T,
): T {
  startTimer(diagnostics, label);
  try {
    return fn();
  } finally {
    endTimer(diagnostics, label);
  }
}

function countSvgPaths(svg: string): number {
  return String(svg || "").match(/<path\b/gi)?.length ?? 0;
}

export function sanitizeLayerHexColor(input: string, fallback = "#000000") {
  const value = String(input || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return fallback;
}

export async function createLayeredColorSvg(
  input: Buffer,
  opts: LayeredColorSvgOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
}> {
  const diagnostics = createConversionDiagnostics({
    routeId: "shared-layered-trace",
    mode: "layered",
    uploadBytes: input.length,
    layerCount: opts.layerCount,
    selectedColorRemovalCount: Array.isArray(opts.removeColors)
      ? opts.removeColors.length
      : 0,
  });

  try {
    const sharp = await getSharp();

    const safeOptions = normalizeLayeredColorOptions(opts);
    const { neutralizeTransparencyCheckerboard } = await import(
      "./imagePreprocess.server"
    );
    let sourceInput = await withTimer(
      diagnostics,
      "normalizeBmpInput",
      () => normalizeBmpForSharp(input),
    );
    sourceInput = await withTimer(
      diagnostics,
      "neutralizeTransparency",
      () => neutralizeTransparencyCheckerboard(sourceInput),
    );
    sourceInput = await withTimer(diagnostics, "preprocessLayeredRaster", () =>
      preprocessLayeredRasterInput(sourceInput, safeOptions, sharp),
    );

    const { data, info } = await withTimer(diagnostics, "decodeResizeRaw", () =>
      sharp(sourceInput)
        .rotate()
        .resize({
          width: safeOptions.maxTraceSide,
          height: safeOptions.maxTraceSide,
          fit: "inside",
          withoutEnlargement: true,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );

    const width = info.width | 0;
    const height = info.height | 0;
    diagnostics.traceWidth = width;
    diagnostics.traceHeight = height;
    if (!width || !height) {
      throw new Error("Could not decode image for layered SVG tracing.");
    }
    if (width < MIN_TRACE_DIMENSION || height < MIN_TRACE_DIMENSION) {
      throw new Error(
        "Image is too small to trace safely. Please use an image at least 2x2 pixels.",
      );
    }

    const raw = data as Buffer;
    startTimer(diagnostics, "collectPalettePixels");
    const pixels = collectLayerPixels(raw, width, height, {
      removeTransparent: safeOptions.removeTransparent,
      removeWhite: safeOptions.removeWhite,
      posterize: safeOptions.posterize,
      posterizeStrength: safeOptions.posterizeStrength ?? 4,
      removeColors: safeOptions.removeColors ?? [],
      removeColorTolerance: safeOptions.removeColorTolerance ?? 18,
    });
    endTimer(diagnostics, "collectPalettePixels");

    if (pixels.length < 20) {
      throw new Error(
        "Not enough visible image data to build layers. Try disabling white background removal.",
      );
    }

    startTimer(diagnostics, "palette");
    const paletteRgb = mergeNearPaletteColors(
      buildLayerPalette(pixels, safeOptions.layerCount),
      safeOptions.colorMergeTolerance,
    );
    endTimer(diagnostics, "palette");

    startTimer(diagnostics, "assignLayerMasks");
    const assignments = assignAllPixelsToLayerPalette(raw, width, height, {
      palette: paletteRgb,
      removeTransparent: safeOptions.removeTransparent,
      removeWhite: safeOptions.removeWhite,
      posterize: safeOptions.posterize,
      posterizeStrength: safeOptions.posterizeStrength ?? 4,
      removeColors: safeOptions.removeColors ?? [],
      removeColorTolerance: safeOptions.removeColorTolerance ?? 18,
    });
    const totalAssignable = assignments.assignableCount || 1;
    const rawLayerItems = paletteRgb
      .map((rgb, index) => {
        const count = assignments.counts[index] || 0;
        const percent = (count / totalAssignable) * 100;
        return { index, rgb, color: rgbObjectToHex(rgb), count, percent };
      })
      .filter((item) => shouldKeepLayerCandidate(item, safeOptions))
      .sort((a, b) => sortLayerItems(a, b, safeOptions.sortLayersBy));
    endTimer(diagnostics, "assignLayerMasks");

    if (rawLayerItems.length === 0) {
      throw new Error(
        "No usable color layers were found. Try lowering minimum layer size or disabling white background removal.",
      );
    }

    const builtLayers: TraceLayerBuildItem[] = [];
    for (let i = 0; i < rawLayerItems.length; i++) {
      const item = rawLayerItems[i];
      const mask = Buffer.alloc(width * height, 255);
      for (let px = 0; px < assignments.layerForPixel.length; px++) {
        if (assignments.layerForPixel[px] === item.index) mask[px] = 0;
      }
      if (!maskHasInk(mask)) continue;

      const maskPng = await withTimer(diagnostics, `encodeLayerMask${i + 1}`, () =>
        sharp(mask, { raw: { width, height, channels: 1 } }).png().toBuffer(),
      );
      const pathTags = await withTimer(diagnostics, `traceLayer${i + 1}`, () =>
        traceMaskToPathTags(maskPng, {
          turdSize: safeOptions.turdSize,
          optTolerance: safeOptions.optTolerance,
          turnPolicy: safeOptions.turnPolicy,
        }),
      );
      if (!pathTagsHaveDrawablePath(pathTags)) continue;

      const label = `Layer ${builtLayers.length + 1}`;
      builtLayers.push({
        id: sanitizeLayerId(
          `layer-${builtLayers.length + 1}-${item.color.replace("#", "")}`,
        ),
        label,
        color: item.color,
        pixelPercent: Number(item.percent.toFixed(2)),
        pathTags,
      });
    }

    if (builtLayers.length === 0) {
      throw new Error(
        "The image did not produce traceable layers. Try fewer layers, lower speckle removal, or a higher-contrast image.",
      );
    }

    const svg = withSynchronousTimer(diagnostics, "buildSvg", () =>
      buildLayeredSvgString({
        width,
        height,
        layers: builtLayers,
        transparent: safeOptions.transparent,
        bgColor: safeOptions.bgColor,
        backgroundAlpha: safeOptions.backgroundAlpha,
        layerAlpha: safeOptions.layerAlpha,
        fillStrokeWidth: safeOptions.fillStrokeWidth,
        fillStrokeColor: safeOptions.fillStrokeColor,
        outputWidth: safeOptions.outputWidth,
        outputHeight: safeOptions.outputHeight,
        preserveAspectRatio: safeOptions.preserveAspectRatio,
      }),
    );
    diagnostics.finalSvgBytes = Buffer.byteLength(svg, "utf8");
    diagnostics.pathCount = countSvgPaths(svg);
    diagnostics.layerCount = builtLayers.length;
    const outputDimensions = resolveOutputDimensions(
      safeOptions,
      width,
      height,
    );

    return {
      svg,
      width: outputDimensions.width,
      height: outputDimensions.height,
      layers: [
        ...builtLayers.map((layer) => ({
          id: layer.id,
          label: layer.label,
          color: layer.color,
          originalColor: layer.color,
          visible: true,
          pathTags: layer.pathTags,
          opacity: safeOptions.layerAlpha,
          originalOpacity: safeOptions.layerAlpha,
          kind: "fill" as const,
        })),
        ...(safeOptions.fillStrokeWidth > 0
          ? [
              {
                id: "fill-stroke-outline",
                label: "Stroke outline",
                color: safeOptions.fillStrokeColor,
                originalColor: safeOptions.fillStrokeColor,
                visible: true,
                pathTags: builtLayers
                  .map((layer) =>
                    filterFillStrokePathTags(extractPathTags(layer.pathTags), {
                      width,
                      height,
                    }),
                  )
                  .join(""),
                opacity: safeOptions.layerAlpha,
                originalOpacity: safeOptions.layerAlpha,
                kind: "stroke" as const,
              },
            ]
          : []),
      ],
    };
  } finally {
    maybeLogConversionDiagnostics(diagnostics);
  }
}

function normalizeLayeredColorOptions(
  options: LayeredColorSvgOptions,
): NormalizedLayeredColorSvgOptions {
  return {
    layerCount: Math.round(
      clampLayerNumber(Number(options.layerCount), MIN_LAYER_COUNT, MAX_LAYER_COUNT),
    ),
    maxTraceSide: Math.round(
      clampLayerNumber(Number(options.maxTraceSide), 64, MAX_TRACE_SIDE),
    ),
    minRegionPercent: clampLayerNumber(Number(options.minRegionPercent), 0, 15),
    optTolerance: clampLayerNumber(Number(options.optTolerance), 0.05, 2),
    turdSize: Math.round(clampLayerNumber(Number(options.turdSize), 0, 100)),
    posterize: Boolean(options.posterize),
    removeWhite: Boolean(options.removeWhite),
    removeTransparent: Boolean(options.removeTransparent),
    transparent: Boolean(options.transparent),
    bgColor: sanitizeLayerHexColor(options.bgColor, "#ffffff"),
    turnPolicy: readLayerTurnPolicy(String(options.turnPolicy)),
    removeColors: normalizeRemoveColorList(options.removeColors),
    removeColorTolerance: clampLayerNumber(
      Number(options.removeColorTolerance ?? 18),
      0,
      160,
    ),
    layerAlpha: clampLayerNumber(Number(options.layerAlpha ?? 1), 0.05, 1),
    backgroundAlpha: clampLayerNumber(
      Number(options.backgroundAlpha ?? 1),
      0,
      1,
    ),
    colorMergeTolerance: clampLayerNumber(
      Number(options.colorMergeTolerance ?? 0),
      0,
      100,
    ),
    posterizeStrength: Math.round(
      clampLayerNumber(Number(options.posterizeStrength ?? 8), 2, 8),
    ),
    sortLayersBy: readSortLayersBy(String(options.sortLayersBy ?? "luminance")),
    brightness: clampLayerNumber(Number(options.brightness ?? 0), -50, 50),
    contrast: clampLayerNumber(Number(options.contrast ?? 0), -50, 75),
    fillStrokeWidth: clampLayerNumber(Number(options.fillStrokeWidth ?? 0), 0, 30),
    fillStrokeColor: sanitizeLayerHexColor(options.fillStrokeColor || "#020617", "#020617"),
    outputWidth: Math.round(
      clampLayerNumber(Number(options.outputWidth ?? 0), 0, 6000),
    ),
    outputHeight: Math.round(
      clampLayerNumber(Number(options.outputHeight ?? 0), 0, 6000),
    ),
    preserveAspectRatio: options.preserveAspectRatio !== false,
  };
}

export function annotateSingleTraceSvg(
  svg: string,
  color: string,
): { svg: string; layers: SvgLayerMeta[] } {
  const id = "trace-color";
  const fill = sanitizeLayerHexColor(color, "#000000");
  let pathCount = 0;

  const annotatedSvg = String(svg).replace(
    /<path\b([^>]*?)(\s*\/?)>/gi,
    (match, attrs = "", selfClose = "") => {
      const currentAttrs = String(attrs || "");
      if (/\bdata-fill-layer-id\s*=/i.test(currentAttrs)) {
        pathCount += 1;
        return match;
      }

      pathCount += 1;
      return `<path${currentAttrs} data-fill-layer-id="${id}"${selfClose}>`;
    },
  );

  return {
    svg: annotatedSvg,
    layers:
      pathCount > 0
        ? [
            {
              id,
              label: "Trace color",
              color: fill,
              originalColor: fill,
              visible: true,
              kind: "fill",
            },
          ]
        : [],
  };
}

export function annotateUploadedSvgLayers(svg: string): {
  svg: string;
  layers: SvgLayerMeta[];
} {
  const sanitized = sanitizeSvgMarkup(svg);
  if (!sanitized.ok) {
    throw new Error(sanitized.message);
  }
  svg = sanitized.svg;

  const excludedTags = new Set([
    "svg",
    "defs",
    "style",
    "title",
    "desc",
    "metadata",
    "lineargradient",
    "radialgradient",
    "pattern",
    "clippath",
    "mask",
    "filter",
    "marker",
    "symbol",
    "use",
    "image",
    "foreignobject",
    "stop",
  ]);

  const stylePaintMap = parseSvgStylePaintMap(svg);
  const layers: SvgLayerMeta[] = [];
  const layerIds = new Map<string, string>();
  let fillCount = 0;
  let strokeCount = 0;

  function getOrCreateLayerId(kind: SvgLayerKind, color: string): string {
    const key = `${kind}:${color}`;
    const existing = layerIds.get(key);
    if (existing) return existing;

    const count = kind === "fill" ? ++fillCount : ++strokeCount;
    const id = sanitizeLayerId(`${kind}-${count}-${color.replace("#", "")}`);
    layers.push({
      id,
      label: `${kind === "fill" ? "Fill" : "Stroke"} ${count}`,
      color,
      originalColor: color,
      visible: true,
      kind,
    });
    layerIds.set(key, id);
    return id;
  }

  const annotatedSvg = svg.replace(
    /<([a-zA-Z][\w:.-]*)(\s[^<>]*?)?(\s*\/?)>/g,
    (match, rawTagName, rawAttrs = "", rawSelfClose = "") => {
      const tagName = String(rawTagName || "").toLowerCase();
      if (excludedTags.has(tagName)) return match;

      let attrs = String(rawAttrs || "");
      if (
        /\bdata-layer-id\s*=|\bdata-fill-layer-id\s*=|\bdata-stroke-layer-id\s*=/i.test(
          attrs,
        )
      ) {
        return match;
      }

      const fillColor = extractSvgPaintColor(attrs, "fill", stylePaintMap);
      const strokeColor = extractSvgPaintColor(attrs, "stroke", stylePaintMap);

      if (!fillColor && !strokeColor) return match;

      if (fillColor) {
        const fillId = getOrCreateLayerId("fill", fillColor);
        attrs +=
          tagName === "g"
            ? ` data-layer-id="${fillId}"`
            : ` data-fill-layer-id="${fillId}"`;
      }
      if (strokeColor) {
        const strokeId = getOrCreateLayerId("stroke", strokeColor);
        attrs +=
          tagName === "g" && !fillColor
            ? ` data-layer-id="${strokeId}"`
            : ` data-stroke-layer-id="${strokeId}"`;
      }

      return `<${rawTagName}${attrs}${rawSelfClose}>`;
    },
  );

  return { svg: annotatedSvg, layers };
}

async function traceMaskToPathTags(
  maskPng: Buffer,
  options: {
    turdSize: number;
    optTolerance: number;
    turnPolicy: LayerTurnPolicy;
  },
): Promise<string> {
  const traced = await traceBitmapToSvgWithPotrace(maskPng, {
    color: "#000000",
    threshold: 128,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  });
  return extractPathTags(traced);
}

function collectLayerPixels(
  raw: Buffer,
  width: number,
  height: number,
  options: {
    removeTransparent: boolean;
    removeWhite: boolean;
    posterize: boolean;
    posterizeStrength: number;
    removeColors: RGB[];
    removeColorTolerance: number;
  },
): RGB[] {
  const total = width * height;
  const pixels: RGB[] = [];
  const sampleStep = Math.max(1, Math.floor(total / 16000));

  for (let i = 0; i < total; i += sampleStep) {
    const off = i * 4;
    const a = raw[off + 3];
    if (options.removeTransparent && a < 18) continue;

    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];
    if (a < 255 && !options.removeTransparent) {
      r = blendChannel(r, a, 255);
      g = blendChannel(g, a, 255);
      b = blendChannel(b, a, 255);
    }
    if (options.posterize) {
      r = posterizeChannel(r, options.posterizeStrength);
      g = posterizeChannel(g, options.posterizeStrength);
      b = posterizeChannel(b, options.posterizeStrength);
    }
    if (isSelectedRemoveColor({ r, g, b }, options)) continue;
    if (options.removeWhite && isNearWhite({ r, g, b })) continue;
    pixels.push({ r, g, b });
  }

  return pixels;
}

function assignAllPixelsToLayerPalette(
  raw: Buffer,
  width: number,
  height: number,
  options: {
    palette: RGB[];
    removeTransparent: boolean;
    removeWhite: boolean;
    posterize: boolean;
    posterizeStrength: number;
    removeColors: RGB[];
    removeColorTolerance: number;
  },
): { layerForPixel: Int16Array; counts: number[]; assignableCount: number } {
  const total = width * height;
  const layerForPixel = new Int16Array(total);
  layerForPixel.fill(-1);
  const counts = new Array(options.palette.length).fill(0);
  let assignableCount = 0;

  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const a = raw[off + 3];
    if (options.removeTransparent && a < 18) continue;

    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];
    if (a < 255 && !options.removeTransparent) {
      r = blendChannel(r, a, 255);
      g = blendChannel(g, a, 255);
      b = blendChannel(b, a, 255);
    }
    if (options.posterize) {
      r = posterizeChannel(r, options.posterizeStrength);
      g = posterizeChannel(g, options.posterizeStrength);
      b = posterizeChannel(b, options.posterizeStrength);
    }

    const rgb = { r, g, b };
    if (isSelectedRemoveColor(rgb, options)) continue;
    if (options.removeWhite && isNearWhite(rgb)) continue;

    const nearest = nearestPaletteIndex(rgb, options.palette);
    layerForPixel[i] = nearest;
    counts[nearest]++;
    assignableCount++;
  }

  return { layerForPixel, counts, assignableCount };
}

function buildLayerPalette(pixels: RGB[], requestedCount: number): RGB[] {
  const k = clampInt(requestedCount, MIN_LAYER_COUNT, MAX_LAYER_COUNT);
  const uniqueMap = new Map<string, RGB>();
  for (const pixel of pixels) {
    uniqueMap.set(`${pixel.r},${pixel.g},${pixel.b}`, pixel);
    if (uniqueMap.size >= 4096) break;
  }

  const unique = Array.from(uniqueMap.values());
  if (unique.length <= k) return unique;

  const centroids = seedLayerCentroids(unique, k);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (const pixel of pixels) {
      const index = nearestPaletteIndex(pixel, centroids);
      sums[index].r += pixel.r;
      sums[index].g += pixel.g;
      sums[index].b += pixel.b;
      sums[index].count++;
    }
    for (let i = 0; i < centroids.length; i++) {
      const sum = sums[i];
      if (!sum.count) continue;
      centroids[i] = {
        r: Math.round(sum.r / sum.count),
        g: Math.round(sum.g / sum.count),
        b: Math.round(sum.b / sum.count),
      };
    }
  }

  return dedupeLayerPalette(centroids).slice(0, k);
}

async function preprocessLayeredRasterInput(
  input: Buffer,
  options: NormalizedLayeredColorSvgOptions,
  sharp: typeof import("sharp"),
) {
  const removeColors = options.removeColors ?? [];
  const hasRemoveColors = removeColors.length > 0;
  const brightness = Number(options.brightness ?? 0);
  const contrast = Number(options.contrast ?? 0);

  if (!hasRemoveColors && brightness === 0 && contrast === 0) return input;

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
  const removeColorTolerance = Number(options.removeColorTolerance ?? 18);
  const contrastFactor = Math.max(0.1, 1 + contrast / 100);
  const brightnessFactor = Math.max(0.05, 1 + brightness / 100);

  for (let i = 0; i < width * height; i++) {
    const off = i * channels;
    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];
    if (
      hasRemoveColors &&
      removeColors.some(
        (color) => colorDistance({ r, g, b }, color) <= removeColorTolerance,
      )
    ) {
      raw[off] = 255;
      raw[off + 1] = 255;
      raw[off + 2] = 255;
      raw[off + 3] = 0;
      continue;
    }

    if (brightness !== 0 || contrast !== 0) {
      r = clampByte((r - 128) * contrastFactor + 128);
      g = clampByte((g - 128) * contrastFactor + 128);
      b = clampByte((b - 128) * contrastFactor + 128);
      raw[off] = clampByte(r * brightnessFactor);
      raw[off + 1] = clampByte(g * brightnessFactor);
      raw[off + 2] = clampByte(b * brightnessFactor);
    }
  }

  return await sharp(raw, {
    raw: { width, height, channels: channels as 1 | 2 | 3 | 4 },
  })
    .png()
    .toBuffer();
}

function mergeNearPaletteColors(palette: RGB[], tolerance = 0): RGB[] {
  if (tolerance <= 0) return palette;
  const merged: RGB[] = [];
  for (const color of palette) {
    const existing = merged.find((item) => colorDistance(item, color) <= tolerance);
    if (!existing) {
      merged.push(color);
      continue;
    }
    existing.r = Math.round((existing.r + color.r) / 2);
    existing.g = Math.round((existing.g + color.g) / 2);
    existing.b = Math.round((existing.b + color.b) / 2);
  }
  return merged;
}

function sortLayerItems(
  a: { rgb: RGB; count: number },
  b: { rgb: RGB; count: number },
  sortBy?: SortLayersBy,
) {
  if (sortBy === "area") return b.count - a.count;
  if (sortBy === "original") return 0;
  const lumDiff = luminance(b.rgb) - luminance(a.rgb);
  if (Math.abs(lumDiff) > 8) return lumDiff;
  return b.count - a.count;
}

function shouldKeepLayerCandidate(
  item: { rgb: RGB; count: number; percent: number },
  options: NormalizedLayeredColorSvgOptions,
): boolean {
  if (item.count <= 0) return false;
  if (item.percent >= options.minRegionPercent) return true;
  if (options.fillStrokeWidth <= 0) return false;

  const detailPercentFloor = Math.min(options.minRegionPercent, 0.035);
  const isDark = luminance(item.rgb) < 96;
  const isSaturatedAccent = colorSaturation(item.rgb) >= 42;
  const isNearBackgroundWhite = isNearWhite(item.rgb);
  return (
    item.percent >= detailPercentFloor &&
    (isDark || isSaturatedAccent) &&
    !isNearBackgroundWhite
  );
}

function seedLayerCentroids(pixels: RGB[], k: number): RGB[] {
  const sorted = [...pixels].sort((a, b) => {
    const lumDiff = luminance(a) - luminance(b);
    if (Math.abs(lumDiff) > 1) return lumDiff;
    return a.r + a.g + a.b - (b.r + b.g + b.b);
  });
  const seeds: RGB[] = [];
  for (let i = 0; i < k; i++) {
    const index = Math.round((i / Math.max(1, k - 1)) * (sorted.length - 1));
    seeds.push(sorted[index]);
  }
  return dedupeLayerPalette(seeds);
}

function dedupeLayerPalette(palette: RGB[]): RGB[] {
  const seen = new Set<string>();
  const out: RGB[] = [];
  for (const color of palette) {
    const key = `${color.r},${color.g},${color.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out;
}

function buildLayeredSvgString({
  width,
  height,
  layers,
  transparent,
  bgColor,
  backgroundAlpha,
  layerAlpha,
  fillStrokeWidth,
  fillStrokeColor,
  outputWidth,
  outputHeight,
  preserveAspectRatio,
}: {
  width: number;
  height: number;
  layers: TraceLayerBuildItem[];
  transparent: boolean;
  bgColor: string;
  backgroundAlpha?: number;
  layerAlpha?: number;
  fillStrokeWidth?: number;
  fillStrokeColor?: string;
  outputWidth?: number;
  outputHeight?: number;
  preserveAspectRatio?: boolean;
}): string {
  const outputDimensions = resolveOutputDimensions(
    {
      outputWidth: outputWidth ?? 0,
      outputHeight: outputHeight ?? 0,
      preserveAspectRatio: preserveAspectRatio !== false,
    },
    width,
    height,
  );
  const backgroundOpacity =
    backgroundAlpha != null && backgroundAlpha < 0.999
      ? ` fill-opacity="${formatAlpha(backgroundAlpha)}"`
      : "";
  const groupOpacity =
    layerAlpha != null && layerAlpha < 0.999
      ? ` opacity="${formatAlpha(layerAlpha)}"`
      : "";
  const safeFillStrokeWidth = clampLayerNumber(Number(fillStrokeWidth ?? 0), 0, 30);
  const safeFillStrokeColor = sanitizeLayerHexColor(
    fillStrokeColor || "#020617",
    "#020617",
  );
  const background = transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${sanitizeLayerHexColor(bgColor, "#ffffff")}"${backgroundOpacity} />`;
  const body = layers
    .map((layer) => {
      const fill = sanitizeLayerHexColor(layer.color, "#000000");
      const safeId = escapeXmlAttr(layer.id);
      const safeLabel = escapeXmlAttr(layer.label);
      return `<g id="${safeId}" data-layer-id="${safeId}" data-layer-label="${safeLabel}" data-layer-color="${fill}" fill="${fill}"${groupOpacity}>${layer.pathTags}</g>`;
    })
    .join("");
  const strokeBody =
    safeFillStrokeWidth > 0
      ? `<g id="fill-stroke-outline" data-layer-id="fill-stroke-outline" data-layer-label="Stroke outline" data-layer-color="${safeFillStrokeColor}" fill="none" stroke="${safeFillStrokeColor}" stroke-width="${formatNumber(
          safeFillStrokeWidth,
        )}" stroke-linecap="round" stroke-linejoin="round">${layers
          .map((layer) =>
            filterFillStrokePathTags(extractPathTags(layer.pathTags), { width, height }),
          )
          .join("")}</g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputDimensions.width}" height="${outputDimensions.height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from image">${background}${body}${strokeBody}</svg>`;
}

function pathTagsHaveDrawablePath(pathTags: string): boolean {
  return /<path\b[^>]*\bd\s*=\s*(["'])(?!\s*\1)[\s\S]*?\1/i.test(pathTags);
}

function extractPathTags(svg: string): string {
  const matches = String(svg).match(/<path\b[^>]*>/gi) || [];
  return matches
    .map((tag) =>
      tag
        .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\s\/?>$/i, " />"),
    )
    .join("");
}

type SvgStylePaintMap = {
  fillByClass: Map<string, string>;
  strokeByClass: Map<string, string>;
  fillById: Map<string, string>;
  strokeById: Map<string, string>;
};

function parseSvgStylePaintMap(svg: string): SvgStylePaintMap {
  const fillByClass = new Map<string, string>();
  const strokeByClass = new Map<string, string>();
  const fillById = new Map<string, string>();
  const strokeById = new Map<string, string>();

  for (const block of Array.from(
    svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
  )) {
    const css = block[1] || "";
    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(css))) {
      const selectors = String(ruleMatch[1] || "")
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      const declarations = String(ruleMatch[2] || "");
      const fillColor = extractCssDeclarationColor(declarations, "fill");
      const strokeColor = extractCssDeclarationColor(declarations, "stroke");
      if (!fillColor && !strokeColor) continue;

      for (const selector of selectors) {
        if (/^[.]([a-zA-Z_][\w-]*)$/.test(selector)) {
          const key = selector.slice(1);
          if (fillColor) fillByClass.set(key, fillColor);
          if (strokeColor) strokeByClass.set(key, strokeColor);
        } else if (/^#([a-zA-Z_][\w-]*)$/.test(selector)) {
          const key = selector.slice(1);
          if (fillColor) fillById.set(key, fillColor);
          if (strokeColor) strokeById.set(key, strokeColor);
        }
      }
    }
  }

  return { fillByClass, strokeByClass, fillById, strokeById };
}

function extractCssDeclarationColor(
  declarations: string,
  property: SvgLayerKind,
): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i");
  return normalizeSvgEditableColor(
    String(declarations).match(pattern)?.[1] || "",
  );
}

function extractSvgPaintColor(
  attrs: string,
  property: SvgLayerKind,
  stylePaintMap: SvgStylePaintMap,
): string | null {
  const attrPattern = new RegExp(
    `\\b${property}\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const directColor = normalizeSvgEditableColor(
    String(attrs).match(attrPattern)?.[1] || "",
  );
  if (directColor) return directColor;

  const styleMatch = String(attrs).match(/\bstyle\s*=\s*["']([^"']*)["']/i);
  if (styleMatch?.[1]) {
    const stylePattern = new RegExp(
      `(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`,
      "i",
    );
    const styleColor = normalizeSvgEditableColor(
      styleMatch[1].match(stylePattern)?.[1] || "",
    );
    if (styleColor) return styleColor;
  }

  const idValue = getSvgAttrValue(attrs, "id");
  if (idValue) {
    const idColor =
      property === "fill"
        ? stylePaintMap.fillById.get(idValue)
        : stylePaintMap.strokeById.get(idValue);
    if (idColor) return idColor;
  }

  const classValue = getSvgAttrValue(attrs, "class");
  if (classValue) {
    const classNames = classValue.split(/\s+/).filter(Boolean);
    for (let i = classNames.length - 1; i >= 0; i -= 1) {
      const classColor =
        property === "fill"
          ? stylePaintMap.fillByClass.get(classNames[i])
          : stylePaintMap.strokeByClass.get(classNames[i]);
      if (classColor) return classColor;
    }
  }

  return null;
}

function getSvgAttrValue(attrs: string, name: string): string {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return String(String(attrs).match(pattern)?.[1] || "").trim();
}

function normalizeSvgEditableColor(value: string): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (
    raw === "none" ||
    raw === "transparent" ||
    raw === "currentcolor" ||
    raw === "inherit" ||
    raw === "context-fill" ||
    raw === "context-stroke" ||
    raw.startsWith("url(")
  ) {
    return null;
  }

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{8}$/i.test(raw)) return `#${raw.slice(1, 7)}`;

  const rgbMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      const nums = parts.slice(0, 3).map((part) => {
        if (part.endsWith("%")) return clampByte((parseFloat(part) / 100) * 255);
        return clampByte(Number(part));
      });
      return rgbToHex(nums[0], nums[1], nums[2]);
    }
  }

  const named: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    navy: "#000080",
    teal: "#008080",
    aqua: "#00ffff",
    cyan: "#00ffff",
    lime: "#00ff00",
    yellow: "#ffff00",
    olive: "#808000",
    maroon: "#800000",
    purple: "#800080",
    fuchsia: "#ff00ff",
    magenta: "#ff00ff",
    orange: "#ffa500",
    pink: "#ffc0cb",
    brown: "#a52a2a",
    gray: "#808080",
    grey: "#808080",
    silver: "#c0c0c0",
  };

  return named[raw] || null;
}

function sanitizeLayerId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function maskHasInk(mask: Buffer): boolean {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 250) return true;
  }
  return false;
}

function nearestPaletteIndex(color: RGB, palette: RGB[]) {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i++) {
    const distance = colorDistance(color, palette[i]);
    if (distance < bestDist) {
      bestDist = distance;
      best = i;
    }
  }

  return best;
}

function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr * 0.32 + dg * dg * 0.52 + db * db * 0.16);
}

function luminance(color: RGB): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function colorSaturation(color: RGB): number {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}

function blendChannel(channel: number, alpha: number, bg: number): number {
  return Math.round((channel * alpha + bg * (255 - alpha)) / 255);
}

function posterizeChannel(value: number, strength = 4): number {
  const levels = clampInt(strength, 2, 8);
  const step = 255 / Math.max(1, levels - 1);
  return clampByte(Math.round(value / step) * step);
}

function isSelectedRemoveColor(
  color: RGB,
  options: { removeColors?: RGB[]; removeColorTolerance?: number },
): boolean {
  const colors = options.removeColors || [];
  if (!colors.length) return false;
  const tolerance = Number(options.removeColorTolerance ?? 18);
  return colors.some((item) => colorDistance(color, item) <= tolerance);
}

function isNearWhite(color: RGB): boolean {
  return color.r >= 244 && color.g >= 244 && color.b >= 244;
}

function rgbObjectToHex(color: RGB): string {
  return rgbToHex(color.r, color.g, color.b);
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => clampByte(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeRemoveColorList(colors: unknown): RGB[] {
  if (!Array.isArray(colors)) return [];
  const out: RGB[] = [];
  for (const color of colors) {
    const parsed = parseHexToRgb(String(color || ""));
    if (!parsed) continue;
    out.push(parsed);
    if (out.length >= 12) break;
  }
  return out;
}

function parseHexToRgb(value: string): RGB | null {
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

function readSortLayersBy(value: string): SortLayersBy {
  if (value === "area" || value === "original" || value === "luminance") {
    return value;
  }
  return "luminance";
}

function formatAlpha(value: number): string {
  return String(Math.max(0, Math.min(1, value)).toFixed(3))
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(3))).replace(/\.0+$/, "");
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function escapeXmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
