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
import { clampSvgPathDataPrecision } from "~/shared/tracing/svgPathPrecision";
import {
  detectLayeredSvgImportantColorBounds,
  optimizeLayeredSvgPathStructure,
  resolveLayeredSvgStructureOptimizationOptions,
  type SvgPathBounds,
} from "~/shared/tracing/svgPathStructureOptimizer";
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
  pathCount?: number;
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
  presetId?: string;
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
  presetId: string;
};

export const MIN_LAYER_COUNT = 2;
export const MAX_LAYER_COUNT = 40;
export const MAX_TRACE_SIDE_DEFAULT = 1600;
export const MAX_TRACE_SIDE = 3000;
const MIN_TRACE_DIMENSION = 2;
const GENERATED_LAYERED_PATH_PRECISION = 0;

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

type FlatColorFamily =
  | "dark"
  | "lightNeutral"
  | "neutral"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink";

type FlatColorPaletteAnalysis = {
  target: number;
  bucketCount: number;
  perceptualClusterCount: number;
  familyCount: number;
  hueBucketCount: number;
  regionComplexity: number;
  edgeDensity: number;
  highContrastEdgeDensity: number;
  darkDetailDensity: number;
  highDetailScore: number;
  nearDuplicateDensity: number;
  simpleImageScore: number;
  transparentShare: number;
  sourceTransparentShare: number | null;
  lightNeutralShare: number;
  blueFamilyShare: number;
  lightNeutralMatteShare: number;
  sourceLightNeutralMatteShare: number;
  lightNeutralMatteColor: RGB | null;
};

type FlatColorSampleEntry = {
  color: RGB;
  count: number;
  firstIndex: number;
};

