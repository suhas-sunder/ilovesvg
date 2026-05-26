import {
  getTraceEngineDecision,
  type TraceInputProfile,
} from "~/shared/tracing/enginePolicy";
import {
  layeredQualityTierSizeRatioCeiling,
  normalizeLayeredQualityTier,
} from "~/shared/tracing/layeredQualityTier";
import type {
  NormalizedTraceSettings,
  TraceResult,
} from "~/shared/tracing/types";

type VTracerWorkerProgress = {
  type: "progress";
  id: string;
  progress: number;
  message: string;
};

type VTracerWorkerResult = {
  type: "result";
  id: string;
  svg: string;
  layers?: TraceResult["layers"];
  width: number;
  height: number;
  warnings?: string[];
  timings?: Record<string, number>;
  diagnostics?: Record<string, unknown>;
  layerBuildMode?: TraceResult["layerBuildMode"];
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
};

type VTracerWorkerError = {
  type: "error";
  id: string;
  message: string;
};

type VTracerWorkerMessage =
  | VTracerWorkerProgress
  | VTracerWorkerResult
  | VTracerWorkerError;

type CenterlineWorkerResult = {
  type: "result";
  id: string;
  result: TraceResult;
};

type CenterlineWorkerMessage =
  | VTracerWorkerProgress
  | CenterlineWorkerResult
  | VTracerWorkerError;

export type ClientTraceAttempt =
  | { ok: true; result: TraceResult }
  | { ok: false; reason: string };

