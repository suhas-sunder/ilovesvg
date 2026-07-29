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
import { getPublicTraceWarning } from "~/client/lib/converter/publicTracePresentation";
import type {
  NormalizedTraceSettings,
  TraceEngine,
  TraceResult,
} from "~/shared/tracing/types";
import {
  createTraceActionUrl,
  normalizeTraceClientRunId,
} from "~/shared/tracing/traceResponseCorrelation";

import {
  SERVER_FIRST_LAYERED_TRACE_REASON,
  tryTraceRasterInClient,
} from "./vtracerWorkerClient";
import {
  createHybridTraceRunLifecycle,
  createPendingServerFallback,
  rejectPendingServerFallback,
  resolvePendingServerFallback,
  ServerFallbackResponseError,
  type HybridTraceRunLifecycle,
  type PendingServerFallback,
} from "./hybridTraceFallbackLifecycle";

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
  traceResponseCorrelated?: boolean;
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
type ServerFallbackContext = Readonly<{
  fallbackWarning: string | null;
  canWriteCache: () => boolean;
}>;
type ServerFallbackWaiter = PendingServerFallback<
  BaseConversionCacheResult,
  ServerFallbackContext
>;

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
  const mountedRef = React.useRef(true);
  const runIdRef = React.useRef(0);
  const activeClientRunsRef = React.useRef(
    new Map<string, HybridTraceRunLifecycle>(),
  );
  const suppressedServerDataRef = React.useRef<unknown>(undefined);
  const pendingServerCacheRef = React.useRef(
    new Map<string, ServerFallbackWaiter>(),
  );

  const submit = React.useCallback(
    (target: FetcherSubmitTarget, submitOptions?: FetcherSubmitOptions) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      suppressedServerDataRef.current = fetcher.data;
      setClientData(undefined);

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
        normalizeTraceClientRunId(readString(target, "clientRunId")) ??
        `${options.routeId}-${Date.now()}-${runId}`;
      target.set("clientRunId", clientRunId);
      const correlatedSubmitOptions: FetcherSubmitOptions = {
        ...submitOptions,
        action: createTraceActionUrl(
          submitOptions?.action,
          window.location.href,
          clientRunId,
        ),
      };
      activeClientRunsRef.current
        .get(clientRunId)
        ?.cleanup("superseded");
      setActiveClientJobs((count) => count + 1);
      let runLifecycle!: HybridTraceRunLifecycle;
      runLifecycle = createHybridTraceRunLifecycle({
        clientRunId,
        onCleanup: () => {
          if (activeClientRunsRef.current.get(clientRunId) === runLifecycle) {
            activeClientRunsRef.current.delete(clientRunId);
          }
          if (mountedRef.current) {
            setActiveClientJobs((count) => Math.max(0, count - 1));
          }
        },
      });
      activeClientRunsRef.current.set(clientRunId, runLifecycle);
      let currentAbortController: AbortController | null = null;
      let getInFlightConsumerCount: (() => number) | null = null;
      let fallbackWarning: string | null = null;
      let serverFallbackSubmitted = false;
      const isActiveClientRun = () =>
        mountedRef.current && runLifecycle.isActive();
      const canActivateClientResult = () =>
        isActiveClientRun() &&
        (!serverFallbackSubmitted || runIdRef.current === runId);
      const supersedeOlderServerFallbackRuns = () => {
        for (const pendingClientRunId of pendingServerCacheRef.current.keys()) {
          if (pendingClientRunId === clientRunId) continue;
          activeClientRunsRef.current
            .get(pendingClientRunId)
            ?.cleanup("superseded");
        }
      };

      const createLocalAbortController = () => {
        const controller = new AbortController();
        currentAbortController = controller;
        runLifecycle.attachAbortController(controller);
        return controller;
      };

      const submitServerFallback = (
        cacheKey: string | null,
        signal: AbortSignal,
        reason: string | null,
      ): Promise<BaseConversionCacheResult> => {
        if (signal.aborted) {
          return Promise.reject(new Error("Conversion was canceled."));
        }

        pendingServerCacheRef.current
          .get(clientRunId)
          ?.reject(new Error("An obsolete server fallback waiter was released."));
        fallbackWarning = reason;
        serverFallbackSubmitted = true;

        let pending!: ServerFallbackWaiter;
        pending = createPendingServerFallback({
          clientRunId,
          cacheKey,
          context: {
            fallbackWarning: reason,
            canWriteCache: () => {
              const consumerCount = getInFlightConsumerCount?.() ?? 0;
              return (
                runIdRef.current === runId ||
                consumerCount > 1 ||
                (!runLifecycle.isActive() && consumerCount > 0)
              );
            },
          },
          signal,
          onSettled: () => {
            if (pendingServerCacheRef.current.get(clientRunId) === pending) {
              pendingServerCacheRef.current.delete(clientRunId);
            }
          },
        });
        pendingServerCacheRef.current.set(clientRunId, pending);
        try {
          fetcher.submit(target, correlatedSubmitOptions);
        } catch (error) {
          pending.reject(error);
        }
        return pending.promise;
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
          onProgress: (progress, message) => {
            if (isActiveClientRun()) options.onProgress?.(progress, message);
          },
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
          fallbackWarning = null;
          if (cacheKey) writeConversionCache(cacheKey, clientAttempt.result);
          return clientAttempt.result;
        }

        const isLatest = mountedRef.current && runIdRef.current === runId;
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
            "Detailed color tracing could not convert this image in your browser. Try another preset or a simpler image.",
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

        fallbackWarning =
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

        return await submitServerFallback(
          cacheKey,
          signal,
          fallbackWarning,
        );
      };

      void (async () => {
        const keyInfo = await buildConversionCacheKeyForFile(submittedFile, {
          routeId: options.routeId,
          settings,
        });
        if (!isActiveClientRun()) return;
        const cacheKey = keyInfo?.key ?? null;

        if (cacheKey) {
          const cached = lookupConversionCache(cacheKey);
          if (cached) {
            supersedeOlderServerFallbackRuns();
            recordHybridTraceDebug({
              routeId: options.routeId,
              stage: "cache-hit",
              clientRunId,
              traceJobId: String(runId),
              conversionCacheKey: cacheKey,
              engineUsed: cached.engineUsed,
            });
            if (!canActivateClientResult()) return;
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
          getInFlightConsumerCount = inFlight.getConsumerCount;
          runLifecycle.attachInFlightConsumer(inFlight);
          supersedeOlderServerFallbackRuns();
          if (inFlight.shared) {
            recordHybridTraceDebug({
              routeId: options.routeId,
              stage: "in-flight-join",
              clientRunId,
              traceJobId: String(runId),
              conversionCacheKey: cacheKey,
            });
          }
          const result = await runLifecycle.waitFor(inFlight.promise);
          if (!canActivateClientResult()) return;
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
        supersedeOlderServerFallbackRuns();
        const result = await runClientOrServerConversion(
          null,
          localAbortController.signal,
        );
        if (!canActivateClientResult()) return;
        setClientData(
          traceResultToFetcherData<TData>(result, {
            clientRunId,
            traceJobId: String(runId),
          }),
        );
      })()
        .catch(async (error) => {
          if (!mountedRef.current) return;
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Browser tracing failed.";
          const isLatest = mountedRef.current && runIdRef.current === runId;
          if (
            currentAbortController?.signal.aborted ||
            !runLifecycle.isActive() ||
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
            serverFallbackSubmitted ||
            error instanceof ServerFallbackResponseError
          ) {
            if (!isLatest) return;
            setClientData({
              error: message,
              clientRunId,
              traceJobId: String(runId),
            } as TData);
            return;
          }
          if (
            message.startsWith("Detailed color tracing could not convert") ||
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
              error:
                "Detailed color tracing could not convert this image in your browser. Try another preset or a simpler image.",
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
          fallbackWarning = message;
          recordHybridTraceDebug({
            routeId: options.routeId,
            stage: "server-fallback-submit",
            clientRunId,
            traceJobId: String(runId),
            reason: message,
          });
          supersedeOlderServerFallbackRuns();
          const fallbackController =
            currentAbortController ?? createLocalAbortController();
          try {
            const fallbackResult = await submitServerFallback(
              null,
              fallbackController.signal,
              fallbackWarning,
            );
            if (!canActivateClientResult()) return;
            setClientData(
              traceResultToFetcherData<TData>(fallbackResult, {
                clientRunId,
                traceJobId: String(runId),
              }),
            );
          } catch (fallbackError) {
            if (!canActivateClientResult()) return;
            const fallbackMessage =
              fallbackError instanceof Error && fallbackError.message
                ? fallbackError.message
                : message;
            setClientData({
              error: fallbackMessage,
              clientRunId,
              traceJobId: String(runId),
            } as TData);
          }
        })
        .finally(() => {
          runLifecycle.cleanup("completed");
        });
    },
    [fetcher, options.enabled, options.onProgress, options.routeId],
  );

  React.useEffect(() => {
    const rawData = fetcher.data;
    if (!rawData) return;
    const clientRunId =
      typeof rawData.clientRunId === "string"
        ? rawData.clientRunId.trim()
        : "";
    const pending = clientRunId
      ? pendingServerCacheRef.current.get(clientRunId)
      : null;
    if (!pending) return;
    if (
      pending.cacheKey &&
      rawData.conversionCacheKey &&
      rawData.conversionCacheKey !== pending.cacheKey
    ) {
      rejectPendingServerFallback(
        pendingServerCacheRef.current,
        clientRunId,
        new ServerFallbackResponseError(
          "Server conversion returned a mismatched cache key.",
        ),
      );
      return;
    }

    if (rawData.svg) {
      const enriched = withServerFallbackMetadata(
        rawData,
        pending.context.fallbackWarning,
      );
      const result = fetcherDataToTraceResult(enriched);
      if (result) {
        resolvePendingServerFallback(
          pendingServerCacheRef.current,
          clientRunId,
          result,
          (activePending) => {
            if (
              activePending.cacheKey &&
              activePending.context.canWriteCache()
            ) {
              writeConversionCache(activePending.cacheKey, result);
              recordHybridTraceDebug({
                routeId: options.routeId,
                stage: "server-cache-write",
                clientRunId,
                conversionCacheKey: activePending.cacheKey,
                engineUsed: result.engineUsed,
              });
            }
          },
        );
      } else {
        rejectPendingServerFallback(
          pendingServerCacheRef.current,
          clientRunId,
          new ServerFallbackResponseError(
            "Server conversion returned an invalid cache result.",
          ),
        );
      }
      return;
    }

    if (rawData.error) {
      rejectPendingServerFallback(
        pendingServerCacheRef.current,
        clientRunId,
        new ServerFallbackResponseError(rawData.error),
      );
    }
  }, [fetcher.data, options.routeId]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      for (const runLifecycle of activeClientRunsRef.current.values()) {
        runLifecycle.cleanup("unmounted");
      }
      activeClientRunsRef.current.clear();
      for (const pending of pendingServerCacheRef.current.values()) {
        pending.reject(new Error("Conversion cache waiter was released."));
      }
      pendingServerCacheRef.current.clear();
    };
  }, []);

  const cancelClientJob = React.useCallback((clientRunId: string) => {
    activeClientRunsRef.current.get(clientRunId)?.cleanup("canceled");
  }, []);

  const data = React.useMemo(() => {
    if (clientData) return clientData;
    if (fetcher.data && fetcher.data === suppressedServerDataRef.current) {
      return undefined;
    }
    if (fetcher.data?.traceResponseCorrelated === true) {
      return undefined;
    }
    return fetcher.data;
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
    const warning = getPublicTraceWarning(fallbackReason);
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