type FlatColorSourceMatteAnalysis = {
  transparentShare: number;
  lightNeutralMatteShare: number;
  blueFamilyShare: number;
  lightNeutralMatteColor: RGB | null;
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
    presetId: opts.presetId,
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
    const sourceMatte = isFlatColorLayeredOptions(safeOptions)
      ? await withTimer(diagnostics, "sourceMatte", () =>
          analyzeFlatColorSourceMatte(sourceInput, safeOptions, sharp),
        )
      : null;
    sourceInput = await withTimer(
      diagnostics,
      "neutralizeTransparency",
      () => neutralizeTransparencyCheckerboard(sourceInput),
    );
    sourceInput = await withTimer(diagnostics, "preprocessLayeredRaster", () =>
      preprocessLayeredRasterInput(sourceInput, safeOptions, sharp),
    );
    const sourceDimensions = await withTimer(diagnostics, "sourceMetadata", async () => {
      const metadata = await sharp(sourceInput).metadata();
      return resolveOrientedRasterDimensions(metadata);
    });
    diagnostics.sourceWidth = sourceDimensions.width;
    diagnostics.sourceHeight = sourceDimensions.height;

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
    const adaptivePalette = analyzeFlatColorAdaptivePalette(
      raw,
      width,
      height,
      pixels,
      safeOptions,
      sourceMatte,
    );
    const effectiveLayerCount = resolveEffectiveLayerPaletteCount(
      safeOptions,
      adaptivePalette,
    );
    const effectiveMergeTolerance =
      effectiveLayerCount > safeOptions.layerCount &&
      isFlatColorLayeredOptions(safeOptions)
        ? Math.min(safeOptions.colorMergeTolerance, 4)
        : safeOptions.colorMergeTolerance;
    const paletteRgb = mergeNearPaletteColors(
      buildLayerPalette(pixels, effectiveLayerCount),
      effectiveMergeTolerance,
    );
    diagnostics.effectiveLayerCount = effectiveLayerCount;
    if (adaptivePalette) {
      diagnostics.adaptiveLayerPalette = {
        target: adaptivePalette.target,
        bucketCount: adaptivePalette.bucketCount,
        perceptualClusterCount: adaptivePalette.perceptualClusterCount,
        familyCount: adaptivePalette.familyCount,
        hueBucketCount: adaptivePalette.hueBucketCount,
        regionComplexity: Number(adaptivePalette.regionComplexity.toFixed(3)),
        edgeDensity: Number(adaptivePalette.edgeDensity.toFixed(3)),
        highContrastEdgeDensity: Number(
          adaptivePalette.highContrastEdgeDensity.toFixed(3),
        ),
        darkDetailDensity: Number(
          adaptivePalette.darkDetailDensity.toFixed(3),
        ),
        highDetailScore: Number(adaptivePalette.highDetailScore.toFixed(3)),
        nearDuplicateDensity: Number(
          adaptivePalette.nearDuplicateDensity.toFixed(3),
        ),
        simpleImageScore: Number(adaptivePalette.simpleImageScore.toFixed(3)),
        transparentShare: Number(adaptivePalette.transparentShare.toFixed(3)),
        sourceTransparentShare:
          adaptivePalette.sourceTransparentShare == null
            ? undefined
            : Number(adaptivePalette.sourceTransparentShare.toFixed(3)),
        lightNeutralShare: Number(adaptivePalette.lightNeutralShare.toFixed(3)),
        blueFamilyShare: Number(adaptivePalette.blueFamilyShare.toFixed(3)),
        lightNeutralMatteShare: Number(
          adaptivePalette.lightNeutralMatteShare.toFixed(3),
        ),
        sourceLightNeutralMatteShare: Number(
          adaptivePalette.sourceLightNeutralMatteShare.toFixed(3),
        ),
        lightNeutralMatteColor: adaptivePalette.lightNeutralMatteColor
          ? rgbObjectToHex(adaptivePalette.lightNeutralMatteColor)
          : undefined,
      };
    }
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

    const finalLayers = applyFlatColorLightNeutralMatte(
      builtLayers,
      adaptivePalette,
      safeOptions,
      width,
      height,
    );
    if (diagnostics.adaptiveLayerPalette) {
      diagnostics.adaptiveLayerPalette.lightNeutralMatteApplied =
        finalLayers !== builtLayers;
    }
    const visuallyOrderedLayers = isFlatColorLayeredOptions(safeOptions)
      ? orderFlatColorLayersForVisualStack(finalLayers)
      : finalLayers;
    const detectedDetailBounds = isFlatColorLayeredOptions(safeOptions)
      ? detectLayeredSvgImportantColorBounds(
          wrapLayerPathTagsForStructureAnalysis(visuallyOrderedLayers, width, height),
        )
      : null;
    const preserveDetailBounds =
      detectedDetailBounds && isFocusedFlatColorDetailBounds(detectedDetailBounds, width, height)
        ? detectedDetailBounds
        : null;
    const detailPreservedLayers = preserveDetailBounds
      ? applyFocusedFlatColorDetailMatte(
          visuallyOrderedLayers,
          adaptivePalette,
          safeOptions,
          preserveDetailBounds,
          width,
          height,
        )
      : visuallyOrderedLayers;
    const serializedLayers = detailPreservedLayers.map((layer) => ({
      ...layer,
      pathTags: optimizeLayerPathTags(
        clampSvgPathDataPrecision(
          layer.pathTags,
          GENERATED_LAYERED_PATH_PRECISION,
        ),
        layer.color,
        width,
        height,
        preserveDetailBounds,
      ),
    }));

    const svg = withSynchronousTimer(diagnostics, "buildSvg", () =>
      buildLayeredSvgString({
        width,
        height,
        layers: serializedLayers,
        transparent: safeOptions.transparent,
        bgColor: safeOptions.bgColor,
        backgroundAlpha: safeOptions.backgroundAlpha,
        layerAlpha: safeOptions.layerAlpha,
        fillStrokeWidth: safeOptions.fillStrokeWidth,
        fillStrokeColor: safeOptions.fillStrokeColor,
        sourceWidth: sourceDimensions.width,
        sourceHeight: sourceDimensions.height,
        outputWidth: safeOptions.outputWidth,
        outputHeight: safeOptions.outputHeight,
        preserveAspectRatio: safeOptions.preserveAspectRatio,
      }),
    );
    diagnostics.finalSvgBytes = Buffer.byteLength(svg, "utf8");
    diagnostics.pathCount = countSvgPaths(svg);
    diagnostics.layerCount = serializedLayers.length;
    const outputBasisWidth =
      sourceDimensions.width > 0 ? sourceDimensions.width : width;
    const outputBasisHeight =
      sourceDimensions.height > 0 ? sourceDimensions.height : height;
    const outputDimensions = resolveOutputDimensions(
      safeOptions,
      outputBasisWidth,
      outputBasisHeight,
    );

    return {
      svg,
      width: outputDimensions.width,
      height: outputDimensions.height,
      layers: [
        ...serializedLayers.map((layer) => ({
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
                pathTags: serializedLayers
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
    presetId: String(options.presetId || ""),
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

function resolveOrientedRasterDimensions(metadata: {
  width?: number;
  height?: number;
  orientation?: number;
}) {
  const width = Math.max(0, Math.round(Number(metadata.width ?? 0)));
  const height = Math.max(0, Math.round(Number(metadata.height ?? 0)));
  const orientation = Number(metadata.orientation ?? 1);
  return [5, 6, 7, 8].includes(orientation)
    ? { width: height, height: width }
    : { width, height };
}

function optimizeLayerPathTags(
  pathTags: string,
  color: string,
  width: number,
  height: number,
  preserveDetailBounds?: SvgPathBounds | null,
): string {
  if (!pathTags) return pathTags;
  const fill = sanitizeLayerHexColor(color, "#000000");
  const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><g fill="${fill}" data-layer-color="${fill}">${pathTags}</g></svg>`;
  const optimized = optimizeLayeredSvgPathStructure(
    wrappedSvg,
    {
      ...resolveLayeredSvgStructureOptimizationOptions(width, height),
      preserveDetailBounds,
    },
  );
  return extractPathTags(optimized.svg) || pathTags;
}

function wrapLayerPathTagsForStructureAnalysis(
  layers: TraceLayerBuildItem[],
  width: number,
  height: number,
) {
  const body = layers
    .map((layer) => {
      const fill = sanitizeLayerHexColor(layer.color, "#000000");
      return `<g fill="${fill}" data-layer-color="${fill}">${layer.pathTags}</g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function isFocusedFlatColorDetailBounds(
  bounds: SvgPathBounds,
  width: number,
  height: number,
) {
  const boundsArea =
    Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
  return boundsArea / Math.max(1, width * height) <= 0.72;
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
  const isLightNeutralDetail =
    isFlatColorLayeredOptions(options) &&
    luminance(item.rgb) >= 96 &&
    luminance(item.rgb) <= 238 &&
    colorSaturation(item.rgb) <= 54;
  return (
    item.percent >= detailPercentFloor &&
    (isDark || isSaturatedAccent || isLightNeutralDetail) &&
    !isNearBackgroundWhite
  );
}

function resolveEffectiveLayerPaletteCount(
  options: NormalizedLayeredColorSvgOptions,
  analysis: FlatColorPaletteAnalysis | null,
) {
  if (!analysis) return options.layerCount;
  return clampInt(analysis.target, MIN_LAYER_COUNT, 32);
}

function isFlatColorLayeredOptions(options: NormalizedLayeredColorSvgOptions) {
  return (
    options.presetId === "layered-flat-color" ||
    (
      options.layerCount >= 14 &&
      options.layerCount <= 18 &&
      options.maxTraceSide >= 1400 &&
      options.minRegionPercent <= 0.12 &&
      options.posterize === false
    )
  );
}

function analyzeFlatColorAdaptivePalette(
  raw: Buffer,
  width: number,
  height: number,
  pixels: RGB[],
  options: NormalizedLayeredColorSvgOptions,
  sourceMatte: FlatColorSourceMatteAnalysis | null,
): FlatColorPaletteAnalysis | null {
  if (!isFlatColorLayeredOptions(options)) return null;
  const entries = collectFlatColorSampleEntries(pixels);
  const perceptualClusters = clusterFlatColorSamples(entries, 18);
  const familyCounts = new Map<FlatColorFamily, number>();
  const hueBuckets = new Set<number>();
  const colorBuckets = new Set<string>();
  let highChromaCount = 0;
  let lightNeutralCount = 0;
  let blueFamilyCount = 0;
  let dominantFamilyCount = 0;
  let sampledCount = 0;
  let lightNeutralMatteCount = 0;
  let lightNeutralMatteColor: RGB | null = null;
  let lightNeutralMatteColorCount = 0;

  for (const entry of entries) {
    const color = entry.color;
    const family = flatColorFamily(color);
    familyCounts.set(family, (familyCounts.get(family) || 0) + entry.count);
    colorBuckets.add(
      `${Math.floor(color.r / 16)},${Math.floor(color.g / 16)},${Math.floor(color.b / 16)}`,
    );
    sampledCount += entry.count;
    if (colorSaturation(color) >= 64) {
      highChromaCount += entry.count;
      hueBuckets.add(Math.floor(rgbHueDegrees(color) / 24));
    }
    if (family === "blue" || family === "cyan") blueFamilyCount += entry.count;
    if (family === "lightNeutral" || family === "neutral") {
      lightNeutralCount += entry.count;
    }
    if (isFlatColorLightNeutralMatte(color)) {
      lightNeutralMatteCount += entry.count;
      if (entry.count > lightNeutralMatteColorCount) {
        lightNeutralMatteColor = color;
        lightNeutralMatteColorCount = entry.count;
      }
    }
  }

  for (const count of familyCounts.values()) {
    dominantFamilyCount = Math.max(dominantFamilyCount, count);
  }

  const regionComplexity = estimateFlatColorRegionComplexity(raw, width, height, options);
  const detailMetrics = estimateFlatColorDetailMetrics(raw, width, height, options);
  const transparentShare = estimateTransparentShare(raw, width, height);
  const meaningfulFamilies = [...familyCounts.values()].filter(
    (count) => count / Math.max(1, sampledCount) >= 0.01,
  ).length;
  const nearDuplicateDensity =
    1 - perceptualClusters.length / Math.max(1, entries.length);
  const dominantFamilyShare = dominantFamilyCount / Math.max(1, sampledCount);
  const lightNeutralShare = lightNeutralCount / Math.max(1, sampledCount);
  const sourceBlueFamilyShare = sourceMatte?.blueFamilyShare ?? 0;
  const blueFamilyShare = Math.max(
    blueFamilyCount / Math.max(1, sampledCount),
    sourceBlueFamilyShare,
  );
  const outputLightNeutralMatteShare =
    lightNeutralMatteCount / Math.max(1, sampledCount);
  const sourceLightNeutralMatteShare =
    sourceMatte && sourceMatte.transparentShare <= 0.03
      ? sourceMatte.lightNeutralMatteShare
      : 0;
  const effectiveLightNeutralMatteShare = Math.max(
    outputLightNeutralMatteShare,
    sourceLightNeutralMatteShare,
  );
  const effectiveLightNeutralMatteColor =
    sourceLightNeutralMatteShare > outputLightNeutralMatteShare
      ? sourceMatte?.lightNeutralMatteColor ?? lightNeutralMatteColor
      : lightNeutralMatteColor;
  const simpleImageScore =
    (dominantFamilyShare > 0.45 ? 0.55 : 0) +
    (nearDuplicateDensity > 0.82 ? 0.25 : 0) +
    (regionComplexity < 0.55 ? 0.2 : 0) +
    (perceptualClusters.length < 80 ? 0.35 : 0);
  const blueNeutralRisk =
    blueFamilyShare > 0.12 && lightNeutralShare > 0.18 ? 1 : 0;
  const rawTarget =
    8 +
    Math.log2(1 + perceptualClusters.length) * 1.55 +
    meaningfulFamilies * 0.55 +
    hueBuckets.size * 0.28 +
    regionComplexity * 2.2 +
    detailMetrics.edgeDensity * 3.6 +
    detailMetrics.darkDetailDensity * 9 +
    detailMetrics.highContrastEdgeDensity * 2.8 +
    Math.min(4, colorBuckets.size / 120) +
    (highChromaCount / Math.max(1, sampledCount)) * 2.5 +
    blueNeutralRisk * 1.5 -
    nearDuplicateDensity * 2.8 -
    simpleImageScore * 4.2;

  let target = Math.round(rawTarget);
  if (colorBuckets.size >= 90 && meaningfulFamilies >= 4) {
    target = Math.max(target, 18);
  }
  if (perceptualClusters.length >= 90 && meaningfulFamilies >= 8) {
    target = Math.max(target, 24);
  }
  if (perceptualClusters.length >= 350 || colorBuckets.size >= 600) {
    target = Math.max(target, 28);
  }
  if (
    perceptualClusters.length >= 700 ||
    colorBuckets.size >= 900 ||
    (detailMetrics.highDetailScore >= 0.78 &&
      colorBuckets.size >= 620 &&
      detailMetrics.edgeDensity >= 0.16) ||
    detailMetrics.darkDetailDensity >= 0.055
  ) {
    target = 30;
  }
  if (
    colorBuckets.size >= 1800 &&
    detailMetrics.darkDetailDensity >= 0.14 &&
    detailMetrics.highContrastEdgeDensity >= 0.13 &&
    detailMetrics.highDetailScore >= 0.96
  ) {
    target = 32;
  }
  if (simpleImageScore >= 1 && perceptualClusters.length < 90) {
    target = Math.min(target, 18);
  }

  return {
    target: clampInt(target, MIN_LAYER_COUNT, 32),
    bucketCount: colorBuckets.size,
    perceptualClusterCount: perceptualClusters.length,
    familyCount: meaningfulFamilies,
    hueBucketCount: hueBuckets.size,
    regionComplexity,
    edgeDensity: detailMetrics.edgeDensity,
    highContrastEdgeDensity: detailMetrics.highContrastEdgeDensity,
    darkDetailDensity: detailMetrics.darkDetailDensity,
    highDetailScore: detailMetrics.highDetailScore,
    nearDuplicateDensity,
    simpleImageScore,
    transparentShare,
    sourceTransparentShare: sourceMatte?.transparentShare ?? null,
    lightNeutralShare,
    blueFamilyShare,
    lightNeutralMatteShare: effectiveLightNeutralMatteShare,
    sourceLightNeutralMatteShare,
    lightNeutralMatteColor: effectiveLightNeutralMatteColor,
  };
}

async function analyzeFlatColorSourceMatte(
  input: Buffer,
  options: NormalizedLayeredColorSvgOptions,
  sharp: typeof import("sharp"),
): Promise<FlatColorSourceMatteAnalysis> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: options.maxTraceSide,
      height: options.maxTraceSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return analyzeFlatColorMatteFromRaw(
    data as Buffer,
    info.width | 0,
    info.height | 0,
    options,
  );
}

function analyzeFlatColorMatteFromRaw(
  raw: Buffer,
  width: number,
  height: number,
  options: NormalizedLayeredColorSvgOptions,
): FlatColorSourceMatteAnalysis {
  const total = Math.max(1, width * height);
  const step = Math.max(1, Math.floor(total / 200000));
  const matteCounts = new Map<string, { color: RGB; count: number }>();
  let sampled = 0;
  let transparent = 0;
  let blueFamily = 0;
  let matte = 0;

  for (let pixel = 0; pixel < total; pixel += step) {
    const offset = pixel * 4;
    const alpha = raw[offset + 3];
    if (alpha < 18) {
      transparent += 1;
      continue;
    }
    const color = normalizeRawLayerPixel(raw, offset, alpha, options);
    if (!color) continue;
    sampled += 1;
    const family = flatColorFamily(color);
    if (family === "blue" || family === "cyan") blueFamily += 1;
    if (!isFlatColorLightNeutralMatte(color)) continue;
    matte += 1;
    const key = `${color.r},${color.g},${color.b}`;
    const current = matteCounts.get(key);
    if (current) {
      current.count += 1;
    } else {
      matteCounts.set(key, { color, count: 1 });
    }
  }

  const topMatte =
    [...matteCounts.values()].sort((a, b) => b.count - a.count)[0]?.color ?? null;
  return {
    transparentShare: transparent / Math.max(1, sampled + transparent),
    lightNeutralMatteShare: matte / Math.max(1, sampled),
    blueFamilyShare: blueFamily / Math.max(1, sampled),
    lightNeutralMatteColor: topMatte,
  };
}

function collectFlatColorSampleEntries(pixels: RGB[]): FlatColorSampleEntry[] {
  const entries = new Map<string, FlatColorSampleEntry>();
  for (let index = 0; index < pixels.length; index += 1) {
    const color = pixels[index];
    const key = `${color.r},${color.g},${color.b}`;
    const current = entries.get(key);
    if (current) {
      current.count += 1;
    } else {
      entries.set(key, { color, count: 1, firstIndex: index });
    }
  }
  return [...entries.values()].sort(
    (a, b) => b.count - a.count || a.firstIndex - b.firstIndex,
  );
}

function clusterFlatColorSamples(
  entries: FlatColorSampleEntry[],
  tolerance: number,
): FlatColorSampleEntry[] {
  const clusters: FlatColorSampleEntry[] = [];
  for (const entry of entries) {
    let best: FlatColorSampleEntry | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const entryFamily = flatColorFamily(entry.color);
    for (const cluster of clusters) {
      if (flatColorFamily(cluster.color) !== entryFamily) continue;
      const distance = colorDistance(entry.color, cluster.color);
      if (distance < bestDistance) {
        best = cluster;
        bestDistance = distance;
      }
    }
    if (best && bestDistance <= tolerance) {
      best.count += entry.count;
    } else {
      clusters.push({ ...entry });
    }
  }
  return clusters;
}

function estimateFlatColorRegionComplexity(
  raw: Buffer,
  width: number,
  height: number,
  options: NormalizedLayeredColorSvgOptions,
) {
  const grid = 8;
  const dominant: string[][] = [];
  let transitions = 0;
  let cells = 0;
  const sampleXStep = Math.max(1, Math.floor(width / 160));
  const sampleYStep = Math.max(1, Math.floor(height / 160));
  for (let row = 0; row < grid; row += 1) {
    dominant[row] = [];
    const yStart = Math.floor((row / grid) * height);
    const yEnd = Math.floor(((row + 1) / grid) * height);
    for (let col = 0; col < grid; col += 1) {
      const counts = new Map<FlatColorFamily, number>();
      const xStart = Math.floor((col / grid) * width);
      const xEnd = Math.floor(((col + 1) / grid) * width);
      for (let y = yStart; y < yEnd; y += sampleYStep) {
        for (let x = xStart; x < xEnd; x += sampleXStep) {
          const offset = (y * width + x) * 4;
          const alpha = raw[offset + 3];
          if (options.removeTransparent && alpha < 18) continue;
          const color = normalizeRawLayerPixel(raw, offset, alpha, options);
          if (!color) continue;
          const family = flatColorFamily(color);
          counts.set(family, (counts.get(family) || 0) + 1);
        }
      }
      const family = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      dominant[row][col] = family || "lightNeutral";
      if (col > 0 && dominant[row][col - 1] !== dominant[row][col]) {
        transitions += 1;
      }
      if (row > 0 && dominant[row - 1][col] !== dominant[row][col]) {
        transitions += 1;
      }
      cells += 1;
    }
  }
  return transitions / Math.max(1, cells);
}

function estimateFlatColorDetailMetrics(
  raw: Buffer,
  width: number,
  height: number,
  options: NormalizedLayeredColorSvgOptions,
) {
  const totalPixels = Math.max(1, width * height);
  const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / 24000)));
  const coarseBuckets = new Set<string>();
  const fineBuckets = new Set<string>();
  const hueBuckets = new Set<number>();
  const familyCounts = new Map<FlatColorFamily, number>();
  let sampledPixels = 0;
  let darkPixels = 0;
  let edgeComparisons = 0;
  let edgeHits = 0;
  let highContrastEdgeHits = 0;
  let darkDetailHits = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const color = readFlatColorDetailPixel(raw, width, height, x, y, options);
      if (!color) continue;
      sampledPixels += 1;
      coarseBuckets.add(bucketFlatColorDetail(color, 16));
      fineBuckets.add(bucketFlatColorDetail(color, 8));
      if (colorSaturation(color) >= 46) {
        hueBuckets.add(Math.floor(rgbHueDegrees(color) / 20));
      }
      const family = flatColorFamily(color);
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
      if (luminance(color) <= 72) darkPixels += 1;

      for (const neighbor of [
        readFlatColorDetailPixel(raw, width, height, x + stride, y, options),
        readFlatColorDetailPixel(raw, width, height, x, y + stride, options),
      ]) {
        if (!neighbor) continue;
        edgeComparisons += 1;
        const distance = colorDistance(color, neighbor);
        if (distance < 45) continue;
        edgeHits += 1;
        const luma = luminance(color);
        const neighborLuma = luminance(neighbor);
        const contrast = Math.abs(luma - neighborLuma);
        if (distance >= 70 && contrast >= 62) {
          highContrastEdgeHits += 1;
        }
        if (
          distance >= 60 &&
          contrast >= 56 &&
          ((luma <= 76 && neighborLuma >= 122) ||
            (neighborLuma <= 76 && luma >= 122))
        ) {
          darkDetailHits += 1;
        }
      }
    }
  }

  const meaningfulFamilies = [...familyCounts.values()].filter(
    (count) => count / Math.max(1, sampledPixels) >= 0.01,
  ).length;
  const dominantFamilyShare =
    Math.max(0, ...familyCounts.values()) / Math.max(1, sampledPixels);
  const edgeDensity = edgeHits / Math.max(1, edgeComparisons);
  const highContrastEdgeDensity =
    highContrastEdgeHits / Math.max(1, edgeComparisons);
  const darkDetailDensity = darkDetailHits / Math.max(1, edgeComparisons);
  const darkPixelShare = darkPixels / Math.max(1, sampledPixels);
  const simpleImageScore = clampNumber(
    (coarseBuckets.size < 150 ? 0.28 : 0) +
      (meaningfulFamilies <= 4 ? 0.24 : 0) +
      (dominantFamilyShare >= 0.52 ? 0.22 : 0) +
      (edgeDensity < 0.07 ? 0.18 : 0) +
      (darkDetailDensity < 0.01 ? 0.08 : 0),
    0,
    1,
  );
  const highDetailScore = clampNumber(
    clampNumber(coarseBuckets.size / 760, 0, 1) * 0.28 +
      clampNumber(fineBuckets.size / 1400, 0, 1) * 0.1 +
      clampNumber((hueBuckets.size - 3) / 12, 0, 1) * 0.12 +
      clampNumber((meaningfulFamilies - 3) / 6, 0, 1) * 0.12 +
      clampNumber(edgeDensity / 0.24, 0, 1) * 0.2 +
      clampNumber(darkDetailDensity / 0.08, 0, 1) * 0.12 +
      clampNumber(highContrastEdgeDensity / 0.14, 0, 1) * 0.06 -
      simpleImageScore * 0.22,
    0,
    1,
  );

  return {
    edgeDensity,
    highContrastEdgeDensity,
    darkDetailDensity,
    darkPixelShare,
    highDetailScore,
  };
}

function readFlatColorDetailPixel(
  raw: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  options: NormalizedLayeredColorSvgOptions,
): RGB | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  const offset = (y * width + x) * 4;
  const alpha = raw[offset + 3];
  if (alpha < 18) return null;
  return normalizeRawLayerPixel(raw, offset, alpha, options);
}

