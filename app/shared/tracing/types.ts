import type { LayeredQualityTier } from "./layeredQualityTier";

export type TraceEngine = "auto" | "vtracer" | "potrace" | "centerline";

export type TraceEngineUsed = "vtracer" | "potrace" | "centerline";

export type TraceMode = "single" | "layered";
export type StrokeOutputMode = "filled" | "centerline";

export type TraceLayerKind = "fill" | "stroke";
export type LayerBuildMode = "raw-vtracer" | "per-color-cutout" | "stacked-overlap";
export type LayerGroupBy = "none" | "color" | "layer";
export type LayerGapFill = "none" | "close-small-gaps" | "overlap";
export type PaletteAlgorithm = "image-q-wuquant" | "image-q-rgbquant" | "simple-posterize";
export type PaletteDistance = "ciede2000" | "bt709" | "rgb";

export type NormalizedTraceSettings = {
  traceMode?: TraceMode;
  engine?: TraceEngine;
  presetId?: string | null;
  presetBackendIntensity?: string | null;
  routeId?: string;
  strokeOutputMode?: StrokeOutputMode;

  lineColor?: string;
  transparent?: boolean;
  bgColor?: string;
  invert?: boolean;

  threshold?: number;
  turdSize?: number;
  optTolerance?: number;
  turnPolicy?: string;

  preprocess?: string;
  blurSigma?: number;
  edgeBoost?: number;
  maxTraceSide?: number;
  centerlineMaxTraceSide?: number;
  centerlineStrokeWidth?: number;
  centerlineSimplifyTolerance?: number;
  centerlineMinPathLength?: number;

  colorLayerCount?: number;
  layerMaxTraceSide?: number;
  minRegionPercent?: number;
  layerOptTolerance?: number;
  layerTurdSize?: number;
  layerTurnPolicy?: string;
  posterize?: boolean;
  removeWhite?: boolean;
  removeTransparent?: boolean;

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
  colorMergeTolerance?: number;
  posterizeStrength?: number;
  sortLayersBy?: string;
  layerAlpha?: number;
  backgroundAlpha?: number;
  fillStrokeWidth?: number;
  fillStrokeColor?: string;
  layerBuildMode?: LayerBuildMode;
  layerOverlapPx?: number;
  groupBy?: LayerGroupBy;
  gapFill?: LayerGapFill;
  paletteAlgorithm?: PaletteAlgorithm;
  paletteDistance?: PaletteDistance;
  requestedPaletteCount?: number;
  layeredQualityTier?: LayeredQualityTier;
  traceDiagnosticsMode?: "off" | "summary";

  outputWidth?: number;
  outputHeight?: number;
  preserveAspectRatio?: boolean;
};

export type TraceLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  pathTags?: string;
  opacity?: number;
  originalOpacity?: number;
  kind?: TraceLayerKind;
  pathCount?: number;
};

export type TraceResult = {
  svg: string;
  layers?: TraceLayerMeta[];
  width: number;
  height: number;
  engineUsed: TraceEngineUsed;
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  diagnostics?: Record<string, unknown>;
  layerBuildMode?: LayerBuildMode;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
};

export type TraceEngineDecision = {
  engine: TraceEngineUsed;
  reason: string;
  clientEligible: boolean;
};
