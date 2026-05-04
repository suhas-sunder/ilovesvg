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
  const profile: TraceInputProfile = {
    mimeType: input.file.type,
    fileSizeBytes: input.file.size,
    width: input.sourceWidth,
    height: input.sourceHeight,
    browserCanRunWorker,
  };
  const decision = getTraceEngineDecision(settings, profile);

  if (decision.engine !== "vtracer" || !decision.clientEligible) {
    return { ok: false, reason: decision.reason };
  }

  const id = `vtracer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const worker = new Worker(
    new URL("../../workers/vtracer.worker.ts", import.meta.url),
    { type: "module" },
  );

  try {
    const buffer = await input.file.arrayBuffer();
    const result = await new Promise<TraceResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            "Browser tracing took too long. Falling back to the server engine.",
          ),
        );
      }, 45_000);

      worker.onmessage = (event: MessageEvent<VTracerWorkerMessage>) => {
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

      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        reject(
          new Error(
            event.message ||
              "Browser tracing failed. Falling back to the server engine.",
          ),
        );
      };

      worker.postMessage(
        {
          id,
          buffer,
          mimeType: input.file.type,
          fileName: input.file.name,
          settings,
        },
        [buffer],
      );
    });

    const unusableReason = getUnusableTraceResultReason(result);
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
    worker.terminate();
  }
}

function getUnusableTraceResultReason(result: TraceResult): string | null {
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

  return null;
}