function bucketFlatColorDetail(color: RGB, divisor: number) {
  return `${Math.floor(color.r / divisor)},${Math.floor(color.g / divisor)},${Math.floor(color.b / divisor)}`;
}

function normalizeRawLayerPixel(
  raw: Buffer,
  offset: number,
  alpha: number,
  options: NormalizedLayeredColorSvgOptions,
): RGB | null {
  let r = raw[offset];
  let g = raw[offset + 1];
  let b = raw[offset + 2];
  if (alpha < 255 && !options.removeTransparent) {
    r = blendChannel(r, alpha, 255);
    g = blendChannel(g, alpha, 255);
    b = blendChannel(b, alpha, 255);
  }
  if (options.posterize) {
    r = posterizeChannel(r, options.posterizeStrength);
    g = posterizeChannel(g, options.posterizeStrength);
    b = posterizeChannel(b, options.posterizeStrength);
  }
  const color = { r, g, b };
  if (options.removeWhite && isNearWhite(color)) return null;
  if (isSelectedRemoveColor(color, options)) return null;
  return color;
}

function estimateTransparentShare(raw: Buffer, width: number, height: number) {
  const total = Math.max(1, width * height);
  const step = Math.max(1, Math.floor(total / 20000));
  let transparent = 0;
  let sampled = 0;
  for (let pixel = 0; pixel < total; pixel += step) {
    sampled += 1;
    if (raw[pixel * 4 + 3] < 18) transparent += 1;
  }
  return transparent / Math.max(1, sampled);
}

