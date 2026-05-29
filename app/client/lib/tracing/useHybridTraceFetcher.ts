import * as React from "react";
import { useFetcher } from "react-router";

import { buildConversionCacheKeyForFile } from "~/client/lib/converter/buildConversionCacheKey";
import {
  lookupConversionCache,
  writeConversionCache,
  type BaseConversionCacheResult,
} from "~/client/lib/converter/conversionCache";
import {
  acquireInFlightConversion,
} from "~/client/lib/converter/inFlightConversionDedupe";
import type {
  NormalizedTraceSettings,
  TraceEngine,
  TraceResult,
} from "~/shared/tracing/types";

import {
  SERVER_FIRST_LAYERED_TRACE_REASON,
  tryTraceRasterInClient,
} from "./vtracerWorkerClient";

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
  clientRunId?: string;
  traceJobId?: string;
  cacheHit?: boolean;
  conversionCacheKey?: string;
};

type FetcherReturn<TData> = ReturnType<typeof useFetcher<TData>>;
type HybridTraceFetcherReturn<TData> = FetcherReturn<TData> & {
  cancelClientJob: (clientRunId: string) => void;
  activeClientJobs: number;
};
type FetcherSubmitTarget = Parameters<FetcherReturn<unknown>["submit"]>[0];
type FetcherSubmitOptions = Parameters<FetcherReturn<unknown>["submit"]>[1];
const SERVER_FALLBACK_SUBMITTED = "ILOVESVG_SERVER_FALLBACK_SUBMITTED";

export function useHybridTraceFetcher<
  TData extends HybridTracePayload = HybridTracePayload,
