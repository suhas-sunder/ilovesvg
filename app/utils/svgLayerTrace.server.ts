import * as serverVTracerRuntime from "wasm_vtracer";
import {
  getSharp,
  traceBitmapToSvg as traceBitmapToSvgWithPotrace,
} from "./conversionModules.server";
import {
  createConversionDiagnostics,
  endTimer,
  finishConversionDiagnostics,
  maybeLogConversionDiagnostics,
  startTimer,
  withTimer,
  type ConversionDiagnostics,
} from "./conversionDiagnostics.server";
import { sanitizeSvgMarkup } from "./svgSanitize.server";
import {
  resolveOutputDimensions,
  type SortLayersBy,
} from "./converterSettings.server";
import {
  MAX_OUTPUT_SVG_BYTES,
  MAX_SVG_PATH_COMMANDS,
} from "./backendSecurity.server";
import { filterFillStrokePathTags } from "~/shared/tracing/fillStrokeSvg";
import { clampSvgPathDataPrecision } from "~/shared/tracing/svgPathPrecision";
import {
  optimizeLayeredSvgPathStructure,
  resolveLayeredSvgStructureOptimizationOptions,
} from "~/shared/tracing/svgPathStructureOptimizer";
import {
  isLayeredQualityTierPresetId,
  normalizeLayeredQualityTier,
  type LayeredQualityTier,
} from "~/shared/tracing/layeredQualityTier";
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

type LayeredColorSvgResult = {
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
  engineUsed?: "vtracer" | "potrace";
  warnings?: string[];
  timings?: Record<string, number>;
  diagnostics?: ConversionDiagnostics;
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
  layeredQualityTier?: LayeredQualityTier;
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
  layeredQualityTier: LayeredQualityTier;
};

export const MIN_LAYER_COUNT = 2;
export const MAX_LAYER_COUNT = 40;
export const MAX_TRACE_SIDE_DEFAULT = 1600;
export const MAX_TRACE_SIDE = 3000;
const MIN_TRACE_DIMENSION = 2;
const GENERATED_LAYERED_PATH_PRECISION = 0;
const COMPACT_VTRACER_MAX_EDITABLE_COLORS = 32;
const COMPACT_VTRACER_DARK_DETAIL_LUMA = 70;
const COMPACT_VTRACER_DARK_SNAP_LUMA = 85;
const COMPACT_VTRACER_DARK_COLOR: RGB = { r: 24, g: 24, b: 22 };
const COMPACT_VTRACER_SOFT_DARK_DETAIL_COLOR: RGB = { r: 28, g: 28, b: 25 };
const COMPACT_VTRACER_SOFT_EDGE_DETAIL_COLOR: RGB = { r: 58, g: 56, b: 50 };
const COMPACT_VTRACER_GLARE_DETAIL_COLOR: RGB = { r: 78, g: 76, b: 70 };
const COMPACT_VTRACER_AMAZING_MAX_SVG_BYTES = 12 * 1024 * 1024;
const COMPACT_VTRACER_AMAZING_MAX_PATH_COMMANDS = 560_000;

type CompactLayeredVTracerQualityOptions = {
  filterSpeckle: number;
  colorPrecision: number;
  cornerThreshold: number;
  layerDifference: number;
  lengthThreshold: number;
  pathSimplifyMode: "spline" | "none";
  maxIterations: number;
  spliceThreshold: number;
  pathPrecision: number;
  svgCoordinatePrecision: number;
  sourceConstrainedDetail: boolean;
  detailNeighborhoodRadius: number;
  detailBoundsPaddingRatio: number;
  darkPaletteSnapLuma: number;
  protectChromaticDarkColors: boolean;
  darkDetailLuma: number;
  darkDetailVeryDarkLuma: number;
  darkDetailContrast: number;
  darkDetailMinPixels: number;
  darkDetailMaxShare: number;
  darkDetailMinComponentArea: number;
  darkDetailMaxComponentShare: number;
  darkDetailTurdSize: number;
  darkDetailOptTolerance: number;
  darkDetailMedianSize: number;
  edgeGradient: number;
  edgeDarkLuma: number;
  edgeContrast: number;
  edgeMinPixels: number;
  edgeMaxShare: number;
  edgeMinComponentArea: number;
  edgeMaxComponentShare: number;
  edgeTurdSize: number;
  edgeOptTolerance: number;
  glareDetailRecovery: boolean;
  glareDetailLuma: number;
  glareDetailContrast: number;
  glareDetailMaxSaturation: number;
  textureGuardSaturation: number;
  textureGuardContrastScale: number;
};

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

function withLayeredDiagnostics<T extends LayeredColorSvgResult>(
  result: T,
  diagnostics: ReturnType<typeof createConversionDiagnostics>,
): T {
  const finished = finishConversionDiagnostics(diagnostics);
  if (!finished) return result;
  return {
    ...result,
    warnings: finished.warnings,
    timings: finished.timings,
    diagnostics: finished,
  };
}

