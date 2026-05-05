import * as React from "react";
import { useFetcher } from "react-router";

import type {
  NormalizedTraceSettings,
  TraceEngine,
  TraceResult,
} from "~/shared/tracing/types";

import { tryTraceRasterInClient } from "./vtracerWorkerClient";

type HybridTracePayload = {
  svg?: string;
  layers?: unknown[];
  width?: number;
  height?: number;
  error?: string;
  engineUsed?: TraceResult["engineUsed"];
  sourceKind?: TraceResult["sourceKind"];
  warnings?: string[];
  timings?: Record<string, number>;
  diagnostics?: Record<string, unknown>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
};

type FetcherReturn<TData> = ReturnType<typeof useFetcher<TData>>;
type FetcherSubmitTarget = Parameters<FetcherReturn<unknown>["submit"]>[0];
type FetcherSubmitOptions = Parameters<FetcherReturn<unknown>["submit"]>[1];

export function useHybridTraceFetcher<
  TData extends HybridTracePayload = HybridTracePayload,
>(options: {
  routeId: string;
  enabled?: boolean;
  onProgress?: (progress: number, message: string) => void;
}): FetcherReturn<TData> {
  const fetcher = useFetcher<TData>();
  const [clientData, setClientData] = React.useState<TData | undefined>();
  const [clientTracing, setClientTracing] = React.useState(false);
  const runIdRef = React.useRef(0);
  const fallbackWarningRef = React.useRef<string | null>(null);

  const submit = React.useCallback(
    (target: FetcherSubmitTarget, submitOptions?: FetcherSubmitOptions) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setClientData(undefined);
      fallbackWarningRef.current = null;

      if (
        options.enabled === false ||
        typeof window === "undefined" ||
        !(target instanceof FormData)
      ) {
        fetcher.submit(target, submitOptions);
        return;
      }

      const submittedFile = target.get("file");
      if (!(submittedFile instanceof File) || isUploadedSvg(submittedFile)) {
        fetcher.submit(target, submitOptions);
        return;
      }

      const settings = formDataToTraceSettings(target, options.routeId);
      const requestedEngine = settings.engine || "auto";

      setClientTracing(true);
      recordHybridTraceDebug({
        routeId: options.routeId,
        stage: "client-attempt-start",
        presetId: settings.presetId,
        traceMode: settings.traceMode,
        requestedEngine,
      });
      void (async () => {
        const clientAttempt = await tryTraceRasterInClient({
          file: submittedFile,
          settings,
          presetId: settings.presetId,
          presetBackendIntensity: settings.presetBackendIntensity,
          onProgress: options.onProgress,
        });

        if (runIdRef.current !== runId) return;

        if (clientAttempt.ok) {
          recordHybridTraceDebug({
            routeId: options.routeId,
            stage: "client-attempt-success",
            engineUsed: clientAttempt.result.engineUsed,
            warnings: clientAttempt.result.warnings,
          });
          fallbackWarningRef.current = null;
          setClientData(traceResultToFetcherData<TData>(clientAttempt.result));
          return;
        }

        recordHybridTraceDebug({
          routeId: options.routeId,
          stage: "client-attempt-failed",
          reason: clientAttempt.reason,
          requestedEngine,
        });
        if (requestedEngine === "vtracer") {
          setClientData({
            error: `VTracer could not convert this image in your browser. ${clientAttempt.reason}`,
          } as TData);
          return;
        }

        fallbackWarningRef.current = clientAttempt.reason;
        recordHybridTraceDebug({
          routeId: options.routeId,
          stage: "server-fallback-submit",
          reason: clientAttempt.reason,
        });
        fetcher.submit(target, submitOptions);
      })()
        .catch((error) => {
          if (runIdRef.current !== runId) return;
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Browser tracing failed.";
          if (requestedEngine === "vtracer") {
            setClientData({
              error: `VTracer could not convert this image in your browser. ${message}`,
            } as TData);
            return;
          }
          fallbackWarningRef.current = message;
          recordHybridTraceDebug({
            routeId: options.routeId,
            stage: "server-fallback-submit",
            reason: message,
          });
          fetcher.submit(target, submitOptions);
        })
        .finally(() => {
          if (runIdRef.current === runId) {
            setClientTracing(false);
          }
        });
    },
    [fetcher, options.enabled, options.onProgress, options.routeId],
  );

  const data = React.useMemo(() => {
    if (clientData) return clientData;
    return withServerFallbackMetadata(fetcher.data, fallbackWarningRef.current);
  }, [clientData, fetcher.data]);

  return React.useMemo(
    () =>
      ({
        ...fetcher,
        data,
        state: clientTracing ? "submitting" : fetcher.state,
        submit,
      }) as FetcherReturn<TData>,
    [clientTracing, data, fetcher, submit],
  );
}

