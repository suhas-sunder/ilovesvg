import {
  ColorMode,
  Hierarchical,
  PathSimplifyMode,
  TracerConfig,
  convertImageToSvg,
  init as markVTracerReady,
  isReady as isVTracerReady,
  __wbg_set_wasm,
} from "wasm_vtracer/wasm_vtracer_bg.js";
import * as vtracerRuntime from "wasm_vtracer/wasm_vtracer_bg.js";
import vtracerWasmUrl from "wasm_vtracer/wasm_vtracer_bg.wasm?url";
import type { NormalizedTraceSettings, TraceLayerMeta } from "~/shared/tracing/types";

type WorkerRequest = {
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
  fileName?: string;
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
  svg: string;
  layers: TraceLayerMeta[];
  width: number;
  height: number;
  warnings: string[];
  timings: Record<string, number>;
};

type WorkerError = {
  type: "error";
  id: string;
  message: string;
};

let wasmReadyPromise: Promise<void> | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void runTrace(event.data);
};

function ensureVTracerWasmReady() {
  if (isVTracerReady()) {
    return Promise.resolve();
  }

  if (!wasmReadyPromise) {
    wasmReadyPromise = (async () => {
      const imports = {
        "./wasm_vtracer_bg.js": {
          __wbindgen_object_drop_ref: vtracerRuntime.__wbindgen_object_drop_ref,
          __wbg_new_8a6f238a6ece86ea: vtracerRuntime.__wbg_new_8a6f238a6ece86ea,
          __wbg_stack_0ed75d68575b0f3c: vtracerRuntime.__wbg_stack_0ed75d68575b0f3c,
          __wbg_error_7534b8e9a36f1ab4: vtracerRuntime.__wbg_error_7534b8e9a36f1ab4,
          __wbg_Error_52673b7de5a0ca89: vtracerRuntime.__wbg_Error_52673b7de5a0ca89,
          __wbg___wbindgen_throw_dd24417ed36fc46e:
            vtracerRuntime.__wbg___wbindgen_throw_dd24417ed36fc46e,
        },
      } satisfies WebAssembly.Imports;
      const response = await fetch(vtracerWasmUrl);
      const result = await WebAssembly.instantiate(await response.arrayBuffer(), imports);
      __wbg_set_wasm(result.instance.exports);
      markVTracerReady();
    })();
  }

  return wasmReadyPromise;
}

