import {
  getTraceEngineDecision,
  type TraceInputProfile,
} from "~/shared/tracing/enginePolicy";
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
}): Promise<ClientTraceAttempt> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Client tracing is not available during SSR." };
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

  try {
    const buffer = await withTimeout(input.file.arrayBuffer(), 8_000);
    worker = new Worker(
      new URL("../../workers/vtracer.worker.ts", import.meta.url),
      { type: "module" },
    );
    const result = await new Promise<TraceResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            "Browser tracing took too long. Falling back to the server engine.",
          ),
        );
      }, 45_000);

      worker!.onmessage = (event: MessageEvent<VTracerWorkerMessage>) => {
        const message = event.data;
        if (!message || message.id !== id) return;

        if (message.type === "progress") {
          input.onProgress?.(message.progress, message.message);
          return;
        }

        window.clearTimeout(timeout);
        if (message.type === "error") {
          reject(new Error(message.message));
          return;
        }

        resolve({
          svg: message.svg,
          layers: message.layers || [],
          width: message.width,
          height: message.height,
          engineUsed: "vtracer",
          sourceKind: "raster",
          warnings: message.warnings || [],
          timings: message.timings || {},
        });
      };

      worker!.onerror = (event) => {
        window.clearTimeout(timeout);
        reject(
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
  }
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
  input: { inputBytes?: number; traceMode?: "single" | "layered" } = {},
): string | null {
  const svg = typeof result.svg === "string" ? result.svg.trim() : "";
  if (!svg) {
    return "Browser tracing returned an empty SVG. Falling back to the server engine.";
  }

  if (!/^<svg\b/i.test(svg) || !/(<\/svg>|\/>\s*)$/i.test(svg)) {
    return "Browser tracing returned invalid SVG. Falling back to the server engine.";
  }

  const width = Number(result.width);
  const height = Number(result.height);
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    return "Browser tracing returned invalid SVG dimensions. Falling back to the server engine.";
  }

  if (
    !/<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image|use)\b/i.test(
      svg,
    )
  ) {
    return "Browser tracing returned SVG with no drawable content. Falling back to the server engine.";
  }

  const svgBytes = svg.length;
  const pathCount = (svg.match(/<path\b/gi) || []).length;
  const layered = input.traceMode === "layered";
  const maxSvgBytes = layered ? 2_200_000 : 1_500_000;
  const maxPaths = layered ? 2_400 : 1_200;
  if (svgBytes > maxSvgBytes) {
    return "Browser tracing returned an oversized SVG. Falling back to the server engine.";
  }
  if (pathCount > maxPaths) {
    return "Browser tracing returned too many paths for a responsive preview. Falling back to the server engine.";
  }

  const inputBytes = Number(input.inputBytes || 0);
  if (
    inputBytes > 0 &&
    svgBytes > Math.max(900_000, inputBytes * 24) &&
    pathCount > (layered ? 700 : 450)
  ) {
    return "Browser tracing returned path-heavy SVG output. Falling back to the server engine.";
  }

  return null;
}
