import { traceCenterlineRasterToSvg } from "../../shared/tracing/centerlineTrace";
import type { NormalizedTraceSettings, TraceResult } from "../../shared/tracing/types";

type WorkerRequest = {
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
  settings: NormalizedTraceSettings;
};

type WorkerProgress = {
  type: "progress";
  id: string;
  progress: number;
  message: string;
};

type WorkerResult = {
  type: "result";
  id: string;
  result: TraceResult;
};

type WorkerError = {
  type: "error";
  id: string;
  message: string;
};

const CENTERLINE_MAX_TRACE_SIDE = 1400;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void runCenterlineTrace(event.data);
};

async function runCenterlineTrace(request: WorkerRequest) {
  try {
    postProgress(request.id, 0.08, "Preparing centerline tracing.");
    const decoded = await decodeToImageData(
      request.buffer,
      request.mimeType,
      request.settings,
    );
    postProgress(request.id, 0.42, "Finding line centers.");
    const result = traceCenterlineRasterToSvg(
      {
        data: decoded.imageData.data,
        width: decoded.width,
        height: decoded.height,
      },
      request.settings,
    );
    postProgress(request.id, 0.92, "Building stroked SVG.");
    postMessage({
      type: "result",
      id: request.id,
      result,
    } satisfies WorkerResult);
  } catch (error) {
    postMessage({
      type: "error",
      id: request.id,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Centerline stroke tracing could not process this image.",
    } satisfies WorkerError);
  }
}

async function decodeToImageData(
  buffer: ArrayBuffer,
  mimeType: string,
  settings: NormalizedTraceSettings,
) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser does not support worker image decoding.");
  }
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("This browser does not support worker canvas tracing.");
  }

  const blob = new Blob([buffer], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  try {
    const requestedSide = clampInt(
      Number(settings.centerlineMaxTraceSide || settings.maxTraceSide || 1100),
      64,
      CENTERLINE_MAX_TRACE_SIDE,
    );
    const scale = Math.min(1, requestedSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(2, Math.round(bitmap.width * scale));
    const height = Math.max(2, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    } as CanvasRenderingContext2DSettings);
    if (!context) throw new Error("Could not create image processing context.");
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return {
      imageData: context.getImageData(0, 0, width, height),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

function postProgress(id: string, progress: number, message: string) {
  postMessage({ type: "progress", id, progress, message } satisfies WorkerProgress);
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.round(Math.max(min, Math.min(max, value)));
}