export async function tryTraceRasterInClient(input: {
  file: File;
  settings: NormalizedTraceSettings;
  presetId?: string | null;
  presetBackendIntensity?: string | null;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
}): Promise<ClientTraceAttempt> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Client tracing is not available during SSR." };
  }

  if (input.signal?.aborted) {
    return { ok: false, reason: "Conversion was canceled." };
  }

  const browserCanRunWorker =
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof ArrayBuffer !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof createImageBitmap !== "undefined" &&
    typeof OffscreenCanvas !== "undefined";

  const settings: NormalizedTraceSettings = {
    ...input.settings,
    presetId: input.presetId ?? input.settings.presetId ?? null,
    presetBackendIntensity:
      input.presetBackendIntensity ??
      input.settings.presetBackendIntensity ??
      null,
  };
  const layeredQualityTier = normalizeLayeredQualityTier(
    settings.layeredQualityTier,
    settings.presetId,
  );
  if (settings.traceMode === "layered" && layeredQualityTier !== "default") {
    return {
      ok: false,
      reason:
        "Layered quality tier presets use the server trace path for highest-fidelity output.",
    };
  }
  if (settings.strokeOutputMode === "centerline") {
    return tryTraceCenterlineInClient({
      file: input.file,
      settings,
      onProgress: input.onProgress,
      signal: input.signal,
    });
  }
  const probedSize =
    input.sourceWidth && input.sourceHeight
      ? { width: input.sourceWidth, height: input.sourceHeight }
      : await readBrowserImageSize(input.file);
  const profile: TraceInputProfile = {
    mimeType: input.file.type || inferRasterMimeType(input.file.name),
    fileSizeBytes: input.file.size,
    width: probedSize?.width ?? input.sourceWidth,
    height: probedSize?.height ?? input.sourceHeight,
    browserCanRunWorker,
  };
  const decision = getTraceEngineDecision(settings, profile);

  if (decision.engine !== "vtracer" || !decision.clientEligible) {
    return { ok: false, reason: decision.reason };
  }

  const id = `vtracer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let worker: Worker | null = null;
  let releaseSlot: (() => void) | null = null;

  try {
    input.onProgress?.(0.02, "Queued for browser tracing.");
    releaseSlot = await acquireClientTraceSlot(input.signal);
    if (input.signal?.aborted) {
      return { ok: false, reason: "Conversion was canceled." };
    }
    input.onProgress?.(0.05, "Tracing in your browser.");
    const buffer = await withTimeout(input.file.arrayBuffer(), 8_000);
    worker = new Worker(
      new URL("../../workers/vtracer.worker.ts", import.meta.url),
      { type: "module" },
    );
    const result = await new Promise<TraceResult>((resolve, reject) => {
      let settled = false;
      const layered = settings.traceMode === "layered";
      const workerTimeoutMs =
        layered && layeredQualityTier === "amazing"
          ? 45_000
          : layered && layeredQualityTier === "high"
            ? 150_000
            : layered && layeredQualityTier === "medium"
              ? 105_000
              : 45_000;
      const timeout = window.setTimeout(() => {
        fail(
          new Error(
            "Browser tracing took too long. Falling back to the server engine.",
          ),
        );
      }, workerTimeoutMs);
      const abortHandler = () => {
        worker?.terminate();
        fail(new Error("Conversion was canceled."));
      };
      const cleanup = () => {
        input.signal?.removeEventListener("abort", abortHandler);
        window.clearTimeout(timeout);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const succeed = (traceResult: TraceResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(traceResult);
      };
      input.signal?.addEventListener("abort", abortHandler, { once: true });

      worker!.onmessage = (event: MessageEvent<VTracerWorkerMessage>) => {
        const message = event.data;
        if (!message || message.id !== id) return;

        if (message.type === "progress") {
          input.onProgress?.(message.progress, message.message);
          return;
        }

        if (message.type === "error") {
          fail(new Error(message.message));
          return;
        }

        succeed({
          svg: message.svg,
          layers: message.layers || [],
          width: message.width,
          height: message.height,
          engineUsed: "vtracer",
          sourceKind: "raster",
          warnings: message.warnings || [],
          timings: message.timings || {},
          diagnostics: message.diagnostics || {},
          layerBuildMode: message.layerBuildMode,
          requestedPaletteCount: message.requestedPaletteCount,
          actualPaletteCount: message.actualPaletteCount,
          outputDetectedColors: message.outputDetectedColors,
          pathCount: message.pathCount,
          svgBytes: message.svgBytes,
        });
      };

      worker!.onerror = (event) => {
        fail(
          new Error(
            event.message ||
              "Browser tracing failed. Falling back to the server engine.",
          ),
        );
      };

      worker!.postMessage(
        {
          id,
          buffer,
          mimeType: input.file.type || inferRasterMimeType(input.file.name),
          fileName: input.file.name,
          settings,
        },
        [buffer],
      );
    });

    const unusableReason = getUnusableTraceResultReason(result, {
      inputBytes: input.file.size,
      traceMode: settings.traceMode || "single",
      settings,
    });
    if (unusableReason) {
      return { ok: false, reason: unusableReason };
    }

    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message
          ? error.message
          : "Browser tracing failed.",
    };
  } finally {
    worker?.terminate();
    releaseSlot?.();
  }
}

async function tryTraceCenterlineInClient(input: {
  file: File;
  settings: NormalizedTraceSettings;
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
}): Promise<ClientTraceAttempt> {
  const browserCanRunWorker =
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof ArrayBuffer !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof createImageBitmap !== "undefined" &&
    typeof OffscreenCanvas !== "undefined";
  if (!browserCanRunWorker) {
    return {
      ok: false,
      reason: "This browser does not support the centerline tracing worker.",
    };
  }
  if (input.file.size > 8 * 1024 * 1024) {
    return {
      ok: false,
      reason: "Centerline tracing is limited to smaller source files.",
    };
  }

  const id = `centerline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let worker: Worker | null = null;
  let releaseSlot: (() => void) | null = null;

  try {
    input.onProgress?.(0.02, "Queued for centerline tracing.");
    releaseSlot = await acquireClientTraceSlot(input.signal);
    if (input.signal?.aborted) {
      return { ok: false, reason: "Conversion was canceled." };
    }
    const buffer = await withTimeout(input.file.arrayBuffer(), 8_000);
    worker = new Worker(
      new URL("../../workers/centerline.worker.ts", import.meta.url),
      { type: "module" },
    );

    const result = await new Promise<TraceResult>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        fail(new Error("Centerline tracing took too long. Try a smaller or cleaner image."));
      }, 45_000);
      const abortHandler = () => {
        worker?.terminate();
        fail(new Error("Conversion was canceled."));
      };
      const cleanup = () => {
        input.signal?.removeEventListener("abort", abortHandler);
        window.clearTimeout(timeout);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const succeed = (traceResult: TraceResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(traceResult);
      };
      input.signal?.addEventListener("abort", abortHandler, { once: true });

      worker!.onmessage = (event: MessageEvent<CenterlineWorkerMessage>) => {
        const message = event.data;
        if (!message || message.id !== id) return;
        if (message.type === "progress") {
          input.onProgress?.(message.progress, message.message);
          return;
        }
        if (message.type === "error") {
          fail(new Error(message.message));
          return;
        }
        succeed(message.result);
      };

      worker!.onerror = (event) => {
        fail(
          new Error(
            event.message || "Centerline tracing failed in the browser worker.",
          ),
        );
      };

      worker!.postMessage(
        {
          id,
          buffer,
          mimeType: input.file.type || inferRasterMimeType(input.file.name),
          settings: input.settings,
        },
        [buffer],
      );
    });

    const unusableReason = getUnusableTraceResultReason(result, {
      inputBytes: input.file.size,
      traceMode: input.settings.traceMode || "single",
      settings: input.settings,
    });
    if (unusableReason) return { ok: false, reason: unusableReason };
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error && error.message
          ? error.message
          : "Centerline tracing failed.",
    };
  } finally {
    worker?.terminate();
    releaseSlot?.();
  }
}

const MAX_ACTIVE_CLIENT_TRACES = 2;
let activeClientTraceSlots = 0;
const queuedClientTraceResolvers: Array<() => void> = [];

