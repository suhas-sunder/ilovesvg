export type TraceEngine = "auto" | "vtracer" | "potrace";

export type TraceEngineUsed = "vtracer" | "potrace";

export type TraceMode = "single" | "layered";

export type TraceLayerKind = "fill" | "stroke";

export type NormalizedTraceSettings = {
  traceMode?: TraceMode;
  engine?: TraceEngine;
  presetId?: string | null;
  presetBackendIntensity?: string | null;
  routeId?: string;

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
  opacity?: number;
  originalOpacity?: number;
  kind?: TraceLayerKind;
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
};

export type TraceEngineDecision = {
  engine: TraceEngineUsed;
  reason: string;
  clientEligible: boolean;
};