function applyFlatColorLightNeutralMatte(
  layers: TraceLayerBuildItem[],
  analysis: FlatColorPaletteAnalysis | null,
  options: NormalizedLayeredColorSvgOptions,
  width: number,
  height: number,
) {
  const sourceOpaqueMatte =
    analysis &&
    analysis.sourceTransparentShare != null &&
    analysis.sourceTransparentShare <= 0.03 &&
    analysis.sourceLightNeutralMatteShare >= 0.28;
  const outputOpaqueMatte =
    analysis &&
    analysis.transparentShare <= 0.03 &&
    analysis.lightNeutralMatteShare >= 0.28;
  if (
    !analysis ||
    !analysis.lightNeutralMatteColor ||
    !isFlatColorLayeredOptions(options) ||
    (!sourceOpaqueMatte && !outputOpaqueMatte) ||
    analysis.blueFamilyShare < 0.08
  ) {
    return layers;
  }
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < layers.length; index += 1) {
    const rgb = parseHexToRgb(layers[index].color);
    if (!rgb || !isFlatColorLightNeutralMatte(rgb)) continue;
    const distance = colorDistance(rgb, analysis.lightNeutralMatteColor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  if (bestIndex < 0 || bestDistance > 32) return layers;
  const backgroundPath = `<path d="M 0 0 H ${formatNumber(width)} V ${formatNumber(height)} H 0 Z" />`;
  const backgroundLayer = {
    ...layers[bestIndex],
    pathTags: `${backgroundPath}${layers[bestIndex].pathTags}`,
  };
  return [
    backgroundLayer,
    ...layers.slice(0, bestIndex),
    ...layers.slice(bestIndex + 1),
  ];
}

function applyFocusedFlatColorDetailMatte(
  layers: TraceLayerBuildItem[],
  analysis: FlatColorPaletteAnalysis | null,
  options: NormalizedLayeredColorSvgOptions,
  bounds: SvgPathBounds,
  width: number,
  height: number,
) {
  if (!analysis || !isFlatColorLayeredOptions(options) || layers.length >= 32) {
    return layers;
  }

  const boundsWidth = Math.max(0, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(0, bounds.maxY - bounds.minY);
  const boundsShare = (boundsWidth * boundsHeight) / Math.max(1, width * height);
  if (
    boundsShare < 0.2 ||
    boundsShare > 0.72 ||
    analysis.blueFamilyShare < 0.08 ||
    analysis.lightNeutralShare < 0.12
  ) {
    return layers;
  }

  const baseMatteColor = chooseFocusedDetailMatteColor(layers);
  if (!baseMatteColor) return layers;
  const matteColor = makeUniqueFocusedDetailMatteColor(baseMatteColor, layers);

  const inset = clampLayerNumber(Math.min(width, height) * 0.014, 10, 22);
  const x1 = Math.max(0, Math.round(bounds.minX + inset));
  const y1 = Math.max(0, Math.round(bounds.minY + inset));
  const x2 = Math.min(width, Math.round(bounds.maxX - inset));
  const y2 = Math.min(height, Math.round(bounds.maxY - inset));
  if (x2 - x1 < 80 || y2 - y1 < 80) return layers;

  // A single back-layer fill prevents optimized card interiors from looking
  // transparent without bringing back thousands of neutral texture islands.
  const mattePath = `<path d="M ${formatNumber(x1)} ${formatNumber(y1)} H ${formatNumber(x2)} V ${formatNumber(y2)} H ${formatNumber(x1)} Z" />`;
  return [
    {
      id: sanitizeLayerId(`layer-detail-matte-${matteColor.replace("#", "")}`),
      label: "Detail base",
      color: matteColor,
      pixelPercent: 0,
      pathTags: mattePath,
    },
    ...layers,
  ];
}

function chooseFocusedDetailMatteColor(layers: TraceLayerBuildItem[]) {
  let bestColor: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const layer of layers) {
    const rgb = parseHexToRgb(layer.color);
    if (!rgb) continue;
    const lum = luminance(rgb);
    const saturation = colorSaturation(rgb);
    const hue = rgbHueDegrees(rgb);
    const yellowOrange = hue >= 28 && hue <= 78 && saturation >= 45;
    if (yellowOrange || lum < 160 || lum > 242 || saturation > 92) continue;
    const blueNeutralBonus =
      hue >= 165 && hue <= 235 ? 32 : hue >= 135 && hue <= 255 ? 18 : 0;
    const score =
      blueNeutralBonus +
      layer.pixelPercent * 0.6 -
      Math.abs(lum - 205) * 0.18 -
      Math.max(0, saturation - 42) * 0.12;
    if (score > bestScore) {
      bestScore = score;
      bestColor = layer.color;
    }
  }
  return bestColor;
}

function makeUniqueFocusedDetailMatteColor(
  color: string,
  layers: TraceLayerBuildItem[],
) {
  const usedColors = new Set(layers.map((layer) => layer.color.toLowerCase()));
  const normalized = sanitizeLayerHexColor(color, "#ccd7d9");
  if (!usedColors.has(normalized)) return normalized;
  const rgb = parseHexToRgb(normalized);
  if (!rgb) return normalized;
  for (let delta = 1; delta <= 12; delta += 1) {
    const candidate = rgbObjectToHex({
      r: rgb.r - delta,
      g: rgb.g,
      b: rgb.b + delta,
    });
    if (!usedColors.has(candidate)) return candidate;
  }
  return normalized;
}

function orderFlatColorLayersForVisualStack(layers: TraceLayerBuildItem[]) {
  return [...layers].sort((a, b) => {
    const aRgb = parseHexToRgb(a.color);
    const bRgb = parseHexToRgb(b.color);
    if (!aRgb || !bRgb) return 0;
    const lumDiff = luminance(bRgb) - luminance(aRgb);
    if (Math.abs(lumDiff) > 8) return lumDiff;
    return b.pixelPercent - a.pixelPercent;
  });
}

function flatColorFamily(color: RGB): FlatColorFamily {
  const lum = luminance(color);
  const sat = colorSaturation(color);
  if (lum < 42) return "dark";
  if (lum > 238 && sat <= 24) return "lightNeutral";
  if (sat <= 34) return lum > 190 ? "lightNeutral" : "neutral";
  const hue = rgbHueDegrees(color);
  if (hue < 18 || hue >= 342) return "red";
  if (hue < 48) return "orange";
  if (hue < 72) return "yellow";
  if (hue < 155) return "green";
  if (hue < 190) return "cyan";
  if (hue < 255) return "blue";
  if (hue < 292) return "purple";
  return "pink";
}

function isFlatColorLightNeutralMatte(color: RGB) {
  const lum = luminance(color);
  return lum >= 214 && colorSaturation(color) <= 34;
}

function rgbHueDegrees(color: RGB) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta <= 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
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
  sourceWidth,
  sourceHeight,
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
  sourceWidth?: number;
  sourceHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  preserveAspectRatio?: boolean;
}): string {
  const outputBasisWidth = sourceWidth && sourceWidth > 0 ? sourceWidth : width;
  const outputBasisHeight = sourceHeight && sourceHeight > 0 ? sourceHeight : height;
  const outputDimensions = resolveOutputDimensions(
    {
      outputWidth: outputWidth ?? 0,
      outputHeight: outputHeight ?? 0,
      preserveAspectRatio: preserveAspectRatio !== false,
    },
    outputBasisWidth,
    outputBasisHeight,
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
  const strokeUseTags: string[] = [];
  const preparedLayers = layers.map((layer) => {
      const fill = sanitizeLayerHexColor(layer.color, "#000000");
      const safeId = escapeXmlAttr(layer.id);
      const safeLabel = escapeXmlAttr(layer.label);
      const pathTags =
        safeFillStrokeWidth > 0
          ? prepareFillStrokeReferencePathTags(layer.pathTags, safeId, {
              width,
              height,
              strokeUseTags,
            })
          : layer.pathTags;
      return { fill, safeId, safeLabel, pathTags };
    });
  const body = preparedLayers
    .map(
      (layer) =>
        `<g id="${layer.safeId}" data-layer-id="${layer.safeId}" data-layer-label="${layer.safeLabel}" data-layer-color="${layer.fill}" fill="${layer.fill}"${groupOpacity}>${layer.pathTags}</g>`,
    )
    .join("");
  const strokeBody =
    safeFillStrokeWidth > 0 && strokeUseTags.length > 0
      ? `<g id="fill-stroke-outline" data-layer-id="fill-stroke-outline" data-layer-label="Stroke outline" data-layer-color="${safeFillStrokeColor}" fill="none" stroke="${safeFillStrokeColor}" stroke-width="${formatNumber(
          safeFillStrokeWidth,
        )}" stroke-linecap="round" stroke-linejoin="round">${strokeUseTags.join("")}</g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputDimensions.width}" height="${outputDimensions.height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from image">${background}${body}${strokeBody}</svg>`;
}

function prepareFillStrokeReferencePathTags(
  pathTags: string,
  layerId: string,
  options: {
    width: number;
    height: number;
    strokeUseTags: string[];
  },
): string {
  let drawablePathIndex = 0;
  return String(pathTags || "").replace(
    /<path\b([^>]*?)(\s*\/?)>/gi,
    (match, attrs = "", close = "") => {
      const rawAttrs = String(attrs || "");
      const closeToken = String(close || "").includes("/") ? " />" : ">";
      const pathCandidate = `<path${rawAttrs}${closeToken}`;
      const strokeCandidate = filterFillStrokePathTags(pathCandidate, {
        width: options.width,
        height: options.height,
      });
      if (!strokeCandidate.trim()) return match;

      drawablePathIndex += 1;
      const id = `${layerId}-path-${drawablePathIndex}`;
      const nextAttrs = rawAttrs.replace(/\sid\s*=\s*["'][^"']*["']/gi, "");
      options.strokeUseTags.push(`<use href="#${escapeXmlAttr(id)}" />`);
      return `<path id="${escapeXmlAttr(id)}"${nextAttrs}${closeToken}`;
    },
  );
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

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
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