async function runTrace(request: WorkerRequest) {
  const timings: Record<string, number> = {};
  const started = performance.now();
  const warnings: string[] = [];

  try {
    postProgress(request.id, 0.05, "Loading VTracer...");
    const t = performance.now();
    await ensureVTracerWasmReady();
    timings.initWasm = performance.now() - t;

    postProgress(request.id, 0.16, "Decoding image...");
    const decoded = await timed(timings, "decodeImage", () =>
      decodeToImageData(request.buffer, request.mimeType, request.settings),
    );

    postProgress(request.id, 0.34, "Preparing pixels...");
    const prepared = timedSync(timings, "preprocessPixels", () =>
      preprocessImageData(decoded.imageData, request.settings),
    );

    postProgress(request.id, 0.52, "Tracing SVG...");
    const config = buildVTracerConfig(request.settings);
    const rawSvg = timedSync(timings, "vtracer", () =>
      convertImageToSvg(
        new Uint8Array(prepared.buffer, prepared.byteOffset, prepared.byteLength),
        decoded.width,
        decoded.height,
        config,
      ),
    );
    config.free();

    postProgress(request.id, 0.86, "Finishing SVG...");
    const svg = timedSync(timings, "postprocessSvg", () =>
      postprocessSvg(rawSvg, request.settings, decoded.width, decoded.height),
    );
    const layers = extractEditableLayers(svg, request.settings);
    timings.total = performance.now() - started;

    postMessage({
      type: "result",
      id: request.id,
      svg,
      layers,
      width: getOutputWidth(request.settings, decoded.width, decoded.height),
      height: getOutputHeight(request.settings, decoded.width, decoded.height),
      warnings,
      timings,
    } satisfies WorkerResult);
  } catch (error) {
    postMessage({
      type: "error",
      id: request.id,
      message:
        error instanceof Error && error.message
          ? error.message
          : "VTracer could not process this image in the browser.",
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
    const maxSide = getRequestedTraceSide(settings);
    const scale =
      maxSide > 0
        ? Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        : 1;
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

function preprocessImageData(
  imageData: ImageData,
  settings: NormalizedTraceSettings,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(imageData.data);
  applyBrightnessContrast(data, settings);
  removeSelectedColors(data, settings);

  if (settings.preprocess === "edge") {
    return buildEdgeImageData(data, imageData.width, imageData.height, settings);
  }

  if (settings.traceMode === "layered" || settings.posterize) {
    posterizePixels(data, settings);
  }

  normalizeTransparentPixels(data, settings);
  return data;
}

function buildVTracerConfig(settings: NormalizedTraceSettings): TracerConfig {
  const config = new TracerConfig();
  config.setColorMode(ColorMode.Color);
  config.setHierarchical(
    settings.traceMode === "layered" ? Hierarchical.Stacked : Hierarchical.Cutout,
  );
  config.setPathSimplifyMode(
    Number(settings.optTolerance ?? settings.layerOptTolerance ?? 0.4) <= 0.18
      ? PathSimplifyMode.None
      : PathSimplifyMode.Spline,
  );
  config.setFilterSpeckle(
    clampInt(
      Number(
        settings.traceMode === "layered"
          ? settings.layerTurdSize ?? settings.turdSize ?? 4
          : settings.turdSize ?? 2,
      ),
      0,
      100,
    ),
  );
  config.setColorPrecision(
    clampInt(Number(settings.posterizeStrength ?? 6), 2, 8),
  );
  config.setLayerDifference(
    clampInt(Number(settings.colorMergeTolerance ?? 16), 0, 255),
  );
  config.setCornerThreshold(60);
  config.setLengthThreshold(
    clampNumber(4 + Number(settings.optTolerance ?? 0.35) * 3, 3.5, 10),
  );
  config.setMaxIterations(10);
  config.setSpliceThreshold(45);
  config.setPathPrecision(2);
  return config;
}

function postprocessSvg(
  rawSvg: string,
  settings: NormalizedTraceSettings,
  sourceWidth: number,
  sourceHeight: number,
) {
  const outputWidth = getOutputWidth(settings, sourceWidth, sourceHeight);
  const outputHeight = getOutputHeight(settings, sourceWidth, sourceHeight);
  let svg = String(rawSvg || "")
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<!--[\s\S]*?-->\s*/g, "");

  svg = svg.replace(/<svg\b([^>]*)>/i, (_match, attrs = "") => {
    let next = String(attrs)
      .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sviewBox\s*=\s*["'][^"']*["']/gi, "");
    return `<svg${next} width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">`;
  });

  if (settings.transparent !== false) {
    svg = removeInitialBackgroundPath(svg, settings);
  } else {
    svg = injectBackgroundRect(svg, sourceWidth, sourceHeight, settings);
  }

  if (settings.preprocess === "edge" || settings.invert) {
    svg = recolorNonBackgroundPaths(svg, settings.lineColor || "#000000");
  }

  if (settings.layerAlpha != null && Number(settings.layerAlpha) < 0.999) {
    svg = svg.replace(/<path\b([^>]*?)>/gi, (match, attrs = "") => {
      if (isBackgroundFill(String(attrs), settings)) return match;
      return `<path${stripAttr(String(attrs), "opacity")} opacity="${formatAlpha(
        Number(settings.layerAlpha),
      )}">`;
    });
  }

  return annotateSvgLayerIds(svg, settings);
}

function extractEditableLayers(
  svg: string,
  settings: NormalizedTraceSettings,
): TraceLayerMeta[] {
  const seen = new Map<string, TraceLayerMeta>();
  let count = 0;
  const pathPattern = /<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathPattern.exec(svg))) {
    const color = normalizeHexColor(
      match[1].match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
    );
    if (!color) continue;
    if (isBackgroundColor(color, settings)) continue;
    if (seen.has(color)) continue;
    count += 1;
    const id = `vtracer-fill-${count}-${color.slice(1)}`;
    seen.set(color, {
      id,
      label: count === 1 && settings.traceMode !== "layered" ? "Trace color" : `Layer ${count}`,
      color,
      originalColor: color,
      visible: true,
      opacity: Number(settings.layerAlpha ?? 1),
      originalOpacity: Number(settings.layerAlpha ?? 1),
      kind: "fill",
    });
  }

  return Array.from(seen.values()).slice(0, 24);
}