>(options: {
  routeId: string;
  enabled?: boolean;
  onProgress?: (progress: number, message: string) => void;
}): HybridTraceFetcherReturn<TData> {
  const fetcher = useFetcher<TData>();
  const [clientData, setClientData] = React.useState<TData | undefined>();
  const [activeClientJobs, setActiveClientJobs] = React.useState(0);
  const runIdRef = React.useRef(0);
  const fallbackWarningRef = React.useRef<string | null>(null);
  const clientCancelHandlersRef = React.useRef(new Map<string, () => void>());
  const canceledClientRunIdsRef = React.useRef(new Set<string>());
  const suppressedServerDataRef = React.useRef<unknown>(undefined);
  const pendingServerCacheRef = React.useRef(
    new Map<
      string,
      {
        cacheKey: string;
        resolve: (result: BaseConversionCacheResult) => void;
        reject: (error: unknown) => void;
      }
    >(),
  );

  const submit = React.useCallback(
    (target: FetcherSubmitTarget, submitOptions?: FetcherSubmitOptions) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      suppressedServerDataRef.current = fetcher.data;
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
      const clientRunId =
        readString(target, "clientRunId") ??
        `${options.routeId}-${Date.now()}-${runId}`;
      if (!readString(target, "clientRunId")) {
        target.append("clientRunId", clientRunId);
      }
      canceledClientRunIdsRef.current.delete(clientRunId);

      setActiveClientJobs((count) => count + 1);
      let cleanupInFlightConsumer: (() => void) | null = null;
      let currentAbortController: AbortController | null = null;

      const registerCancelHandler = (cancel: () => void) => {
        clientCancelHandlersRef.current.set(clientRunId, () => {
          canceledClientRunIdsRef.current.add(clientRunId);
          cancel();
        });
      };

      const createLocalAbortController = () => {
        const controller = new AbortController();
        currentAbortController = controller;
        registerCancelHandler(() => controller.abort());
        return controller;
      };

      const runClientOrServerConversion = async (
        cacheKey: string | null,
        signal: AbortSignal,
      ): Promise<BaseConversionCacheResult> => {
        recordHybridTraceDebug({
          routeId: options.routeId,
          stage: "client-attempt-start",
          clientRunId,
          traceJobId: String(runId),
          presetId: settings.presetId,
          traceMode: settings.traceMode,
          requestedEngine,
          conversionCacheKey: cacheKey,
        });

        const clientAttempt = await tryTraceRasterInClient({
          file: submittedFile,
          settings,
          presetId: settings.presetId,
          presetBackendIntensity: settings.presetBackendIntensity,
          onProgress: options.onProgress,
          signal,
        });

        if (clientAttempt.ok) {
          recordHybridTraceDebug({
            routeId: options.routeId,
            stage: "client-attempt-success",
            clientRunId,
            traceJobId: String(runId),
            latest: runIdRef.current === runId,
            engineUsed: clientAttempt.result.engineUsed,
            warnings: clientAttempt.result.warnings,
            conversionCacheKey: cacheKey,
          });
          fallbackWarningRef.current = null;
          if (cacheKey) writeConversionCache(cacheKey, clientAttempt.result);
          return clientAttempt.result;
        }

        const isLatest = runIdRef.current === runId;
        recordHybridTraceDebug({
          routeId: options.routeId,
          stage: "client-attempt-failed",
          clientRunId,
          traceJobId: String(runId),
          latest: isLatest,
          reason: clientAttempt.reason,
          requestedEngine,
          conversionCacheKey: cacheKey,
        });
        if (
          signal.aborted ||
          clientAttempt.reason === "Conversion was canceled."
        ) {
          recordHybridTraceDebug({
            routeId: options.routeId,
            stage: "client-attempt-canceled",
            clientRunId,
            traceJobId: String(runId),
          });
          throw new Error("Conversion was canceled.");
        }
        if (requestedEngine === "vtracer") {
          throw new Error(
            `VTracer could not convert this image in your browser. ${clientAttempt.reason}`,
          );
        }
        if (settings.strokeOutputMode === "centerline") {
          throw new Error(
            `Centerline stroke tracing could not convert this image in your browser. ${clientAttempt.reason}`,
          );
        }

        if (!isLatest) {
          throw new Error(`An earlier browser trace did not finish. ${clientAttempt.reason}`);
        }

        fallbackWarningRef.current =
          clientAttempt.reason === SERVER_FIRST_LAYERED_TRACE_REASON
            ? null
            : clientAttempt.reason;
        recordHybridTraceDebug({
          routeId: options.routeId,
          stage: "server-fallback-submit",
          clientRunId,
          traceJobId: String(runId),
          reason: clientAttempt.reason,
          conversionCacheKey: cacheKey,
        });

        if (!cacheKey) {
          fetcher.submit(target, submitOptions);
          throw new Error(SERVER_FALLBACK_SUBMITTED);
        }

        return await new Promise<BaseConversionCacheResult>((resolve, reject) => {
          pendingServerCacheRef.current.set(clientRunId, {
            cacheKey,
            resolve,
            reject,
          });
          fetcher.submit(target, submitOptions);
        });
      };

      void (async () => {
        const keyInfo = await buildConversionCacheKeyForFile(submittedFile, {
          routeId: options.routeId,
          settings,
        });
        const cacheKey = keyInfo?.key ?? null;

        if (cacheKey) {
          const cached = lookupConversionCache(cacheKey);
          if (cached) {
            recordHybridTraceDebug({
              routeId: options.routeId,
              stage: "cache-hit",
              clientRunId,
              traceJobId: String(runId),
              conversionCacheKey: cacheKey,
              engineUsed: cached.engineUsed,
            });
            setClientData(
              traceResultToFetcherData<TData>(cached, {
                clientRunId,
                traceJobId: String(runId),
                cacheHit: true,
                conversionCacheKey: cacheKey,
              }),
            );
            return;
          }

          const inFlight = acquireInFlightConversion(cacheKey, (signal) =>
            runClientOrServerConversion(cacheKey, signal),
          );
          cleanupInFlightConsumer = inFlight.release;
          registerCancelHandler(inFlight.cancel);
          if (inFlight.shared) {
            recordHybridTraceDebug({
              routeId: options.routeId,
              stage: "in-flight-join",
              clientRunId,
              traceJobId: String(runId),
              conversionCacheKey: cacheKey,
            });
          }
          const result = await inFlight.promise;
          if (canceledClientRunIdsRef.current.has(clientRunId)) return;
          setClientData(
            traceResultToFetcherData<TData>(result, {
              clientRunId,
              traceJobId: String(runId),
              cacheHit: false,
              conversionCacheKey: cacheKey,
            }),
          );
          return;
        }

        const localAbortController = createLocalAbortController();
        const result = await runClientOrServerConversion(
          null,
          localAbortController.signal,
        );
        if (canceledClientRunIdsRef.current.has(clientRunId)) return;
        setClientData(
          traceResultToFetcherData<TData>(result, {
            clientRunId,
            traceJobId: String(runId),
          }),
        );
      })()
        .catch((error) => {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Browser tracing failed.";
          if (message === SERVER_FALLBACK_SUBMITTED) return;
          const isLatest = runIdRef.current === runId;
          if (
            currentAbortController?.signal.aborted ||
            canceledClientRunIdsRef.current.has(clientRunId) ||
            /canceled/i.test(message)
          ) {
            recordHybridTraceDebug({
              routeId: options.routeId,
              stage: "client-attempt-canceled",
              clientRunId,
              traceJobId: String(runId),
            });
            return;
          }
          if (
            message.startsWith("VTracer could not convert") ||
            message.startsWith("Centerline stroke tracing could not convert") ||
            message.startsWith("An earlier browser trace did not finish")
          ) {
            if (!isLatest) return;
            setClientData({
              error: message,
              clientRunId,
              traceJobId: String(runId),
            } as TData);
            return;
          }
          if (!isLatest) return;
          if (requestedEngine === "vtracer") {
            setClientData({
              error: `VTracer could not convert this image in your browser. ${message}`,
              clientRunId,
              traceJobId: String(runId),
            } as TData);
            return;
          }
          if (settings.strokeOutputMode === "centerline") {
            setClientData({
              error: `Centerline stroke tracing could not convert this image in your browser. ${message}`,
              clientRunId,
              traceJobId: String(runId),
            } as TData);
            return;
          }
          fallbackWarningRef.current = message;
          recordHybridTraceDebug({
            routeId: options.routeId,
            stage: "server-fallback-submit",
            clientRunId,
            traceJobId: String(runId),
            reason: message,
          });
          fetcher.submit(target, submitOptions);
        })
        .finally(() => {
          cleanupInFlightConsumer?.();
          clientCancelHandlersRef.current.delete(clientRunId);
          canceledClientRunIdsRef.current.delete(clientRunId);
          setActiveClientJobs((count) => Math.max(0, count - 1));
        });
    },
    [fetcher, options.enabled, options.onProgress, options.routeId],
  );

  React.useEffect(() => {
    const rawData = fetcher.data;
    if (!rawData) return;
    const clientRunId = rawData.clientRunId || "";
    let pendingClientRunId = clientRunId;
    let pending = clientRunId
      ? pendingServerCacheRef.current.get(clientRunId)
      : null;
    if (!pending && !clientRunId && pendingServerCacheRef.current.size === 1) {
      const fallbackPending = pendingServerCacheRef.current.entries().next().value;
      if (fallbackPending) {
        pendingClientRunId = fallbackPending[0];
        pending = fallbackPending[1];
      }
    }
    if (!pending) return;

    if (rawData.svg) {
      const enriched = withServerFallbackMetadata(rawData, fallbackWarningRef.current);
      const result = fetcherDataToTraceResult(enriched);
      if (result) {
        writeConversionCache(pending.cacheKey, result);
        recordHybridTraceDebug({
          routeId: options.routeId,
          stage: "server-cache-write",
          clientRunId: pendingClientRunId,
          conversionCacheKey: pending.cacheKey,
          engineUsed: result.engineUsed,
        });
        pending.resolve(result);
      } else {
        pending.reject(new Error("Server conversion returned an invalid cache result."));
      }
      pendingServerCacheRef.current.delete(pendingClientRunId);
      return;
    }

    if (rawData.error) {
      pending.reject(new Error(rawData.error));
      pendingServerCacheRef.current.delete(pendingClientRunId);
    }
  }, [fetcher.data, options.routeId]);

  React.useEffect(() => {
    return () => {
      for (const pending of pendingServerCacheRef.current.values()) {
        pending.reject(new Error("Conversion cache waiter was released."));
      }
      pendingServerCacheRef.current.clear();
    };
  }, []);

  const cancelClientJob = React.useCallback((clientRunId: string) => {
    const cancel = clientCancelHandlersRef.current.get(clientRunId);
    cancel?.();
  }, []);

  const data = React.useMemo(() => {
    if (clientData) return clientData;
    if (fetcher.data && fetcher.data === suppressedServerDataRef.current) {
      return undefined;
    }
    return withServerFallbackMetadata(fetcher.data, fallbackWarningRef.current);
  }, [clientData, fetcher.data]);

  return React.useMemo(
    () =>
      ({
        ...fetcher,
        activeClientJobs,
        cancelClientJob,
        data,
        state: activeClientJobs > 0 ? "submitting" : fetcher.state,
        submit,
      }) as HybridTraceFetcherReturn<TData>,
    [activeClientJobs, cancelClientJob, data, fetcher, submit],
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
  metadata?: {
    clientRunId?: string;
    traceJobId?: string;
    cacheHit?: boolean;
    conversionCacheKey?: string;
  },
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
    clientRunId: metadata?.clientRunId,
    traceJobId: metadata?.traceJobId,
    cacheHit: metadata?.cacheHit,
    conversionCacheKey: metadata?.conversionCacheKey,
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

function fetcherDataToTraceResult<TData extends HybridTracePayload>(
  data: TData | undefined,
): BaseConversionCacheResult | null {
  if (!data?.svg) return null;
  const width = Number(data.width ?? 0);
  const height = Number(data.height ?? 0);
  const engineUsed = data.engineUsed || "potrace";
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    (engineUsed !== "vtracer" &&
      engineUsed !== "potrace" &&
      engineUsed !== "centerline")
  ) {
    return null;
  }

  return {
    svg: data.svg,
    layers: (Array.isArray(data.layers) ? data.layers : []) as TraceResult["layers"],
    width,
    height,
    engineUsed,
    sourceKind: data.sourceKind || "raster",
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    timings: data.timings || {},
    diagnostics: data.diagnostics || {},
    layerBuildMode: data.layerBuildMode as TraceResult["layerBuildMode"],
    requestedPaletteCount: data.requestedPaletteCount,
    actualPaletteCount: data.actualPaletteCount,
    outputDetectedColors: data.outputDetectedColors,
    pathCount: data.pathCount,
    svgBytes: data.svgBytes,
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
    strokeOutputMode: normalizeStrokeOutputMode(readString(formData, "strokeOutputMode")),

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
    centerlineMaxTraceSide: readNumber(formData, "centerlineMaxTraceSide"),
    centerlineStrokeWidth: readNumber(formData, "centerlineStrokeWidth"),
    centerlineSimplifyTolerance: readNumber(formData, "centerlineSimplifyTolerance"),
    centerlineMinPathLength: readNumber(formData, "centerlineMinPathLength"),

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
    fillStrokeWidth: readNumber(formData, "fillStrokeWidth"),
    fillStrokeColor: readString(formData, "fillStrokeColor") ?? undefined,
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

function normalizeStrokeOutputMode(value: string | null) {
  return value === "centerline" ? "centerline" : "filled";
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