export function sanitizeLayerHexColor(input: string, fallback = "#000000") {
  const value = String(input || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return fallback;
}

function shouldUseCompactFlatColorVTracer(
  options: NormalizedLayeredColorSvgOptions,
  sourceMatte: FlatColorSourceMatteAnalysis | null,
) {
  const isQualityTierPreset =
    options.layeredQualityTier !== "default" &&
    isLayeredQualityTierPresetId(options.presetId);
  return (
    (options.presetId === "layered-flat-color" || isQualityTierPreset) &&
    options.transparent &&
    !options.removeWhite &&
    (sourceMatte?.transparentShare ?? 0) <= 0.0025
  );
}

function compactLayeredVTracerQualityOptions(
  tier: LayeredQualityTier,
  presetId?: string,
): CompactLayeredVTracerQualityOptions {
  let options: CompactLayeredVTracerQualityOptions;
  if (tier === "amazing") {
    options = {
      filterSpeckle: 20,
      colorPrecision: 8,
      cornerThreshold: 48,
      layerDifference: 12,
      lengthThreshold: 4.6,
      pathSimplifyMode: "spline",
      maxIterations: 14,
      spliceThreshold: 32,
      pathPrecision: 2,
      svgCoordinatePrecision: 0,
      sourceConstrainedDetail: true,
      detailNeighborhoodRadius: 8,
      detailBoundsPaddingRatio: 0.026,
      darkPaletteSnapLuma: 44,
      protectChromaticDarkColors: true,
      darkDetailLuma: 126,
      darkDetailVeryDarkLuma: 74,
      darkDetailContrast: 18,
      darkDetailMinPixels: 48,
      darkDetailMaxShare: 0.082,
      darkDetailMinComponentArea: 6,
      darkDetailMaxComponentShare: 0.018,
      darkDetailTurdSize: 1,
      darkDetailOptTolerance: 0.38,
      darkDetailMedianSize: 0,
      edgeGradient: 46,
      edgeDarkLuma: 132,
      edgeContrast: 36,
      edgeMinPixels: 70,
      edgeMaxShare: 0.045,
      edgeMinComponentArea: 1,
      edgeMaxComponentShare: 0.015,
      edgeTurdSize: 4,
      edgeOptTolerance: 0.85,
      glareDetailRecovery: true,
      glareDetailLuma: 164,
      glareDetailContrast: 52,
      glareDetailMaxSaturation: 56,
      textureGuardSaturation: 50,
      textureGuardContrastScale: 1.75,
    };
  } else if (tier === "high") {
    options = {
      filterSpeckle: 32,
      colorPrecision: 8,
      cornerThreshold: 60,
      layerDifference: 18,
      lengthThreshold: 5.2,
      pathSimplifyMode: "spline",
      maxIterations: 12,
      spliceThreshold: 36,
      pathPrecision: 2,
      svgCoordinatePrecision: 0,
      sourceConstrainedDetail: true,
      detailNeighborhoodRadius: 4,
      detailBoundsPaddingRatio: 0.055,
      darkPaletteSnapLuma: 62,
      protectChromaticDarkColors: false,
      darkDetailLuma: 100,
      darkDetailVeryDarkLuma: 62,
      darkDetailContrast: 24,
      darkDetailMinPixels: 100,
      darkDetailMaxShare: 0.075,
      darkDetailMinComponentArea: 2,
      darkDetailMaxComponentShare: 0.026,
      darkDetailTurdSize: 3,
      darkDetailOptTolerance: 0.75,
      darkDetailMedianSize: 0,
      edgeGradient: 56,
      edgeDarkLuma: 100,
      edgeContrast: 54,
      edgeMinPixels: 120,
      edgeMaxShare: 0.032,
      edgeMinComponentArea: 2,
      edgeMaxComponentShare: 0.014,
      edgeTurdSize: 10,
      edgeOptTolerance: 1.45,
      glareDetailRecovery: false,
      glareDetailLuma: 0,
      glareDetailContrast: 0,
      glareDetailMaxSaturation: 0,
      textureGuardSaturation: 72,
      textureGuardContrastScale: 1.2,
    };
  } else if (tier === "medium") {
    options = {
      filterSpeckle: 50,
      colorPrecision: 8,
      cornerThreshold: 60,
      layerDifference: 24,
      lengthThreshold: 6.8,
      pathSimplifyMode: "spline",
      maxIterations: 10,
      spliceThreshold: 40,
      pathPrecision: 1,
      svgCoordinatePrecision: 0,
      sourceConstrainedDetail: true,
      detailNeighborhoodRadius: 4,
      detailBoundsPaddingRatio: 0.055,
      darkPaletteSnapLuma: 60,
      protectChromaticDarkColors: false,
      darkDetailLuma: 96,
      darkDetailVeryDarkLuma: 60,
      darkDetailContrast: 26,
      darkDetailMinPixels: 120,
      darkDetailMaxShare: 0.068,
      darkDetailMinComponentArea: 3,
      darkDetailMaxComponentShare: 0.022,
      darkDetailTurdSize: 6,
      darkDetailOptTolerance: 1.05,
      darkDetailMedianSize: 0,
      edgeGradient: 60,
      edgeDarkLuma: 96,
      edgeContrast: 58,
      edgeMinPixels: 190,
      edgeMaxShare: 0.028,
      edgeMinComponentArea: 3,
      edgeMaxComponentShare: 0.011,
      edgeTurdSize: 18,
      edgeOptTolerance: 2.2,
      glareDetailRecovery: false,
      glareDetailLuma: 0,
      glareDetailContrast: 0,
      glareDetailMaxSaturation: 0,
      textureGuardSaturation: 72,
      textureGuardContrastScale: 1.2,
    };
  } else {
    options = {
      filterSpeckle: 65,
      colorPrecision: 7,
      cornerThreshold: 60,
      layerDifference: 32,
      lengthThreshold: 9,
      pathSimplifyMode: "spline",
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 1,
      svgCoordinatePrecision: 0,
      sourceConstrainedDetail: false,
      detailNeighborhoodRadius: 4,
      detailBoundsPaddingRatio: 0.055,
      darkPaletteSnapLuma: COMPACT_VTRACER_DARK_SNAP_LUMA,
      protectChromaticDarkColors: false,
      darkDetailLuma: COMPACT_VTRACER_DARK_DETAIL_LUMA,
      darkDetailVeryDarkLuma: 42,
      darkDetailContrast: 46,
      darkDetailMinPixels: 120,
      darkDetailMaxShare: 0.12,
      darkDetailMinComponentArea: 1,
      darkDetailMaxComponentShare: 0.12,
      darkDetailTurdSize: 12,
      darkDetailOptTolerance: 1.6,
      darkDetailMedianSize: 0,
      edgeGradient: 70,
      edgeDarkLuma: 255,
      edgeContrast: 0,
      edgeMinPixels: 200,
      edgeMaxShare: 0.05,
      edgeMinComponentArea: 1,
      edgeMaxComponentShare: 0.05,
      edgeTurdSize: 48,
      edgeOptTolerance: 4,
      glareDetailRecovery: false,
      glareDetailLuma: 0,
      glareDetailContrast: 0,
      glareDetailMaxSaturation: 0,
      textureGuardSaturation: 72,
      textureGuardContrastScale: 1.2,
    };
  }
  return applyCompactLayeredVTracerFamilyOptions(options, tier, presetId);
}

function applyCompactLayeredVTracerFamilyOptions(
  options: CompactLayeredVTracerQualityOptions,
  tier: LayeredQualityTier,
  presetId?: string,
): CompactLayeredVTracerQualityOptions {
  const id = String(presetId || "").toLowerCase();
  if (tier === "default") return options;
  if (id.startsWith("layered-flat-color")) {
    if (tier === "amazing") {
      return {
        ...options,
        darkDetailLuma: Math.min(134, options.darkDetailLuma + 5),
        darkDetailVeryDarkLuma: Math.min(
          84,
          options.darkDetailVeryDarkLuma + 6,
        ),
        darkDetailContrast: Math.max(17, options.darkDetailContrast - 3),
        darkDetailMinComponentArea: Math.max(
          1,
          options.darkDetailMinComponentArea - 1,
        ),
        darkDetailMaxShare: Math.min(0.08, options.darkDetailMaxShare),
        darkDetailMaxComponentShare: Math.min(
          0.017,
          options.darkDetailMaxComponentShare,
        ),
        edgeGradient: Math.max(46, options.edgeGradient),
        edgeMaxShare: Math.min(0.043, options.edgeMaxShare),
        edgeMaxComponentShare: Math.min(0.014, options.edgeMaxComponentShare),
        edgeTurdSize: Math.max(4, options.edgeTurdSize),
        edgeOptTolerance: Math.max(0.72, options.edgeOptTolerance - 0.08),
        glareDetailLuma: Math.min(170, options.glareDetailLuma + 5),
        glareDetailContrast: Math.max(50, options.glareDetailContrast - 3),
      };
    }
    return options;
  }
  if (id.startsWith("photo-many-colors")) {
    if (tier === "amazing") {
      return {
        ...options,
        darkDetailLuma: Math.min(132, options.darkDetailLuma + 4),
        darkDetailVeryDarkLuma: Math.min(
          84,
          options.darkDetailVeryDarkLuma + 5,
        ),
        darkDetailContrast: Math.max(18, options.darkDetailContrast - 2),
        darkDetailMaxShare: Math.min(0.08, options.darkDetailMaxShare),
        darkDetailMaxComponentShare: Math.min(
          0.017,
          options.darkDetailMaxComponentShare,
        ),
        edgeDarkLuma: Math.max(116, options.edgeDarkLuma),
        edgeGradient: Math.max(46, options.edgeGradient),
        edgeMaxShare: Math.min(0.043, options.edgeMaxShare),
        edgeMaxComponentShare: Math.min(0.014, options.edgeMaxComponentShare),
        edgeTurdSize: Math.max(4, options.edgeTurdSize),
        glareDetailLuma: Math.min(168, options.glareDetailLuma + 4),
      };
    }
    if (tier === "high") {
      return {
        ...options,
        darkDetailLuma: Math.min(104, options.darkDetailLuma + 4),
        darkDetailVeryDarkLuma: Math.min(66, options.darkDetailVeryDarkLuma + 4),
        darkDetailContrast: Math.max(21, options.darkDetailContrast - 2),
        edgeGradient: Math.max(54, options.edgeGradient - 2),
        edgeMaxShare: Math.min(0.034, options.edgeMaxShare + 0.002),
      };
    }
    if (tier === "medium") {
      return {
        ...options,
        darkDetailLuma: Math.min(103, options.darkDetailLuma + 3),
        darkDetailVeryDarkLuma: Math.min(65, options.darkDetailVeryDarkLuma + 3),
        darkDetailContrast: Math.max(22, options.darkDetailContrast - 1),
        edgeGradient: Math.max(54, options.edgeGradient - 1),
        edgeMaxShare: Math.min(0.034, options.edgeMaxShare + 0.0015),
      };
    }
    return options;
  }
  if (id.startsWith("layered-detail") || id === "layered-insane-quality") {
    if (tier === "amazing") {
      return {
        ...options,
        darkDetailLuma: Math.min(134, options.darkDetailLuma + 5),
        darkDetailVeryDarkLuma: Math.min(
          84,
          options.darkDetailVeryDarkLuma + 6,
        ),
        darkDetailContrast: Math.max(17, options.darkDetailContrast - 3),
        darkDetailMinComponentArea: Math.max(1, options.darkDetailMinComponentArea - 1),
        darkDetailMaxShare: Math.min(0.08, options.darkDetailMaxShare),
        darkDetailMaxComponentShare: Math.min(
          0.017,
          options.darkDetailMaxComponentShare,
        ),
        edgeGradient: Math.max(46, options.edgeGradient),
        edgeMaxShare: Math.min(0.043, options.edgeMaxShare),
        edgeMaxComponentShare: Math.min(0.014, options.edgeMaxComponentShare),
        edgeTurdSize: Math.max(4, options.edgeTurdSize),
        glareDetailLuma: Math.min(170, options.glareDetailLuma + 5),
        glareDetailContrast: Math.max(50, options.glareDetailContrast - 3),
      };
    }
    return {
      ...options,
      darkDetailLuma: Math.min(103, options.darkDetailLuma + 3),
      darkDetailVeryDarkLuma: Math.min(65, options.darkDetailVeryDarkLuma + 3),
      darkDetailContrast: Math.max(21, options.darkDetailContrast - 2),
      darkDetailMinComponentArea: Math.max(1, options.darkDetailMinComponentArea - 1),
      edgeGradient: Math.max(53, options.edgeGradient - 2),
      edgeMaxShare: Math.min(0.035, options.edgeMaxShare + 0.002),
      edgeTurdSize: Math.max(8, options.edgeTurdSize - 2),
    };
  }
  if (id.startsWith("filled-layers-separate-colors")) {
    if (tier === "amazing") {
      return {
        ...options,
        pathPrecision: Math.max(options.pathPrecision, 2),
        darkDetailLuma: Math.min(130, options.darkDetailLuma + 2),
        darkDetailVeryDarkLuma: Math.min(78, options.darkDetailVeryDarkLuma + 2),
        edgeGradient: Math.max(46, options.edgeGradient),
        edgeMaxShare: Math.min(0.043, options.edgeMaxShare),
        glareDetailLuma: Math.min(166, options.glareDetailLuma + 2),
      };
    }
    if (tier === "medium") {
      return {
        ...options,
        pathPrecision: Math.max(options.pathPrecision, 2),
        darkDetailOptTolerance: options.darkDetailOptTolerance + 0.04,
        edgeOptTolerance: options.edgeOptTolerance + 0.04,
      };
    }
    return {
      ...options,
      darkDetailLuma: Math.min(101, options.darkDetailLuma + 1),
      darkDetailVeryDarkLuma: Math.min(63, options.darkDetailVeryDarkLuma + 1),
      edgeGradient: Math.max(55, options.edgeGradient - 0.5),
      edgeMaxShare: Math.min(0.033, options.edgeMaxShare + 0.001),
    };
  }
  return options;
}

async function createCompactFlatColorVTracerSvg({
  raw,
  width,
  height,
  sourceWidth,
  sourceHeight,
  options,
  diagnostics,
  sharp,
}: {
  raw: Buffer;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  options: NormalizedLayeredColorSvgOptions;
  diagnostics: ReturnType<typeof createConversionDiagnostics>;
  sharp: typeof import("sharp");
}): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: SvgLayerMeta[];
  engineUsed: "vtracer";
}> {
  const qualityOptions = compactLayeredVTracerQualityOptions(
    options.layeredQualityTier,
    options.presetId,
  );
  const config = new serverVTracerRuntime.TracerConfig();
  try {
    config.setColorMode(serverVTracerRuntime.ColorMode.Color);
    config.setHierarchical(serverVTracerRuntime.Hierarchical.Cutout);
    config.setPathSimplifyMode(
      qualityOptions.pathSimplifyMode === "none"
        ? serverVTracerRuntime.PathSimplifyMode.None
        : serverVTracerRuntime.PathSimplifyMode.Spline,
    );
    config.setFilterSpeckle(qualityOptions.filterSpeckle);
    config.setColorPrecision(qualityOptions.colorPrecision);
    config.setLayerDifference(qualityOptions.layerDifference);
    config.setCornerThreshold(qualityOptions.cornerThreshold);
    config.setLengthThreshold(qualityOptions.lengthThreshold);
    config.setMaxIterations(qualityOptions.maxIterations);
    config.setSpliceThreshold(qualityOptions.spliceThreshold);
    config.setPathPrecision(qualityOptions.pathPrecision);

    const rawSvg = withSynchronousTimer(
      diagnostics,
      "compactVTracerCore",
      () =>
        serverVTracerRuntime.convertImageToSvg(
          new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength),
          width,
          height,
          config,
        ),
    );
    const outputDimensions = resolveOutputDimensions(
      {
        outputWidth: options.outputWidth,
        outputHeight: options.outputHeight,
        preserveAspectRatio: options.preserveAspectRatio,
      },
      sourceWidth > 0 ? sourceWidth : width,
      sourceHeight > 0 ? sourceHeight : height,
    );
    const svg = withSynchronousTimer(
      diagnostics,
      "compactNormalizeSvg",
      () =>
        normalizeCompactVTracerSvg(rawSvg, {
          width,
          height,
          outputWidth: outputDimensions.width,
          outputHeight: outputDimensions.height,
          coordinatePrecision: qualityOptions.svgCoordinatePrecision,
        }),
    );
    const darkDetailPaths = await withTimer(
      diagnostics,
      "compactDarkDetailOverlay",
      () =>
        createCompactVTracerDarkDetailOverlayPaths({
          raw,
          width,
          height,
          sharp,
          qualityOptions,
          overlayMode: "dark",
        }),
    );
    const glareDetailPaths = await withTimer(
      diagnostics,
      "compactGlareDetailOverlay",
      () =>
        createCompactVTracerDarkDetailOverlayPaths({
          raw,
          width,
          height,
          sharp,
          qualityOptions,
          overlayMode: "glare",
        }),
    );
    const edgeDetailPaths = await withTimer(
      diagnostics,
      "compactEdgeDetailOverlay",
      () =>
        createCompactVTracerEdgeOverlayPaths({
          raw,
          width,
          height,
          sharp,
          qualityOptions,
        }),
    );
    const detailOverlayPaths = `${darkDetailPaths}${glareDetailPaths}${edgeDetailPaths}`;
    const protectedOverlayColorCount =
      qualityOptions.protectChromaticDarkColors
        ? countDistinctPathFills(detailOverlayPaths)
        : 1;
    const paletteLimitedSvg = withSynchronousTimer(
      diagnostics,
      "compactPaletteSnap",
      () =>
        snapCompactVTracerPalette(
          svg,
          qualityOptions.sourceConstrainedDetail
            ? COMPACT_VTRACER_MAX_EDITABLE_COLORS -
                clampInt(protectedOverlayColorCount, 1, 4)
            : COMPACT_VTRACER_MAX_EDITABLE_COLORS,
          {
            darkSnapLuma: qualityOptions.sourceConstrainedDetail
              ? qualityOptions.darkPaletteSnapLuma
              : COMPACT_VTRACER_DARK_SNAP_LUMA,
            protectChromaticDarkColors:
              qualityOptions.protectChromaticDarkColors,
            veryDarkLuma: qualityOptions.darkDetailVeryDarkLuma,
          },
        ),
    );
    const grouped = withSynchronousTimer(
      diagnostics,
      "compactGroupByFill",
      () =>
        groupCompactVTracerSvgByFill(
          appendSvgPaths(paletteLimitedSvg, detailOverlayPaths),
        ),
    );
    const sanitized = withSynchronousTimer(
      diagnostics,
      "compactSanitizeSvg",
      () =>
        sanitizeSvgMarkup(
          grouped.svg,
          qualityOptions.sourceConstrainedDetail
            ? {
                maxBytes:
                  options.layeredQualityTier === "amazing"
                    ? COMPACT_VTRACER_AMAZING_MAX_SVG_BYTES
                    : MAX_OUTPUT_SVG_BYTES,
                maxPathCommands:
                  options.layeredQualityTier === "amazing"
                    ? COMPACT_VTRACER_AMAZING_MAX_PATH_COMMANDS
                    : MAX_SVG_PATH_COMMANDS,
              }
            : undefined,
        ),
    );
    if (!sanitized.ok) {
      throw new Error(sanitized.message);
    }
    diagnostics.finalSvgBytes = Buffer.byteLength(sanitized.svg, "utf8");
    diagnostics.pathCount = countSvgPaths(sanitized.svg);
    diagnostics.layerCount = grouped.layers.length;
    return {
      svg: sanitized.svg,
      width: outputDimensions.width,
      height: outputDimensions.height,
      layers: grouped.layers,
      engineUsed: "vtracer",
    };
  } finally {
    config.free();
  }
}