function recordHybridTraceDebug(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const debugEvents = (window as any).__ILOVESVG_HYBRID_TRACE_DEBUG__;
  if (!Array.isArray(debugEvents)) return;
  debugEvents.push({
    time: Date.now(),
    ...event,
  });
}

function traceResultToFetcherData<TData extends HybridTracePayload>(
  result: TraceResult,
): TData {
  return {
    svg: result.svg,
    layers: result.layers || [],
    width: result.width,
    height: result.height,
    engineUsed: result.engineUsed,
    sourceKind: result.sourceKind || "raster",
    warnings: result.warnings || [],
    timings: result.timings || {},
    diagnostics: result.diagnostics || {},
    layerBuildMode: result.layerBuildMode,
    requestedPaletteCount: result.requestedPaletteCount,
    actualPaletteCount: result.actualPaletteCount,
    outputDetectedColors: result.outputDetectedColors,
    pathCount: result.pathCount,
    svgBytes: result.svgBytes,
  } as TData;
}

function withServerFallbackMetadata<TData extends HybridTracePayload>(
  data: TData | undefined,
  fallbackReason: string | null,
): TData | undefined {
  if (!data || !data.svg) return data;

  const warnings = Array.isArray(data.warnings) ? [...data.warnings] : [];
  if (fallbackReason) {
    const warning = `Browser VTracer was not used: ${fallbackReason}`;
    if (!warnings.includes(warning)) warnings.push(warning);
  }

  return {
    ...data,
    engineUsed: data.engineUsed || "potrace",
    sourceKind: data.sourceKind || "raster",
    warnings,
  };
}

function formDataToTraceSettings(
  formData: FormData,
  routeId: string,
): NormalizedTraceSettings {
  const presetId = readString(formData, "presetId") ?? null;
  return {
    routeId,
    presetId,
    presetBackendIntensity:
      readString(formData, "presetBackendIntensity") ?? null,
    engine: normalizeEngine(readString(formData, "engine")),
    traceMode: normalizeTraceMode(readString(formData, "traceMode"), routeId, presetId),

    lineColor: readString(formData, "lineColor") ?? undefined,
    transparent: readBoolean(formData, "transparent"),
    bgColor: readString(formData, "bgColor") ?? undefined,
    invert: readBoolean(formData, "invert"),

    threshold: readNumber(formData, "threshold"),
    turdSize: readNumber(formData, "turdSize"),
    optTolerance: readNumber(formData, "optTolerance"),
    turnPolicy: readString(formData, "turnPolicy") ?? undefined,

    preprocess: readString(formData, "preprocess") ?? undefined,
    blurSigma: readNumber(formData, "blurSigma"),
    edgeBoost: readNumber(formData, "edgeBoost"),
    maxTraceSide: readNumber(formData, "maxTraceSide"),

    colorLayerCount:
      readNumber(formData, "colorLayerCount") ??
      readNumber(formData, "layerCount"),
    layerMaxTraceSide: readNumber(formData, "layerMaxTraceSide"),
    minRegionPercent: readNumber(formData, "minRegionPercent"),
    layerOptTolerance: readNumber(formData, "layerOptTolerance"),
    layerTurdSize: readNumber(formData, "layerTurdSize"),
    layerTurnPolicy: readString(formData, "layerTurnPolicy") ?? undefined,
    posterize: readBoolean(formData, "posterize"),
    removeWhite: readBoolean(formData, "removeWhite"),
    removeTransparent: readBoolean(formData, "removeTransparent"),

    removeColors: readColorList(formData, "removeColors"),
    removeColorTolerance: readNumber(formData, "removeColorTolerance"),
    brightness: readNumber(formData, "brightness"),
    contrast: readNumber(formData, "contrast"),
    edgeThreshold: readNumber(formData, "edgeThreshold"),
    edgeThickness: readNumber(formData, "edgeThickness"),
    noiseReduction: readNumber(formData, "noiseReduction"),
    gapCloseStrength: readNumber(formData, "gapCloseStrength"),
    minIslandPx: readNumber(formData, "minIslandPx"),
    holeFillPx: readNumber(formData, "holeFillPx"),
    colorMergeTolerance: readNumber(formData, "colorMergeTolerance"),
    posterizeStrength: readNumber(formData, "posterizeStrength"),
    sortLayersBy: readString(formData, "sortLayersBy") ?? undefined,
    layerAlpha: readNumber(formData, "layerAlpha"),
    backgroundAlpha: readNumber(formData, "backgroundAlpha"),
    layerBuildMode: normalizeLayerBuildMode(readString(formData, "layerBuildMode")),
    layerOverlapPx: readNumber(formData, "layerOverlapPx"),
    groupBy: normalizeGroupBy(readString(formData, "groupBy")),
    gapFill: normalizeGapFill(readString(formData, "gapFill")),
    paletteAlgorithm: normalizePaletteAlgorithm(readString(formData, "paletteAlgorithm")),
    paletteDistance: normalizePaletteDistance(readString(formData, "paletteDistance")),
    requestedPaletteCount: readNumber(formData, "requestedPaletteCount"),
    traceDiagnosticsMode:
      readString(formData, "traceDiagnosticsMode") === "summary" ? "summary" : "off",

    outputWidth: readNumber(formData, "outputWidth"),
    outputHeight: readNumber(formData, "outputHeight"),
    preserveAspectRatio: readBoolean(formData, "preserveAspectRatio"),
  };
}