function annotateSvgLayerIds(svg: string, settings: NormalizedTraceSettings) {
  const colorIds = new Map<string, string>();
  let count = 0;
  return svg.replace(/<path\b([^>]*?)>/gi, (match, attrs = "") => {
    const currentAttrs = String(attrs || "");
    if (/\bdata-fill-layer-id\s*=/i.test(currentAttrs)) return match;
    const color = normalizeHexColor(
      currentAttrs.match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
    );
    if (!color || isBackgroundColor(color, settings)) return match;
    let id = colorIds.get(color);
    if (!id) {
      count += 1;
      id = `vtracer-fill-${count}-${color.slice(1)}`;
      colorIds.set(color, id);
    }
    return `<path data-fill-layer-id="${id}"${currentAttrs}>`;
  });
}

function removeInitialBackgroundPath(
  svg: string,
  settings: NormalizedTraceSettings,
) {
  return svg.replace(
    /(<svg\b[^>]*>\s*)(<path\b([^>]*)>\s*)/i,
    (match, open, path, attrs = "") => {
      const fill = normalizeHexColor(
        String(attrs).match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
      );
      if (fill && isBackgroundColor(fill, settings)) return open;
      return match;
    },
  );
}

function injectBackgroundRect(
  svg: string,
  width: number,
  height: number,
  settings: NormalizedTraceSettings,
) {
  const fill = normalizeHexColor(settings.bgColor || "") || "#ffffff";
  const opacity =
    settings.backgroundAlpha != null && Number(settings.backgroundAlpha) < 0.999
      ? ` fill-opacity="${formatAlpha(Number(settings.backgroundAlpha))}"`
      : "";
  return svg.replace(
    /<svg\b[^>]*>/i,
    (open) =>
      `${open}<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}"${opacity} />`,
  );
}

function recolorNonBackgroundPaths(svg: string, color: string) {
  const fill = normalizeHexColor(color) || "#000000";
  return svg.replace(/<path\b([^>]*?)>/gi, (match, attrs = "") => {
    if (isWhiteFill(String(attrs))) return match;
    return `<path${stripAttr(String(attrs), "fill")} fill="${fill}">`;
  });
}

function applyBrightnessContrast(
  data: Uint8ClampedArray,
  settings: NormalizedTraceSettings,
) {
  const brightness = clampNumber(Number(settings.brightness ?? 0), -50, 50);
  const contrast = clampNumber(Number(settings.contrast ?? 0), -50, 75);
  if (brightness === 0 && contrast === 0) return;

  const brightnessFactor = Math.max(0.05, 1 + brightness / 100);
  const contrastFactor = Math.max(0.1, 1 + contrast / 100);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte(((data[i] - 128) * contrastFactor + 128) * brightnessFactor);
    data[i + 1] = clampByte(((data[i + 1] - 128) * contrastFactor + 128) * brightnessFactor);
    data[i + 2] = clampByte(((data[i + 2] - 128) * contrastFactor + 128) * brightnessFactor);
  }
}

function removeSelectedColors(
  data: Uint8ClampedArray,
  settings: NormalizedTraceSettings,
) {
  const colors = normalizeRemoveColors(settings.removeColors);
  if (!colors.length) return;
  const tolerance = clampNumber(Number(settings.removeColorTolerance ?? 18), 0, 160);
  for (let i = 0; i < data.length; i += 4) {
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (colors.some((color) => colorDistance(pixel, color) <= tolerance)) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 0;
    }
  }
}

function normalizeTransparentPixels(
  data: Uint8ClampedArray,
  settings: NormalizedTraceSettings,
) {
  const removeTransparent = settings.removeTransparent !== false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 18) continue;
    if (removeTransparent || settings.transparent !== false) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 0;
    }
  }
}

function posterizePixels(
  data: Uint8ClampedArray,
  settings: NormalizedTraceSettings,
) {
  const levels = clampInt(Number(settings.posterizeStrength ?? 6), 2, 8);
  const step = 255 / Math.max(1, levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    if (settings.removeTransparent !== false && data[i + 3] < 18) continue;
    data[i] = clampByte(Math.round(data[i] / step) * step);
    data[i + 1] = clampByte(Math.round(data[i + 1] / step) * step);
    data[i + 2] = clampByte(Math.round(data[i + 2] / step) * step);
  }
}

function buildEdgeImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: NormalizedTraceSettings,
) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  const out = new Uint8ClampedArray(data.length);
  const edgeThreshold = clampNumber(Number(settings.edgeThreshold ?? 18), 0, 160);
  const edgeBoost = clampNumber(Number(settings.edgeBoost ?? 1), 0.25, 3);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 255;
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        let gx = 0;
        let gy = 0;
        let n = 0;
        for (let j = -1; j <= 1; j += 1) {
          for (let i = -1; i <= 1; i += 1) {
            const sample = gray[(y + j) * width + (x + i)];
            gx += sample * kx[n];
            gy += sample * ky[n];
            n += 1;
          }
        }
        const magnitude = Math.sqrt(gx * gx + gy * gy) * edgeBoost;
        value = magnitude < edgeThreshold ? 255 : 0;
      }
      const off = (y * width + x) * 4;
      out[off] = value;
      out[off + 1] = value;
      out[off + 2] = value;
      out[off + 3] = 255;
    }
  }
  return out;
}

function getRequestedTraceSide(settings: NormalizedTraceSettings) {
  const side =
    settings.traceMode === "layered"
      ? Number(settings.layerMaxTraceSide || settings.maxTraceSide || 1600)
      : Number(settings.maxTraceSide || 1600);
  return clampInt(side, 64, 2600);
}

function getOutputWidth(
  settings: NormalizedTraceSettings,
  sourceWidth: number,
  sourceHeight: number,
) {
  return resolveOutputDimensions(settings, sourceWidth, sourceHeight).width;
}

function getOutputHeight(
  settings: NormalizedTraceSettings,
  sourceWidth: number,
  sourceHeight: number,
) {
  return resolveOutputDimensions(settings, sourceWidth, sourceHeight).height;
}

function resolveOutputDimensions(
  settings: NormalizedTraceSettings,
  sourceWidth: number,
  sourceHeight: number,
) {
  let width = Math.round(Number(settings.outputWidth || 0));
  let height = Math.round(Number(settings.outputHeight || 0));
  if (!width && !height) return { width: sourceWidth, height: sourceHeight };
  if (settings.preserveAspectRatio !== false) {
    const ratio = sourceWidth / sourceHeight || 1;
    if (width && !height) height = Math.max(1, Math.round(width / ratio));
    else if (!width && height) width = Math.max(1, Math.round(height * ratio));
    else if (width && height) height = Math.max(1, Math.round(width / ratio));
  }
  return {
    width: clampInt(width || sourceWidth, 1, 6000),
    height: clampInt(height || sourceHeight, 1, 6000),
  };
}

function postProgress(id: string, progress: number, message: string) {
  postMessage({ type: "progress", id, progress, message } satisfies WorkerProgress);
}

async function timed<T>(
  timings: Record<string, number>,
  label: string,
  fn: () => Promise<T>,
) {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    timings[label] = performance.now() - start;
  }
}

function timedSync<T>(
  timings: Record<string, number>,
  label: string,
  fn: () => T,
) {
  const start = performance.now();
  try {
    return fn();
  } finally {
    timings[label] = performance.now() - start;
  }
}

function normalizeRemoveColors(colors: unknown) {
  if (!Array.isArray(colors)) return [];
  return colors
    .map((color) => parseHexColor(String(color || "")))
    .filter((color): color is { r: number; g: number; b: number } => Boolean(color))
    .slice(0, 12);
}

function parseHexColor(value: string) {
  const hex = normalizeHexColor(value);
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function normalizeHexColor(value: string): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}

function isBackgroundColor(color: string, settings: NormalizedTraceSettings) {
  const bg = normalizeHexColor(settings.bgColor || "") || "#ffffff";
  return color.toLowerCase() === bg || color.toLowerCase() === "#ffffff";
}

function isBackgroundFill(attrs: string, settings: NormalizedTraceSettings) {
  const fill = normalizeHexColor(
    attrs.match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
  );
  return Boolean(fill && isBackgroundColor(fill, settings));
}

function isWhiteFill(attrs: string) {
  const fill = normalizeHexColor(
    attrs.match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
  );
  return fill === "#ffffff";
}

function stripAttr(attrs: string, name: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(["'])[^"']*\\1`, "gi");
  return attrs.replace(pattern, "");
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
) {
  return Math.sqrt(
    (a.r - b.r) * (a.r - b.r) +
      (a.g - b.g) * (a.g - b.g) +
      (a.b - b.b) * (a.b - b.b),
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clampNumber(value, min, max));
}

function clampByte(value: number) {
  return clampInt(value, 0, 255);
}

function formatAlpha(value: number) {
  return String(clampNumber(value, 0, 1).toFixed(3))
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}