function normalizeCompactVTracerSvg(
  rawSvg: string,
  dimensions: {
    width: number;
    height: number;
    outputWidth: number;
    outputHeight: number;
    coordinatePrecision?: number;
  },
) {
  let svg = String(rawSvg || "")
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<!--[\s\S]*?-->\s*/g, "");
  svg = svg.replace(/<svg\b([^>]*)>/i, (_match, attrs = "") => {
    const next = String(attrs)
      .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sviewBox\s*=\s*["'][^"']*["']/gi, "")
      .trim();
    const extra = next ? ` ${next}` : "";
    return `<svg${extra} width="${dimensions.outputWidth}" height="${dimensions.outputHeight}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" role="img" aria-label="Layered SVG from image">`;
  });
  return roundSvgDecimalNumbers(svg, dimensions.coordinatePrecision ?? 0)
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();
}

function roundSvgDecimalNumbers(markup: string, precision: number) {
  const safePrecision = clampInt(precision, 0, 3);
  return String(markup || "").replace(
    /-?\d*\.\d+(?:e[-+]?\d+)?/gi,
    (match) => formatCompactSvgNumber(Number(match), safePrecision),
  );
}

function formatCompactSvgNumber(value: number, precision: number) {
  if (!Number.isFinite(value)) return "0";
  if (precision <= 0) return String(Math.round(value));
  const rounded = Number(value.toFixed(precision));
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

function countDistinctPathFills(markup: string) {
  const colors = new Set<string>();
  for (const match of String(markup || "").matchAll(
    /\bfill\s*=\s*["'](#[0-9a-fA-F]{6})["']/gi,
  )) {
    colors.add(match[1].toLowerCase());
  }
  return colors.size;
}

function snapCompactVTracerPalette(
  svg: string,
  maxColors: number,
  options: {
    darkSnapLuma?: number;
    protectChromaticDarkColors?: boolean;
    veryDarkLuma?: number;
  } = {},
) {
  const samples: RGB[] = [];
  let hasDarkDetail = false;
  const darkSnapLuma = Number.isFinite(options.darkSnapLuma)
    ? Number(options.darkSnapLuma)
    : COMPACT_VTRACER_DARK_SNAP_LUMA;
  const darkSnapOptions = {
    darkSnapLuma,
    protectChromaticDarkColors: Boolean(options.protectChromaticDarkColors),
    veryDarkLuma: Number.isFinite(options.veryDarkLuma)
      ? Number(options.veryDarkLuma)
      : COMPACT_VTRACER_DARK_DETAIL_LUMA,
  };

  for (const match of String(svg).matchAll(/<path\b[^>]*>/gi)) {
    const tag = match[0];
    const fill = tag.match(/\bfill\s*=\s*["'](#[0-9a-fA-F]{6})["']/i)?.[1];
    const color = fill ? parseHexToRgb(fill) : null;
    if (!color) continue;
    const normalized =
      darkSnapOptions.protectChromaticDarkColors ||
      !shouldSnapCompactVTracerColorToDark(color, darkSnapOptions)
        ? color
        : COMPACT_VTRACER_DARK_COLOR;
    hasDarkDetail ||= normalized === COMPACT_VTRACER_DARK_COLOR;
    const pathLength =
      tag.match(/\bd\s*=\s*["']([^"']*)["']/i)?.[1]?.length ?? tag.length;
    const weight = clampInt(Math.round(Math.sqrt(pathLength) / 24), 1, 18);
    for (let index = 0; index < weight && samples.length < 4096; index += 1) {
      samples.push(normalized);
    }
  }

  if (samples.length === 0) return svg;

  let palette = buildLayerPalette(
    samples,
    clampInt(maxColors, MIN_LAYER_COUNT, COMPACT_VTRACER_MAX_EDITABLE_COLORS),
  );
  if (hasDarkDetail) {
    palette = palette.filter(
      (color) => colorDistance(color, COMPACT_VTRACER_DARK_COLOR) > 8,
    );
    palette.unshift(COMPACT_VTRACER_DARK_COLOR);
    palette = palette.slice(0, maxColors);
  }

  const snapPaint = (value: string) => {
    const color = parseHexToRgb(value);
    if (!color || palette.length === 0) return value;
    const protectSourceColor = shouldProtectCompactVTracerColorFromDarkSnap(color);
    if (
      !darkSnapOptions.protectChromaticDarkColors &&
      shouldSnapCompactVTracerColorToDark(color, darkSnapOptions)
    ) {
      return rgbObjectToHex(COMPACT_VTRACER_DARK_COLOR);
    }
    const snapPalette =
      darkSnapOptions.protectChromaticDarkColors &&
      protectSourceColor
        ? palette.filter(
            (candidate) =>
              colorDistance(candidate, COMPACT_VTRACER_DARK_COLOR) > 8 &&
              luminance(candidate) >= 52,
          )
        : palette;
    const selectedPalette = snapPalette.length > 0 ? snapPalette : palette;
    const selectedColor =
      selectedPalette[nearestPaletteIndex(color, selectedPalette)];
    return rgbObjectToHex(
      darkSnapOptions.protectChromaticDarkColors
        ? liftCompactVTracerBaseDarkColor(selectedColor)
        : selectedColor,
    );
  };

  return String(svg).replace(
    /\b(fill|stroke)\s*=\s*(["'])(#[0-9a-fA-F]{6})\2/g,
    (_match, attr, quote, color) => `${attr}=${quote}${snapPaint(color)}${quote}`,
  );
}

function shouldSnapCompactVTracerColorToDark(
  color: RGB,
  options: {
    darkSnapLuma: number;
    protectChromaticDarkColors: boolean;
    veryDarkLuma: number;
  },
) {
  const luma = luminance(color);
  if (luma >= options.darkSnapLuma) return false;
  if (!options.protectChromaticDarkColors) return true;
  if (luma <= Math.min(26, options.veryDarkLuma * 0.42)) return true;
  const saturation = colorSaturation(color);
  if (saturation <= 36) return true;
  return saturation <= 50 && luma <= Math.min(40, options.veryDarkLuma * 0.58);
}

function shouldProtectCompactVTracerColorFromDarkSnap(color: RGB) {
  const luma = luminance(color);
  const saturation = colorSaturation(color);
  if (saturation >= 42) return true;
  return saturation >= 30 && luma > 38;
}

function liftCompactVTracerBaseDarkColor(color: RGB) {
  const luma = luminance(color);
  if (luma >= 52) {
    return color;
  }
  const targetLuma = 74;
  if (luma <= 0) {
    return { r: targetLuma, g: targetLuma, b: targetLuma };
  }
  const factor = targetLuma / luma;
  return {
    r: clampInt(Math.round(color.r * factor), 0, 255),
    g: clampInt(Math.round(color.g * factor), 0, 255),
    b: clampInt(Math.round(color.b * factor), 0, 255),
  };
}

async function createCompactVTracerDarkDetailOverlayPaths({
  raw,
  width,
  height,
  sharp,
  qualityOptions,
  overlayMode = "dark",
}: {
  raw: Buffer;
  width: number;
  height: number;
  sharp: typeof import("sharp");
  qualityOptions: CompactLayeredVTracerQualityOptions;
  overlayMode?: "dark" | "glare";
}) {
  const bounds = estimateFlatColorForegroundBounds(raw, width, height, {
    padRatio: qualityOptions.detailBoundsPaddingRatio,
  });
  if (!bounds) return "";

  let mask = Buffer.alloc(width * height, 255);
  let inkPixels = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      y < bounds.minY ||
      y > bounds.maxY
    ) {
      continue;
    }
    const offset = pixel * 4;
    if (raw[offset + 3] < 18) continue;
    const color = { r: raw[offset], g: raw[offset + 1], b: raw[offset + 2] };
    const supported = qualityOptions.sourceConstrainedDetail
      ? overlayMode === "glare"
        ? isSourceSupportedGlareDetailPixel({
            centerLuma: luminance(color),
            color,
            stats: localSourceDetailStats(
              raw,
              width,
              height,
              x,
              y,
              color,
              qualityOptions.detailNeighborhoodRadius,
            ),
            qualityOptions,
          })
        : isSourceSupportedDarkDetailPixel({
            raw,
            width,
            height,
            x,
            y,
            color,
            qualityOptions,
          })
      : overlayMode === "dark" && luminance(color) < qualityOptions.darkDetailLuma;
    if (!supported) continue;
    mask[pixel] = 0;
    inkPixels += 1;
  }

  let keptPixels = inkPixels;
  if (qualityOptions.darkDetailMedianSize >= 3 && inkPixels > 0) {
    mask = await denoiseCompactDetailMask({
      sharp,
      mask,
      width,
      height,
      medianSize: qualityOptions.darkDetailMedianSize,
    });
    keptPixels = countCompactDetailMaskPixels(mask);
  }
  if (qualityOptions.sourceConstrainedDetail) {
    const filtered = filterDetailMaskComponents(mask, width, height, {
      minArea:
        overlayMode === "glare"
          ? Math.max(qualityOptions.darkDetailMinComponentArea, 14)
          : qualityOptions.darkDetailMinComponentArea,
      maxAreaShare:
        overlayMode === "glare"
          ? Math.min(qualityOptions.darkDetailMaxComponentShare, 0.012)
          : qualityOptions.darkDetailMaxComponentShare,
    });
    mask = filtered.mask;
    keptPixels = filtered.keptPixels;
  }

  const share = keptPixels / Math.max(1, width * height);
  if (
    keptPixels <
      (overlayMode === "glare"
        ? Math.max(qualityOptions.darkDetailMinPixels, 90)
        : qualityOptions.darkDetailMinPixels) ||
    share >
      (overlayMode === "glare"
        ? Math.min(qualityOptions.darkDetailMaxShare, 0.045)
        : qualityOptions.darkDetailMaxShare)
  ) {
    return "";
  }

  const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  const pathTags = await traceMaskToPathTags(maskPng, {
    turdSize: qualityOptions.darkDetailTurdSize,
    optTolerance: qualityOptions.darkDetailOptTolerance,
    turnPolicy: "minority",
  });

  return applyFillToPathTags(
    String(pathTags || ""),
    rgbObjectToHex(
      overlayMode === "glare"
        ? COMPACT_VTRACER_GLARE_DETAIL_COLOR
        : qualityOptions.protectChromaticDarkColors
          ? COMPACT_VTRACER_SOFT_DARK_DETAIL_COLOR
        : COMPACT_VTRACER_DARK_COLOR,
    ),
  )
    .replace(
      /-?\d*\.\d+(?:e[-+]?\d+)?/gi,
      (match) =>
        formatCompactSvgNumber(
          Number(match),
          qualityOptions.svgCoordinatePrecision,
        ),
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function denoiseCompactDetailMask({
  sharp,
  mask,
  width,
  height,
  medianSize,
}: {
  sharp: typeof import("sharp");
  mask: Buffer;
  width: number;
  height: number;
  medianSize: number;
}) {
  const size = clampInt(medianSize, 3, 5);
  const denoised = await sharp(mask, { raw: { width, height, channels: 1 } })
    .median(size)
    .raw()
    .toBuffer();
  return Buffer.from(denoised);
}

function countCompactDetailMaskPixels(mask: Buffer) {
  let count = 0;
  for (const value of mask) {
    if (value === 0) count += 1;
  }
  return count;
}

async function createCompactVTracerEdgeOverlayPaths({
  raw,
  width,
  height,
  sharp,
  qualityOptions,
}: {
  raw: Buffer;
  width: number;
  height: number;
  sharp: typeof import("sharp");
  qualityOptions: CompactLayeredVTracerQualityOptions;
}) {
  const bounds = estimateFlatColorForegroundBounds(raw, width, height, {
    padRatio: qualityOptions.detailBoundsPaddingRatio,
  });
  if (!bounds) return "";

  let mask = Buffer.alloc(width * height, 255);
  let edgePixels = 0;
  const pixelLuma = (pixel: number) => {
    const offset = pixel * 4;
    return luminance({
      r: raw[offset],
      g: raw[offset + 1],
      b: raw[offset + 2],
    });
  };

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (
        x < bounds.minX ||
        x > bounds.maxX ||
        y < bounds.minY ||
        y > bounds.maxY
      ) {
        continue;
      }
      const pixel = y * width + x;
      const offset = pixel * 4;
      if (raw[offset + 3] < 18) continue;
      const center = pixelLuma(pixel);
      const sourceColor = {
        r: raw[offset],
        g: raw[offset + 1],
        b: raw[offset + 2],
      };
      const gradient = Math.max(
        Math.abs(center - pixelLuma(pixel - 1)),
        Math.abs(center - pixelLuma(pixel + 1)),
        Math.abs(center - pixelLuma(pixel - width)),
        Math.abs(center - pixelLuma(pixel + width)),
      );
      const supported = qualityOptions.sourceConstrainedDetail
        ? isSourceSupportedDarkEdgePixel({
            raw,
            width,
            height,
            x,
            y,
            color: sourceColor,
            centerLuma: center,
            gradient,
            qualityOptions,
          })
        : gradient >= qualityOptions.edgeGradient &&
          !(center >= 210 && colorSaturation(sourceColor) <= 36);
      if (!supported) {
        continue;
      }
      mask[pixel] = 0;
      edgePixels += 1;
    }
  }

  let keptPixels = edgePixels;
  if (qualityOptions.sourceConstrainedDetail) {
    const filtered = filterDetailMaskComponents(mask, width, height, {
      minArea: qualityOptions.edgeMinComponentArea,
      maxAreaShare: qualityOptions.edgeMaxComponentShare,
    });
    mask = filtered.mask;
    keptPixels = filtered.keptPixels;
  }

  const share = keptPixels / Math.max(1, width * height);
  if (
    keptPixels < qualityOptions.edgeMinPixels ||
    share > qualityOptions.edgeMaxShare
  ) {
    return "";
  }

  const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  const pathTags = await traceMaskToPathTags(maskPng, {
    turdSize: qualityOptions.edgeTurdSize,
    optTolerance: qualityOptions.edgeOptTolerance,
    turnPolicy: "minority",
  });

  return applyFillToPathTags(
    String(pathTags || ""),
    rgbObjectToHex(
      qualityOptions.protectChromaticDarkColors
        ? COMPACT_VTRACER_SOFT_EDGE_DETAIL_COLOR
        : COMPACT_VTRACER_DARK_COLOR,
    ),
  )
    .replace(
      /-?\d*\.\d+(?:e[-+]?\d+)?/gi,
      (match) =>
        formatCompactSvgNumber(
          Number(match),
          qualityOptions.svgCoordinatePrecision,
        ),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function isSourceSupportedDarkDetailPixel({
  raw,
  width,
  height,
  x,
  y,
  color,
  qualityOptions,
}: {
  raw: Buffer;
  width: number;
  height: number;
  x: number;
  y: number;
  color: RGB;
  qualityOptions: CompactLayeredVTracerQualityOptions;
}) {
  const centerLuma = luminance(color);
  const stats = localSourceDetailStats(
    raw,
    width,
    height,
    x,
    y,
    color,
    qualityOptions.detailNeighborhoodRadius,
  );
  if (centerLuma >= qualityOptions.darkDetailLuma) return false;
  if (isSourceSupportedNeutralTextPixel(centerLuma, color, stats, qualityOptions)) {
    return true;
  }
  if (
    centerLuma <= Math.min(52, qualityOptions.darkDetailVeryDarkLuma) &&
    colorSaturation(color) <= 68 &&
    (stats.maxLuma - centerLuma >= Math.max(46, qualityOptions.darkDetailContrast * 1.9) ||
      stats.maxDistance >= Math.max(54, qualityOptions.darkDetailContrast * 2.25))
  ) {
    return true;
  }
  if (
    isLikelyUnsupportedTextureDetail({
      centerLuma,
      color,
      stats,
      qualityOptions,
      contrast: qualityOptions.darkDetailContrast,
    })
  ) {
    return false;
  }
  if (
    colorSaturation(color) > 72 &&
    centerLuma > qualityOptions.darkDetailVeryDarkLuma &&
    stats.maxLuma - centerLuma < qualityOptions.darkDetailContrast * 1.2 &&
    stats.maxDistance < Math.max(34, qualityOptions.darkDetailContrast * 1.15)
  ) {
    return false;
  }
  if (
    centerLuma <= qualityOptions.darkDetailVeryDarkLuma &&
    stats.maxLuma - centerLuma >= Math.max(18, qualityOptions.darkDetailContrast * 0.45)
  ) {
    return true;
  }
  if (
    centerLuma < qualityOptions.darkDetailLuma * 0.82 &&
    (stats.maxLuma - centerLuma >= qualityOptions.darkDetailContrast * 0.45 ||
      stats.maxDistance >= Math.max(24, qualityOptions.darkDetailContrast * 0.65))
  ) {
    return true;
  }
  return (
    stats.maxLuma - centerLuma >= qualityOptions.darkDetailContrast &&
    stats.maxDistance >= Math.max(34, qualityOptions.darkDetailContrast * 0.85)
  );
}

function isSourceSupportedNeutralTextPixel(
  centerLuma: number,
  color: RGB,
  stats: ReturnType<typeof localSourceDetailStats>,
  qualityOptions: CompactLayeredVTracerQualityOptions,
) {
  if (!qualityOptions.glareDetailRecovery) return false;
  if (colorSaturation(color) > 46) return false;
  if (centerLuma > Math.min(118, qualityOptions.darkDetailLuma * 0.92)) {
    return false;
  }
  const localLift = stats.maxLuma - centerLuma;
  if (localLift < Math.max(22, qualityOptions.darkDetailContrast * 0.78)) {
    return false;
  }
  if (
    stats.maxDistance <
    Math.max(36, qualityOptions.darkDetailContrast * 1.08)
  ) {
    return false;
  }
  return true;
}

function isSourceSupportedGlareDetailPixel({
  centerLuma,
  color,
  stats,
  qualityOptions,
}: {
  centerLuma: number;
  color: RGB;
  stats: ReturnType<typeof localSourceDetailStats>;
  qualityOptions: CompactLayeredVTracerQualityOptions;
}) {
  if (!qualityOptions.glareDetailRecovery) return false;
  if (centerLuma >= qualityOptions.glareDetailLuma) return false;
  const saturation = colorSaturation(color);
  if (saturation > qualityOptions.glareDetailMaxSaturation) return false;
  const localLift = stats.maxLuma - centerLuma;
  const localSpan = stats.maxLuma - stats.minLuma;
  const contrast = qualityOptions.glareDetailContrast;
  if (localSpan < contrast * 0.72) return false;
  if (
    localLift < contrast &&
    stats.maxDistance < Math.max(42, contrast * 0.92)
  ) {
    return false;
  }
  if (
    isLikelyUnsupportedTextureDetail({
      centerLuma,
      color,
      stats,
      qualityOptions,
      contrast,
    })
  ) {
    return false;
  }
  return true;
}

function isSourceSupportedDarkEdgePixel({
  raw,
  width,
  height,
  x,
  y,
  color,
  centerLuma,
  gradient,
  qualityOptions,
}: {
  raw: Buffer;
  width: number;
  height: number;
  x: number;
  y: number;
  color: RGB;
  centerLuma: number;
  gradient: number;
  qualityOptions: CompactLayeredVTracerQualityOptions;
}) {
  if (gradient < qualityOptions.edgeGradient) return false;
  const stats = localSourceDetailStats(
    raw,
    width,
    height,
    x,
    y,
    color,
    qualityOptions.detailNeighborhoodRadius,
  );
  if (centerLuma >= qualityOptions.edgeDarkLuma) {
    return (
      gradient >= qualityOptions.edgeGradient * 1.35 &&
      isSourceSupportedGlareDetailPixel({
        centerLuma,
        color,
        stats,
        qualityOptions,
      })
    );
  }
  if (centerLuma >= 210 && colorSaturation(color) <= 36) return false;
  if (
    isLikelyUnsupportedTextureDetail({
      centerLuma,
      color,
      stats,
      qualityOptions,
      contrast: qualityOptions.edgeContrast,
    })
  ) {
    return false;
  }
  if (
    colorSaturation(color) > 72 &&
    centerLuma > qualityOptions.edgeDarkLuma * 0.78 &&
    stats.maxLuma - centerLuma < qualityOptions.edgeContrast * 1.35 &&
    stats.maxDistance < Math.max(56, qualityOptions.edgeContrast)
  ) {
    return false;
  }
  return (
    stats.maxLuma - centerLuma >= qualityOptions.edgeContrast ||
    stats.maxDistance >= Math.max(48, qualityOptions.edgeContrast * 0.85)
  );
}

function isLikelyUnsupportedTextureDetail({
  centerLuma,
  color,
  stats,
  qualityOptions,
  contrast,
}: {
  centerLuma: number;
  color: RGB;
  stats: ReturnType<typeof localSourceDetailStats>;
  qualityOptions: CompactLayeredVTracerQualityOptions;
  contrast: number;
}) {
  if (!qualityOptions.glareDetailRecovery) return false;
  const saturation = colorSaturation(color);
  const family = flatColorFamily(color);
  const textureProneColor =
    family === "blue" ||
    family === "cyan" ||
    family === "yellow" ||
    family === "orange" ||
    family === "green";
  const lumaLift = stats.maxLuma - centerLuma;
  const localSpan = stats.maxLuma - stats.minLuma;
  if (
    textureProneColor &&
    saturation >= Math.min(qualityOptions.textureGuardSaturation, 34) &&
    centerLuma > 38
  ) {
    if (
      lumaLift >= Math.max(58, contrast * 1.6) ||
      stats.maxDistance >= Math.max(72, contrast * 1.8)
    ) {
      return false;
    }
    return true;
  }
  if (
    centerLuma <= qualityOptions.darkDetailVeryDarkLuma &&
    saturation <= 50 &&
    stats.maxSaturation >= 72 &&
    stats.maxDistance >= Math.max(58, contrast * 1.35) &&
    lumaLift < 132
  ) {
    return true;
  }
  if (centerLuma <= qualityOptions.darkDetailVeryDarkLuma) return false;
  if (
    centerLuma > 44 &&
    saturation <= 44 &&
    stats.maxSaturation >= 72 &&
    stats.maxDistance >= Math.max(58, contrast * 1.35)
  ) {
    return true;
  }
  const weakContrast =
    lumaLift < contrast * qualityOptions.textureGuardContrastScale &&
    stats.maxDistance <
      Math.max(52, contrast * qualityOptions.textureGuardContrastScale);
  if (!weakContrast) return false;

  if (textureProneColor && saturation >= qualityOptions.textureGuardSaturation) {
    return true;
  }

  return saturation <= 42 && localSpan < contrast * 1.15;
}

function localSourceDetailStats(
  raw: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGB,
  radius = 4,
) {
  const offsets: Array<readonly [number, number]> = [
    [-2, 0],
    [-1, 0],
    [1, 0],
    [2, 0],
    [0, -2],
    [0, -1],
    [0, 1],
    [0, 2],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [-4, 0],
    [4, 0],
    [0, -4],
    [0, 4],
  ];
  if (radius >= 6) {
    offsets.push(
      [-6, 0],
      [6, 0],
      [0, -6],
      [0, 6],
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    );
  }
  if (radius >= 8) {
    offsets.push(
      [-8, 0],
      [8, 0],
      [0, -8],
      [0, 8],
      [-6, -3],
      [6, -3],
      [-6, 3],
      [6, 3],
      [-3, -6],
      [3, -6],
      [-3, 6],
      [3, 6],
    );
  }
  let maxLuma = luminance(color);
  let minLuma = maxLuma;
  let maxDistance = 0;
  let maxSaturation = colorSaturation(color);
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const pixel = ny * width + nx;
    const offset = pixel * 4;
    if (raw[offset + 3] < 18) continue;
    const neighbor = {
      r: raw[offset],
      g: raw[offset + 1],
      b: raw[offset + 2],
    };
    const luma = luminance(neighbor);
    maxLuma = Math.max(maxLuma, luma);
    minLuma = Math.min(minLuma, luma);
    maxDistance = Math.max(maxDistance, colorDistance(color, neighbor));
    maxSaturation = Math.max(maxSaturation, colorSaturation(neighbor));
  }
  return { maxLuma, minLuma, maxDistance, maxSaturation };
}

function filterDetailMaskComponents(
  mask: Buffer,
  width: number,
  height: number,
  options: { minArea: number; maxAreaShare: number },
) {
  const total = width * height;
  const out = Buffer.alloc(total, 255);
  const visited = new Uint8Array(total);
  const stack: number[] = [];
  const component: number[] = [];
  const minArea = Math.max(1, Math.round(options.minArea));
  const maxArea = Math.max(minArea, Math.round(total * options.maxAreaShare));
  let keptPixels = 0;

  for (let start = 0; start < total; start += 1) {
    if (mask[start] !== 0 || visited[start]) continue;
    stack.length = 0;
    component.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      component.push(pixel);
      const x = pixel % width;
      const neighbors = [
        pixel - 1,
        pixel + 1,
        pixel - width,
        pixel + width,
      ];
      for (const next of neighbors) {
        if (next < 0 || next >= total || visited[next] || mask[next] !== 0) {
          continue;
        }
        if ((next === pixel - 1 && x === 0) || (next === pixel + 1 && x === width - 1)) {
          continue;
        }
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (component.length < minArea || component.length > maxArea) continue;
    for (const pixel of component) out[pixel] = 0;
    keptPixels += component.length;
  }

  return { mask: out, keptPixels };
}

function appendSvgPaths(svg: string, pathTags: string) {
  if (!pathTags.trim()) return svg;
  return String(svg).replace(/<\/svg>\s*$/i, `${pathTags}</svg>`);
}

function applyFillToPathTags(pathTags: string, fill: string) {
  const color = sanitizeLayerHexColor(fill, "#000000");
  return String(pathTags || "").replace(/<path\b[^>]*>/gi, (tag) => {
    if (/\sfill\s*=/i.test(tag)) {
      return tag.replace(
        /\sfill\s*=\s*(["'])#[0-9a-fA-F]{3,8}\1/gi,
        ` fill="${color}"`,
      );
    }
    return tag.replace(/\s*\/?>$/i, (ending) => {
      const close = ending.includes("/") ? " />" : ">";
      return ` fill="${color}"${close}`;
    });
  });
}

function groupCompactVTracerSvgByFill(svg: string): {
  svg: string;
  layers: SvgLayerMeta[];
} {
  const openTag = String(svg).match(/<svg\b[^>]*>/i)?.[0] || "";
  const groups = new Map<
    string,
    { id: string; label: string; color: string; pathTags: string; pathCount: number }
  >();

  for (const match of String(svg).matchAll(/<path\b[^>]*>/gi)) {
    const tag = match[0];
    const fill = sanitizeLayerHexColor(
      tag.match(/\bfill\s*=\s*["'](#[0-9a-fA-F]{3,8})["']/i)?.[1] || "",
      "",
    );
    if (!fill) continue;
    let group = groups.get(fill);
    if (!group) {
      const count = groups.size + 1;
      group = {
        id: sanitizeLayerId(`fill-${count}-${fill.replace("#", "")}`),
        label: `Fill ${count}`,
        color: fill,
        pathTags: "",
        pathCount: 0,
      };
      groups.set(fill, group);
    }
    const pathTag = tag
      .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sdata-fill-layer-id\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sdata-layer-id\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sdata-layer-color\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\s+/g, " ");
    group.pathTags += pathTag;
    group.pathCount += 1;
  }

  const darkFill = rgbObjectToHex(COMPACT_VTRACER_DARK_COLOR);
  const orderedGroups = Array.from(groups.values()).sort((a, b) => {
    if (a.color === darkFill && b.color !== darkFill) return 1;
    if (b.color === darkFill && a.color !== darkFill) return -1;
    return 0;
  });
  const layers: SvgLayerMeta[] = orderedGroups.map((group, index) => ({
    id: group.id,
    label: `Fill ${index + 1}`,
    color: group.color,
    originalColor: group.color,
    visible: true,
    pathTags: group.pathTags,
    pathCount: group.pathCount,
    kind: "fill",
  }));
  const body = orderedGroups
    .map(
      (group, index) =>
        `<g id="${group.id}" data-layer-id="${group.id}" data-layer-label="${escapeXmlAttr(
          `Fill ${index + 1}`,
        )}" data-layer-color="${group.color}" fill="${group.color}">${group.pathTags}</g>`,
    )
    .join("");
  return {
    svg: `${openTag}${body}</svg>`,
    layers,
  };
}

export async function createLayeredColorSvg(
  input: Buffer,
  opts: LayeredColorSvgOptions,
): Promise<LayeredColorSvgResult> {
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

    if (shouldUseCompactFlatColorVTracer(safeOptions, sourceMatte)) {
      const compactResult = await withTimer(
        diagnostics,
        "serverVTracerFlatColor",
        async () =>
          createCompactFlatColorVTracerSvg({
          raw: data as Buffer,
          width,
          height,
          sourceWidth: sourceDimensions.width,
          sourceHeight: sourceDimensions.height,
          options: safeOptions,
          diagnostics,
          sharp,
        }),
      );
      if (compactResult.layers.length >= 12) {
        return withLayeredDiagnostics(compactResult, diagnostics);
      }
      diagnostics.warnings = [
        ...(diagnostics.warnings || []),
        `Compact VTracer produced only ${compactResult.layers.length} editable groups; falling back to per-color layered trace.`,
      ];
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
    startTimer(diagnostics, "buildAndTraceLayerMasks");
    for (let i = 0; i < rawLayerItems.length; i++) {
      const item = rawLayerItems[i];
      const mask = withSynchronousTimer(
        diagnostics,
        `buildLayerMask${i + 1}`,
        () => {
          const nextMask = Buffer.alloc(width * height, 255);
          for (let px = 0; px < assignments.layerForPixel.length; px++) {
            if (assignments.layerForPixel[px] === item.index) {
              nextMask[px] = 0;
            }
          }
          return nextMask;
        },
      );
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
    endTimer(diagnostics, "buildAndTraceLayerMasks");

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
    const serializedLayers = withSynchronousTimer(
      diagnostics,
      "optimizeLayerPaths",
      () =>
        finalLayers.map((layer) => ({
          ...layer,
          pathTags: optimizeLayerPathTags(
            clampSvgPathDataPrecision(
              layer.pathTags,
              GENERATED_LAYERED_PATH_PRECISION,
            ),
            layer.color,
            width,
            height,
          ),
        })),
    );

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

    return withLayeredDiagnostics({
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
    }, diagnostics);
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
    layeredQualityTier: normalizeLayeredQualityTier(
      options.layeredQualityTier,
      options.presetId,
    ),
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
): string {
  if (!pathTags) return pathTags;
  const fill = sanitizeLayerHexColor(color, "#000000");
  const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><g fill="${fill}" data-layer-color="${fill}">${pathTags}</g></svg>`;
  const optimized = optimizeLayeredSvgPathStructure(
    wrappedSvg,
    resolveLayeredSvgStructureOptimizationOptions(width, height),
  );
  return extractPathTags(optimized.svg) || pathTags;
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

type FlatColorPixelBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function estimateFlatColorForegroundBounds(
  raw: Buffer,
  width: number,
  height: number,
  options: { padRatio?: number } = {},
): FlatColorPixelBounds | null {
  const total = width * height;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let matched = 0;

  for (let pixel = 0; pixel < total; pixel += 1) {
    const offset = pixel * 4;
    if (raw[offset + 3] < 18) continue;
    const color = { r: raw[offset], g: raw[offset + 1], b: raw[offset + 2] };
    const lum = luminance(color);
    const saturation = colorSaturation(color);
    if (saturation < 52 || lum < 70 || lum > 248) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    matched += 1;
  }

  if (matched / Math.max(1, total) < 0.015 || maxX < minX || maxY < minY) {
    return null;
  }

  const padRatio = Number.isFinite(options.padRatio)
    ? clampNumber(options.padRatio ?? 0.055, 0.01, 0.08)
    : 0.055;
  const pad = Math.round(Math.max(18, Math.max(width, height) * padRatio));
  const bounds = {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    maxX: Math.min(width - 1, maxX + pad),
    maxY: Math.min(height - 1, maxY + pad),
  };
  const area =
    Math.max(1, bounds.maxX - bounds.minX + 1) *
    Math.max(1, bounds.maxY - bounds.minY + 1);
  if (area / Math.max(1, total) > 0.92) return null;
  return bounds;
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