function readString(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(formData: FormData, name: string): number | undefined {
  const value = readString(formData, name);
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(formData: FormData, name: string): boolean | undefined {
  const value = readString(formData, name);
  if (value == null) return undefined;
  if (value === "true" || value === "1" || value === "on") return true;
  if (value === "false" || value === "0" || value === "off") return false;
  return undefined;
}

function readColorList(formData: FormData, name: string): string[] | undefined {
  const value = readString(formData, name);
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((color): color is string => typeof color === "string");
    }
  } catch {
    // Fall through to comma-separated parsing for older route payloads.
  }
  return value
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

function normalizeEngine(value: string | null): TraceEngine {
  return value === "vtracer" || value === "potrace" ? value : "auto";
}

function normalizeTraceMode(
  value: string | null,
  routeId?: string,
  presetId?: string | null,
): "single" | "layered" {
  if (value === "layered") return "layered";
  if (value === "single") return "single";
  const routeHint = routeId || "";
  const presetHint = presetId || "";
  if (/\blayered\b|to-layered-svg|layered-svg/i.test(routeHint)) return "layered";
  if (/\blayered\b|\blayer\b/i.test(presetHint)) return "layered";
  return "single";
}

function isUploadedSvg(file: File): boolean {
  return (
    file.type === "image/svg+xml" ||
    /\.svgz?$/i.test(file.name || "")
  );
}

function normalizeLayerBuildMode(value: string | null) {
  if (
    value === "raw-vtracer" ||
    value === "per-color-cutout" ||
    value === "stacked-overlap"
  ) {
    return value;
  }
  return undefined;
}

function normalizeGroupBy(value: string | null) {
  if (value === "none" || value === "color" || value === "layer") return value;
  return undefined;
}

function normalizeGapFill(value: string | null) {
  if (value === "none" || value === "close-small-gaps" || value === "overlap") {
    return value;
  }
  return undefined;
}

function normalizePaletteAlgorithm(value: string | null) {
  if (
    value === "image-q-wuquant" ||
    value === "image-q-rgbquant" ||
    value === "simple-posterize"
  ) {
    return value;
  }
  return undefined;
}

function normalizePaletteDistance(value: string | null) {
  if (value === "ciede2000" || value === "bt709" || value === "rgb") return value;
  return undefined;
}