function acquireClientTraceSlot(signal?: AbortSignal): Promise<() => void> {
  if (typeof window === "undefined") return Promise.resolve(() => {});
  if (signal?.aborted) {
    return Promise.reject(new Error("Conversion was canceled."));
  }

  if (activeClientTraceSlots < MAX_ACTIVE_CLIENT_TRACES) {
    activeClientTraceSlots += 1;
    return Promise.resolve(releaseClientTraceSlot);
  }

  return new Promise((resolve, reject) => {
    const run = () => {
      signal?.removeEventListener("abort", abortHandler);
      activeClientTraceSlots += 1;
      resolve(releaseClientTraceSlot);
    };
    const abortHandler = () => {
      const index = queuedClientTraceResolvers.indexOf(run);
      if (index >= 0) queuedClientTraceResolvers.splice(index, 1);
      reject(new Error("Conversion was canceled."));
    };
    signal?.addEventListener("abort", abortHandler, { once: true });
    queuedClientTraceResolvers.push(run);
  });
}

function releaseClientTraceSlot() {
  activeClientTraceSlots = Math.max(0, activeClientTraceSlots - 1);
  const next = queuedClientTraceResolvers.shift();
  if (next) next();
}

async function readBrowserImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await withTimeout(createImageBitmap(file), 4_000);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Browser image-size probe timed out."));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function inferRasterMimeType(fileName: string): string {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "";
}

function getUnusableTraceResultReason(
  result: TraceResult,
  input: {
    inputBytes?: number;
    traceMode?: "single" | "layered";
    settings?: NormalizedTraceSettings;
  } = {},
): string | null {
  const svg = typeof result.svg === "string" ? result.svg.trim() : "";
  const centerline = input.settings?.strokeOutputMode === "centerline";
  if (!svg) {
    return centerline
      ? "Centerline tracing returned an empty SVG. Try a cleaner line-art image or a filled-shape preset."
      : "Browser tracing returned an empty SVG. Falling back to the server engine.";
  }

  if (!/^<svg\b/i.test(svg) || !/(<\/svg>|\/>\s*)$/i.test(svg)) {
    return centerline
      ? "Centerline tracing returned invalid SVG. Try a cleaner line-art image or a filled-shape preset."
      : "Browser tracing returned invalid SVG. Falling back to the server engine.";
  }

  const width = Number(result.width);
  const height = Number(result.height);
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    return centerline
      ? "Centerline tracing returned invalid SVG dimensions. Try a cleaner line-art image or a filled-shape preset."
      : "Browser tracing returned invalid SVG dimensions. Falling back to the server engine.";
  }

  if (
    !/<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image|use)\b/i.test(
      svg,
    )
  ) {
    return centerline
      ? "Centerline tracing returned no drawable strokes. Try a cleaner line-art image or a filled-shape preset."
      : "Browser tracing returned SVG with no drawable content. Falling back to the server engine.";
  }

  const svgBytes = svg.length;
  const pathCount = result.pathCount ?? (svg.match(/<path\b/gi) || []).length;
  const layered = input.traceMode === "layered";
  const requestedPaletteCount = Number(
    result.requestedPaletteCount ||
      input.settings?.requestedPaletteCount ||
      input.settings?.colorLayerCount ||
      0,
  );
  const inputBytes = Number(input.inputBytes || 0);
  const layeredQualityTier = normalizeLayeredQualityTier(
    input.settings?.layeredQualityTier,
    input.settings?.presetId,
  );
  const richLayered = layered && requestedPaletteCount >= 28;
  const qualityTierMaxSvgBytes =
    layered && layeredQualityTier !== "default" && inputBytes > 0
      ? Math.max(
          richLayered ? 3_200_000 : 2_200_000,
          Math.round(
            inputBytes * layeredQualityTierSizeRatioCeiling(layeredQualityTier),
          ),
        )
      : null;
  const maxSvgBytes =
    qualityTierMaxSvgBytes ??
    (layered ? (richLayered ? 3_200_000 : 2_200_000) : 1_500_000);
  const maxPaths = layered
    ? layeredQualityTier === "amazing"
      ? 16_000
      : layeredQualityTier === "high"
        ? 12_000
      : layeredQualityTier === "medium"
        ? 8_500
        : richLayered
          ? 6_500
          : 4_500
    : 1_200;
  if (svgBytes > maxSvgBytes) {
    return centerline
      ? "Centerline tracing returned an oversized SVG. Try a smaller image or a simpler stroke preset."
      : "Browser tracing returned an oversized SVG. Falling back to the server engine.";
  }
  if (pathCount > maxPaths) {
    return centerline
      ? "Centerline tracing returned too many strokes for a responsive preview. Try a simpler stroke preset or a smaller image."
      : "Browser tracing returned too many paths for a responsive preview. Falling back to the server engine.";
  }

  if (
    layered &&
    (!Array.isArray(result.layers) || result.layers.length === 0)
  ) {
    return "Browser tracing returned no editable color layers. Falling back to the server engine.";
  }

  if (
    inputBytes > 0 &&
    svgBytes > Math.max(900_000, inputBytes * 24) &&
    pathCount > (layered ? 700 : 450)
  ) {
    return centerline
      ? "Centerline tracing returned path-heavy SVG output. Try a simpler stroke preset or a smaller image."
      : "Browser tracing returned path-heavy SVG output. Falling back to the server engine.";
  }

  return null;
}
