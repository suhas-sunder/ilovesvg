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
import {
  applyPaletteSync,
  buildPaletteSync,
  utils as imageQUtils,
} from "image-q";
import { differenceCiede2000 } from "culori";
import type {
  LayerBuildMode,
  NormalizedTraceSettings,
  PaletteAlgorithm,
  PaletteDistance,
  TraceLayerMeta,
} from "~/shared/tracing/types";
import {
  filterLayeredTraceArtifactPaths,
  injectFillStrokeOutlineGroup,
} from "../../shared/tracing/fillStrokeSvg";

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
  diagnostics: Record<string, unknown>;
  layerBuildMode?: LayerBuildMode;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
};

type WorkerError = {
  type: "error";
  id: string;
  message: string;
};

type RGB = { r: number; g: number; b: number };
type LayerItem = { color: RGB; index: number; count: number };
type Mask = Uint8Array<ArrayBufferLike>;
type FlatColorStats = {
  color: string;
  rgb: RGB;
  firstIndex: number;
  pathCount: number;
  weight: number;
  bbox: FlatColorBounds | null;
  centerX: number | null;
  centerY: number | null;
  luma: number;
  saturation: number;
  isTiny: boolean;
  isNearBlack: boolean;
  isNearWhite: boolean;
};
type FlatColorBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
type FlatColorGroup = {
  representative: FlatColorStats;
  members: FlatColorStats[];
  weight: number;
  pathCount: number;
  firstIndex: number;
  bbox: FlatColorBounds | null;
};

type PreparedImage = {
  data: Uint8ClampedArray;
  diagnostics: Record<string, unknown>;
  palette: RGB[];
  layerBuildMode: LayerBuildMode;
  requestedPaletteCount: number;
  effectivePaletteCount?: number;
};

const ciede2000Difference = differenceCiede2000();
const FLAT_COLOR_GROUPING_PRESET_ID = "layered-flat-color";
const FLAT_COLOR_MAX_EDITABLE_GROUPS = 30;

let wasmReadyPromise: Promise<void> | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void runTrace(event.data);
};

function ensureVTracerWasmReady() {
  if (safeIsVTracerReady()) {
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

function safeIsVTracerReady() {
  try {
    return isVTracerReady();
  } catch {
    return false;
  }
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
        new Uint8Array(prepared.data.buffer, prepared.data.byteOffset, prepared.data.byteLength),
        decoded.width,
        decoded.height,
        config,
      ),
    );
    config.free();

    postProgress(request.id, 0.86, "Finishing SVG...");
    const svg = timedSync(timings, "postprocessSvg", () =>
      postprocessSvg(
        rawSvg,
        request.settings,
        decoded.width,
        decoded.height,
        decoded.imageData,
      ),
    );
    const layers = extractEditableLayers(svg, request.settings);
    const pathCount = countSvgPaths(svg);
    const svgBytes = byteLength(svg);
    const outputDetectedColorCount = countUniqueSvgFills(svg, request.settings);
    const actualPaletteCount = prepared.palette.length || outputDetectedColorCount;
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
      diagnostics: buildTraceDiagnostics({
        settings: request.settings,
        prepared,
        decodedWidth: decoded.width,
        decodedHeight: decoded.height,
        pathCount,
        svgBytes,
        layerCount: layers.length,
      }),
      layerBuildMode: prepared.layerBuildMode,
      requestedPaletteCount: prepared.requestedPaletteCount || undefined,
      actualPaletteCount: actualPaletteCount || undefined,
      outputDetectedColors: outputDetectedColorCount || actualPaletteCount || undefined,
      pathCount,
      svgBytes,
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
): PreparedImage {
  const data = new Uint8ClampedArray(imageData.data);
  const diagnostics: Record<string, unknown> = {
    sourcePixels: imageData.width * imageData.height,
  };
  applyBrightnessContrast(data, settings);
  removeSelectedColors(data, settings);

  if (settings.preprocess === "edge") {
    return {
      data: buildEdgeImageData(data, imageData.width, imageData.height, settings),
      diagnostics: {
        ...diagnostics,
        preprocessing: "edge",
        paletteAlgorithm: "not-applied",
      },
      palette: [],
      layerBuildMode: "raw-vtracer",
      requestedPaletteCount: 0,
      effectivePaletteCount: 0,
    };
  }

  const layerBuildMode = getLayerBuildMode(settings);
  const requestedPaletteCount = getRequestedPaletteCount(settings);
  const shouldUsePaletteQuantizer =
    settings.traceMode === "layered" &&
    layerBuildMode !== "raw-vtracer" &&
    requestedPaletteCount > 0;

  if (shouldUsePaletteQuantizer) {
    const quantized = quantizeLayeredPixels(data, imageData.width, imageData.height, settings, {
      layerBuildMode,
      requestedPaletteCount,
    });
    normalizeTransparentPixels(quantized.data, settings);
    return {
      data: quantized.data,
      diagnostics: {
        ...diagnostics,
        ...quantized.diagnostics,
      },
      palette: quantized.palette,
      layerBuildMode,
      requestedPaletteCount,
      effectivePaletteCount: quantized.effectivePaletteCount,
    };
  }

  if (settings.traceMode === "layered" || settings.posterize) {
    posterizePixels(data, settings);
  }

  normalizeTransparentPixels(data, settings);
  return {
    data,
    diagnostics: {
      ...diagnostics,
      preprocessing: settings.posterize ? "posterize" : "raw-vtracer",
      paletteAlgorithm: "simple-posterize",
    },
    palette: [],
    layerBuildMode,
    requestedPaletteCount,
    effectivePaletteCount: requestedPaletteCount,
  };
}

function buildVTracerConfig(settings: NormalizedTraceSettings): TracerConfig {
  const requestedPaletteCount = getRequestedPaletteCount(settings);
  const layered = settings.traceMode === "layered";
  const config = new TracerConfig();
  config.setColorMode(ColorMode.Color);
  config.setHierarchical(
    layered ? Hierarchical.Stacked : Hierarchical.Cutout,
  );
  config.setPathSimplifyMode(
    Number(settings.optTolerance ?? settings.layerOptTolerance ?? 0.4) <= 0.18
      ? PathSimplifyMode.None
      : PathSimplifyMode.Spline,
  );
  config.setFilterSpeckle(
    clampInt(
      Number(
        layered
          ? settings.layerTurdSize ?? settings.turdSize ?? 4
          : settings.turdSize ?? 2,
      ),
      0,
      100,
    ),
  );
  config.setColorPrecision(
    requestedPaletteCount >= 28
      ? 8
      : requestedPaletteCount >= 16
        ? 7
        : clampInt(Number(settings.posterizeStrength ?? 6), 2, 8),
  );
  config.setLayerDifference(
    clampInt(
      Number(
        settings.colorMergeTolerance ??
          (requestedPaletteCount >= 28 ? 6 : requestedPaletteCount >= 16 ? 10 : 16),
      ),
      0,
      255,
    ),
  );
  config.setCornerThreshold(60);
  config.setLengthThreshold(
    clampNumber(4 + Number(settings.optTolerance ?? 0.35) * 3, 3.5, 10),
  );
  config.setMaxIterations(10);
  config.setSpliceThreshold(45);
  config.setPathPrecision(requestedPaletteCount >= 28 ? 3 : 2);
  return config;
}

function postprocessSvg(
  rawSvg: string,
  settings: NormalizedTraceSettings,
  sourceWidth: number,
  sourceHeight: number,
  sourceImageData?: ImageData,
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
    svg = svg.replace(/<path\b([^>]*)>/gi, (match, attrs = "") => {
      const parsed = parseSelfClosingPathAttrs(String(attrs || ""));
      if (isBackgroundFill(parsed.attrs, settings)) return match;
      return `<path${stripAttr(parsed.attrs, "opacity")} opacity="${formatAlpha(
        Number(settings.layerAlpha),
      )}"${parsed.close}`;
    });
  }

  if (settings.traceMode === "layered") {
    svg = filterLayeredTraceArtifactPaths(svg, {
      fillStrokeColor: settings.fillStrokeColor,
    });
  }

  svg = injectFillStrokeOutlineGroup(svg, {
    fillStrokeWidth: settings.fillStrokeWidth,
    fillStrokeColor: settings.fillStrokeColor,
  });

  svg = groupFlatColorLayeredPalette(svg, settings);
  svg = annotateSvgLayerIds(svg, settings);

  const alphaClipPathTags = buildSourceAlphaClipPathTags(sourceImageData, settings);
  if (alphaClipPathTags) {
    svg = wrapSvgContentWithSourceAlphaClip(svg, alphaClipPathTags);
  }

  return svg;
}

function buildSourceAlphaClipPathTags(
  sourceImageData: ImageData | undefined,
  settings: NormalizedTraceSettings,
): string {
  if (
    !sourceImageData ||
    settings.traceMode !== "layered" ||
    settings.transparent === false ||
    settings.removeTransparent === false
  ) {
    return "";
  }

  const width = sourceImageData.width | 0;
  const height = sourceImageData.height | 0;
  if (width <= 0 || height <= 0) return "";

  const source = sourceImageData.data;
  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const sourceOff = pixel * 4;
    if (source[sourceOff + 3] >= 18) {
      visiblePixels += 1;
    } else {
      transparentPixels += 1;
    }
  }

  if (transparentPixels <= 0 || visiblePixels <= 0) return "";
  return buildSourceAlphaRunClipPath(source, width, height);
}

function buildSourceAlphaRunClipPath(
  source: Uint8ClampedArray,
  width: number,
  height: number,
): string {
  type Rect = { x1: number; x2: number; y1: number; y2: number };
  const active = new Map<string, Rect>();
  const pathParts: string[] = [];

  const flushRect = (rect: Rect) => {
    pathParts.push(`M${rect.x1} ${rect.y1}H${rect.x2}V${rect.y2}H${rect.x1}Z`);
  };

  for (let y = 0; y < height; y += 1) {
    const currentKeys = new Set<string>();
    let x = 0;
    while (x < width) {
      const offset = (y * width + x) * 4;
      if (source[offset + 3] < 18) {
        x += 1;
        continue;
      }

      const x1 = x;
      x += 1;
      while (x < width && source[(y * width + x) * 4 + 3] >= 18) {
        x += 1;
      }
      const x2 = x;
      const key = `${x1}:${x2}`;
      currentKeys.add(key);
      const existing = active.get(key);
      if (existing) {
        existing.y2 = y + 1;
      } else {
        active.set(key, { x1, x2, y1: y, y2: y + 1 });
      }
    }

    for (const [key, rect] of Array.from(active.entries())) {
      if (currentKeys.has(key)) continue;
      flushRect(rect);
      active.delete(key);
    }
  }

  for (const rect of active.values()) {
    flushRect(rect);
  }

  return pathParts.length ? `<path d="${pathParts.join("")}" />` : "";
}

function wrapSvgContentWithSourceAlphaClip(svg: string, pathTags: string): string {
  const source = String(svg || "");
  if (!pathTags || /data-alpha-boundary-clip\s*=\s*["']true["']/i.test(source)) {
    return source;
  }

  const clipId = "source-alpha-boundary-clip";
  const defs = `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${pathTags}</clipPath></defs>`;
  const openWrapped = source.replace(
    /<svg\b[^>]*>/i,
    (open) => `${open}${defs}<g data-alpha-boundary-clip="true" clip-path="url(#${clipId})">`,
  );
  if (openWrapped === source) return source;
  return openWrapped.replace(/<\/svg>\s*$/i, "</g></svg>");
}

function extractEditableLayers(
  svg: string,
  settings: NormalizedTraceSettings,
): TraceLayerMeta[] {
  const seen = new Map<string, TraceLayerMeta>();
  let count = 0;
  const groupPattern = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupPattern.exec(svg))) {
    const attrs = groupMatch[1] || "";
    const id = attrs.match(/\sdata-layer-id\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    const stroke = normalizeHexColor(
      attrs.match(/\sstroke\s*=\s*["']([^"']+)["']/i)?.[1] || "",
    );
    if (!id || !stroke) continue;
    const key = `stroke:${id}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      id,
      label: attrs.match(/\sdata-layer-label\s*=\s*["']([^"']+)["']/i)?.[1] || "Stroke outline",
      color: stroke,
      originalColor: stroke,
      visible: true,
      pathTags: extractLayerPathTags(groupMatch[2] || ""),
      opacity: Number(settings.layerAlpha ?? 1),
      originalOpacity: Number(settings.layerAlpha ?? 1),
      kind: "stroke",
    });
  }

  const pathPattern = /<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathPattern.exec(svg))) {
    const color = normalizeHexColor(
      match[1].match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
    );
    if (!color) continue;
    if (isBackgroundColor(color, settings)) continue;
    const key = `fill:${color}`;
    const pathTags = normalizeLayerPathTag(match[0] || "");
    const existing = seen.get(key);
    if (existing) {
      existing.pathTags = `${existing.pathTags || ""}${pathTags}`;
      continue;
    }
    count += 1;
    const id = `vtracer-fill-${count}-${color.slice(1)}`;
    seen.set(key, {
      id,
      label: count === 1 && settings.traceMode !== "layered" ? "Trace color" : `Layer ${count}`,
      color,
      originalColor: color,
      visible: true,
      pathTags,
      opacity: Number(settings.layerAlpha ?? 1),
      originalOpacity: Number(settings.layerAlpha ?? 1),
      kind: "fill",
    });
  }

  const cap =
    settings.traceMode === "layered"
      ? clampInt(
          Number(settings.requestedPaletteCount || settings.colorLayerCount || 24),
          2,
          40,
        )
      : 24;
  return Array.from(seen.values()).slice(0, cap);
}

function extractLayerPathTags(svg: string) {
  const matches = String(svg || "").match(/<path\b[^>]*>/gi) || [];
  return matches.map(normalizeLayerPathTag).join("");
}

function normalizeLayerPathTag(tag: string) {
  return String(tag || "")
    .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s\/?>$/i, " />");
}

function groupFlatColorLayeredPalette(svg: string, settings: NormalizedTraceSettings) {
  if (!shouldGroupFlatColorLayeredPalette(settings)) return svg;
  const stats = collectFlatColorStats(svg, settings);
  if (stats.length <= 1) return svg;

  const groups = buildFlatColorGroups(stats);
  if (groups.length <= 0 || groups.length >= stats.length) return svg;

  const representativeByColor = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      representativeByColor.set(member.color, group.representative.color);
    }
  }

  let changed = false;
  const next = svg.replace(/<path\b([^>]*)>/gi, (match, attrs = "") => {
    const parsed = parseSelfClosingPathAttrs(String(attrs || ""));
    const color = readPathFillColor(parsed.attrs);
    if (!color || isBackgroundColor(color, settings)) return match;
    const representative = representativeByColor.get(color);
    if (!representative || representative === color) return match;
    changed = true;
    return `<path${writePathFillColor(parsed.attrs, representative)}${parsed.close}`;
  });

  return changed ? next : svg;
}

function shouldGroupFlatColorLayeredPalette(settings: NormalizedTraceSettings) {
  return (
    settings.traceMode === "layered" &&
    settings.presetId === FLAT_COLOR_GROUPING_PRESET_ID &&
    getLayerBuildMode(settings) === "per-color-cutout"
  );
}

function collectFlatColorStats(svg: string, settings: NormalizedTraceSettings): FlatColorStats[] {
  const colors = new Map<
    string,
    {
      color: string;
      rgb: RGB;
      firstIndex: number;
      pathCount: number;
      weight: number;
      bbox: FlatColorBounds | null;
      centerWeight: number;
      centerX: number;
      centerY: number;
    }
  >();
  const pathPattern = /<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pathPattern.exec(svg))) {
    index += 1;
    const attrs = parseSelfClosingPathAttrs(String(match[1] || "")).attrs;
    const color = readPathFillColor(attrs);
    if (!color || isBackgroundColor(color, settings)) continue;
    const rgb = parseHexColor(color);
    if (!rgb) continue;
    const current = colors.get(color);
    const pathWeight = flatColorPathWeight(attrs);
    const bbox = flatColorPathBounds(attrs);
    if (current) {
      current.pathCount += 1;
      current.weight += pathWeight;
      current.bbox = mergeFlatColorBounds(current.bbox, bbox);
      if (bbox) {
        current.centerX += flatColorBoundsCenterX(bbox) * pathWeight;
        current.centerY += flatColorBoundsCenterY(bbox) * pathWeight;
        current.centerWeight += pathWeight;
      }
    } else {
      colors.set(color, {
        color,
        rgb,
        firstIndex: index,
        pathCount: 1,
        weight: pathWeight,
        bbox,
        centerWeight: bbox ? pathWeight : 0,
        centerX: bbox ? flatColorBoundsCenterX(bbox) * pathWeight : 0,
        centerY: bbox ? flatColorBoundsCenterY(bbox) * pathWeight : 0,
      });
    }
  }

  const totalWeight = Array.from(colors.values()).reduce((sum, item) => sum + item.weight, 0) || 1;
  return Array.from(colors.values()).map((item) => {
    const luma = luminance(item.rgb);
    const saturation = rgbSaturation(item.rgb);
    const share = item.weight / totalWeight;
    return {
      ...item,
      centerX: item.centerWeight > 0 ? item.centerX / item.centerWeight : null,
      centerY: item.centerWeight > 0 ? item.centerY / item.centerWeight : null,
      luma,
      saturation,
      isTiny: share < 0.004 || (item.pathCount <= 2 && share < 0.015),
      isNearBlack: luma <= 0.07 || (luma <= 0.13 && saturation <= 0.45),
      isNearWhite: luma >= 0.91 && saturation <= 0.38,
    };
  });
}

function flatColorPathWeight(attrs: string) {
  const d = String(attrs || "").match(/\sd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
  return 1 + Math.min(24, Math.sqrt(d.length || 0) / 4);
}

function flatColorPathBounds(attrs: string): FlatColorBounds | null {
  const d = String(attrs || "").match(/\sd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
  if (!d) return null;
  const numbers = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number).filter(Number.isFinite) || [];
  if (numbers.length < 2) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return { minX, minY, maxX, maxY };
}

function mergeFlatColorBounds(a: FlatColorBounds | null, b: FlatColorBounds | null) {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function flatColorBoundsCenterX(bounds: FlatColorBounds) {
  return (bounds.minX + bounds.maxX) / 2;
}

function flatColorBoundsCenterY(bounds: FlatColorBounds) {
  return (bounds.minY + bounds.maxY) / 2;
}

function buildFlatColorGroups(stats: FlatColorStats[]): FlatColorGroup[] {
  const groups: FlatColorGroup[] = [];
  const orderedStats = [...stats].sort(compareFlatColorStatsByImportance);

  for (const stat of orderedStats) {
    const match = findFlatColorGroup(stat, groups);
    if (match) {
      mergeFlatColorStat(match, stat);
    } else {
      groups.push({
        representative: stat,
        members: [stat],
        weight: stat.weight,
        pathCount: stat.pathCount,
        firstIndex: stat.firstIndex,
        bbox: stat.bbox,
      });
    }
  }

  pruneFlatColorGroups(groups);
  return groups.sort((a, b) => a.firstIndex - b.firstIndex || a.representative.color.localeCompare(b.representative.color));
}

function findFlatColorGroup(stat: FlatColorStats, groups: FlatColorGroup[]) {
  let best: FlatColorGroup | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const group of groups) {
    const representative = group.representative;
    const distance = perceptualDistance(stat.rgb, representative.rgb, "ciede2000");
    const threshold = flatColorMergeThreshold(stat, representative);
    if (distance > threshold) continue;
    if (!flatColorSpatiallyCompatible(stat, group, distance)) continue;
    const score = distance / Math.max(0.1, threshold);
    if (
      score < bestScore ||
      (score === bestScore && distance < bestDistance) ||
      (score === bestScore && distance === bestDistance && group.weight > (best?.weight || 0))
    ) {
      best = group;
      bestScore = score;
      bestDistance = distance;
    }
  }

  return best;
}

function flatColorMergeThreshold(a: FlatColorStats, b: FlatColorStats) {
  if (a.isNearBlack && b.isNearBlack) return 22;
  if (a.isNearWhite && b.isNearWhite) return 16;
  if (a.luma < 0.18 && b.luma < 0.18 && Math.abs(a.saturation - b.saturation) < 0.3) {
    return 12;
  }
  const saturatedMidTone =
    Math.max(a.saturation, b.saturation) >= 0.55 &&
    !a.isNearBlack &&
    !b.isNearBlack &&
    !a.isNearWhite &&
    !b.isNearWhite;
  const base = saturatedMidTone ? 7 : 9.5;
  return a.isTiny || b.isTiny ? Math.max(base, 12) : base;
}

function flatColorSpatiallyCompatible(stat: FlatColorStats, group: FlatColorGroup, distance: number) {
  const representative = group.representative;
  if (distance <= 3.25) return true;
  if (stat.isNearBlack && representative.isNearBlack) return true;

  const statBlue = isFlatColorBlueFamily(stat);
  const groupBlue = isFlatColorBlueFamily(representative);
  const statNeutral = isFlatColorLightNeutralFamily(stat);
  const groupNeutral = isFlatColorLightNeutralFamily(representative);
  if ((statBlue && groupNeutral) || (groupBlue && statNeutral)) {
    return false;
  }

  const spatial = flatColorSpatialRelation(stat.bbox, group.bbox);
  if (!spatial.known) return true;
  if (spatial.overlaps || spatial.near) return true;

  const smallerWeight = Math.min(stat.weight, group.weight);
  const largerWeight = Math.max(stat.weight, group.weight);
  const smallMeaningfulRegion = smallerWeight / Math.max(1, largerWeight) < 0.18;
  if (smallMeaningfulRegion && distance > 4.75) return false;
  if (!stat.isTiny && distance > 6.5) return false;
  if (stat.isTiny && distance <= 5.5) return true;
  return false;
}

function isFlatColorBlueFamily(stat: FlatColorStats) {
  const hue = rgbHue(stat.rgb);
  return hue >= 175 && hue <= 265 && stat.saturation >= 0.18;
}

function isFlatColorLightNeutralFamily(stat: FlatColorStats) {
  return stat.saturation <= 0.3 && stat.luma >= 0.36 && stat.luma <= 0.92;
}

function flatColorSpatialRelation(a: FlatColorBounds | null, b: FlatColorBounds | null) {
  if (!a || !b) return { known: false, overlaps: false, near: false };
  const xGap = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const yGap = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
  const overlaps = xGap === 0 && yGap === 0;
  const scale = Math.max(
    1,
    Math.sqrt(Math.max(1, flatColorBoundsArea(a))),
    Math.sqrt(Math.max(1, flatColorBoundsArea(b))),
  );
  const normalizedGap = Math.sqrt(xGap * xGap + yGap * yGap) / scale;
  return { known: true, overlaps, near: normalizedGap <= 0.4 };
}

function flatColorBoundsArea(bounds: FlatColorBounds) {
  return Math.max(1, bounds.maxX - bounds.minX) * Math.max(1, bounds.maxY - bounds.minY);
}

function pruneFlatColorGroups(groups: FlatColorGroup[]) {
  while (groups.length > FLAT_COLOR_MAX_EDITABLE_GROUPS) {
    groups.sort((a, b) => a.weight - b.weight || a.pathCount - b.pathCount || a.firstIndex - b.firstIndex);
    const source = groups.shift();
    if (!source) return;
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < groups.length; index += 1) {
      const candidate = groups[index];
      const distance = perceptualDistance(
        source.representative.rgb,
        candidate.representative.rgb,
        "ciede2000",
      );
      const classPenalty =
        source.representative.isNearBlack !== candidate.representative.isNearBlack
          ? 4
          : source.representative.isNearWhite !== candidate.representative.isNearWhite
            ? 3
            : 0;
      const score = distance + classPenalty;
      if (
        score < bestScore ||
        (score === bestScore && candidate.weight > groups[bestIndex].weight) ||
        (score === bestScore && candidate.weight === groups[bestIndex].weight && candidate.firstIndex < groups[bestIndex].firstIndex)
      ) {
        bestIndex = index;
        bestScore = score;
      }
    }
    mergeFlatColorGroup(groups[bestIndex], source);
  }
}

function mergeFlatColorStat(group: FlatColorGroup, stat: FlatColorStats) {
  group.members.push(stat);
  group.weight += stat.weight;
  group.pathCount += stat.pathCount;
  group.firstIndex = Math.min(group.firstIndex, stat.firstIndex);
  group.bbox = mergeFlatColorBounds(group.bbox, stat.bbox);
  group.representative = chooseFlatColorRepresentative(group.members);
}

function mergeFlatColorGroup(target: FlatColorGroup, source: FlatColorGroup) {
  for (const member of source.members) {
    target.members.push(member);
  }
  target.weight += source.weight;
  target.pathCount += source.pathCount;
  target.firstIndex = Math.min(target.firstIndex, source.firstIndex);
  target.bbox = mergeFlatColorBounds(target.bbox, source.bbox);
  target.representative = chooseFlatColorRepresentative(target.members);
}

function chooseFlatColorRepresentative(members: FlatColorStats[]) {
  return [...members].sort(compareFlatColorStatsByImportance)[0];
}

function compareFlatColorStatsByImportance(a: FlatColorStats, b: FlatColorStats) {
  return (
    b.weight - a.weight ||
    b.pathCount - a.pathCount ||
    a.firstIndex - b.firstIndex ||
    a.color.localeCompare(b.color)
  );
}

function readPathFillColor(attrs: string) {
  return normalizeHexColor(
    String(attrs || "").match(/\sfill\s*=\s*(["'])([^"']+)\1/i)?.[2] || "",
  );
}

function writePathFillColor(attrs: string, color: string) {
  const current = String(attrs || "");
  if (/\sfill\s*=/i.test(current)) {
    return current.replace(/\sfill\s*=\s*(["'])[^"']*\1/i, ` fill="${color}"`);
  }
  return `${removeStyleFill(current)} fill="${color}"`;
}

function removeStyleFill(attrs: string) {
  return String(attrs || "").replace(/\sstyle\s*=\s*(["'])([^"']*)\1/i, (match, quote, value) => {
    const declarations = String(value || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !item.toLowerCase().startsWith("fill:"));
    return declarations.length ? ` style=${quote}${declarations.join("; ")}${quote}` : "";
  });
}

function rgbSaturation(color: RGB) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function rgbHue(color: RGB) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta <= 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function annotateSvgLayerIds(svg: string, settings: NormalizedTraceSettings) {
  const colorIds = new Map<string, string>();
  let count = 0;
  return svg.replace(/<path\b([^>]*)>/gi, (match, attrs = "") => {
    const parsed = parseSelfClosingPathAttrs(String(attrs || ""));
    const currentAttrs = parsed.attrs;
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
    return `<path data-fill-layer-id="${id}"${currentAttrs}${parsed.close}`;
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
  return svg.replace(/<path\b([^>]*)>/gi, (match, attrs = "") => {
    const parsed = parseSelfClosingPathAttrs(String(attrs || ""));
    if (isWhiteFill(parsed.attrs)) return match;
    return `<path${stripAttr(parsed.attrs, "fill")} fill="${fill}"${parsed.close}`;
  });
}

function parseSelfClosingPathAttrs(attrs: string): { attrs: string; close: string } {
  const raw = String(attrs || "");
  const selfClosing = /\/\s*$/.test(raw);
  return {
    attrs: selfClosing ? raw.replace(/\s*\/\s*$/, "") : raw,
    close: selfClosing ? " />" : ">",
  };
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

function quantizeLayeredPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: NormalizedTraceSettings,
  options: { layerBuildMode: LayerBuildMode; requestedPaletteCount: number },
): {
  data: Uint8ClampedArray;
  palette: RGB[];
  effectivePaletteCount: number;
  diagnostics: Record<string, unknown>;
} {
  const algorithm = getPaletteAlgorithm(settings);
  const distance = getPaletteDistance(settings);
  const requested = clampInt(options.requestedPaletteCount, 2, 40);
  const effectiveRequested = getSafeLayeredPaletteCount(
    requested,
    width,
    height,
    options.layerBuildMode,
  );
  const transparentPixelMask = buildTransparentPixelMask(data, settings);
  const source = new Uint8ClampedArray(data);
  if (transparentPixelMask) {
    applyTransparentPixelMask(source, transparentPixelMask);
  }
  const pointContainer = imageQUtils.PointContainer.fromUint8Array(source, width, height);
  const palette = buildPaletteSync([pointContainer], {
    colors: effectiveRequested,
    colorDistanceFormula:
      distance === "ciede2000"
        ? "ciede2000"
        : distance === "rgb"
          ? "euclidean"
          : "euclidean-bt709",
    paletteQuantization:
      algorithm === "image-q-rgbquant" ? "rgbquant" : "wuquant",
  });
  const quantized = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula:
      distance === "ciede2000"
        ? "ciede2000"
        : distance === "rgb"
          ? "euclidean"
          : "euclidean-bt709",
    imageQuantization: "nearest",
  }).toUint8Array();
  const out = new Uint8ClampedArray(quantized);
  if (transparentPixelMask) {
    applyTransparentPixelMask(out, transparentPixelMask);
  }
  const initialPalette = collectPaletteFromData(out, settings);
  const mergedPalette = mergePerceptualPalette(
    initialPalette,
    Number(settings.colorMergeTolerance ?? 0),
    distance,
  );

  if (mergedPalette.length > 0) {
    snapPixelsToPalette(out, mergedPalette, distance, settings);
    if (transparentPixelMask) {
      applyTransparentPixelMask(out, transparentPixelMask);
    }
  }

  const morphed = applyLayerMaskProcessing(out, width, height, settings, {
    layerBuildMode: options.layerBuildMode,
    palette: mergedPalette.length ? mergedPalette : initialPalette,
  });
  if (transparentPixelMask) {
    applyTransparentPixelMask(morphed.data, transparentPixelMask);
  }
  const finalPalette = collectPaletteFromData(morphed.data, settings);

  return {
    data: morphed.data,
    palette: finalPalette,
    effectivePaletteCount: effectiveRequested,
    diagnostics: {
      preprocessing: "palette-quantized",
      layerBuildMode: options.layerBuildMode,
      requestedPaletteCount: requested,
      effectivePaletteCount: effectiveRequested,
      paletteAutoCapped: effectiveRequested < requested,
      paletteAlgorithm: algorithm,
      paletteDistance: distance,
      paletteBeforeMerge: initialPalette.length,
      paletteAfterMerge: mergedPalette.length || initialPalette.length,
      actualPaletteCount: finalPalette.length,
      layerOverlapPx: Number(settings.layerOverlapPx ?? 0),
      gapFill: settings.gapFill || "none",
      maskCleanup: morphed.diagnostics,
    },
  };
}

function buildTransparentPixelMask(
  data: Uint8ClampedArray,
  settings: NormalizedTraceSettings,
): Uint8Array | null {
  if (settings.removeTransparent === false && settings.transparent === false) {
    return null;
  }
  const total = Math.floor(data.length / 4);
  const mask = new Uint8Array(total);
  let transparentPixels = 0;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (data[pixel * 4 + 3] >= 18) continue;
    mask[pixel] = 1;
    transparentPixels += 1;
  }
  return transparentPixels > 0 ? mask : null;
}

function applyTransparentPixelMask(data: Uint8ClampedArray, mask: Uint8Array) {
  const total = Math.min(mask.length, Math.floor(data.length / 4));
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (!mask[pixel]) continue;
    const off = pixel * 4;
    data[off] = 255;
    data[off + 1] = 255;
    data[off + 2] = 255;
    data[off + 3] = 0;
  }
}

function applyLayerMaskProcessing(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: NormalizedTraceSettings,
  options: { layerBuildMode: LayerBuildMode; palette: RGB[] },
): { data: Uint8ClampedArray; diagnostics: Record<string, unknown> } {
  const palette = options.palette.length ? options.palette : collectPaletteFromData(data, settings);
  if (!palette.length) return { data, diagnostics: { layerCountBeforeCleanup: 0 } };

  const total = width * height;
  const indices = new Int16Array(total);
  indices.fill(-1);
  const counts = new Array(palette.length).fill(0);
  for (let pixel = 0; pixel < total; pixel += 1) {
    const off = pixel * 4;
    if (data[off + 3] < 18) continue;
    const index = nearestPerceptualPaletteIndex(
      { r: data[off], g: data[off + 1], b: data[off + 2] },
      palette,
      getPaletteDistance(settings),
    );
    indices[pixel] = index;
    counts[index] += 1;
  }

  let layerItems: LayerItem[] = palette.map((color, index) => ({
    color,
    index,
    count: counts[index] || 0,
  }));
  layerItems = layerItems.filter((item) => item.count > 0);
  layerItems.sort((a, b) => sortLayerItemsForWorker(a, b, settings.sortLayersBy));

  const minIslandPx = clampInt(Number(settings.minIslandPx ?? 0), 0, 240);
  const holeFillPx = clampInt(Number(settings.holeFillPx ?? 0), 0, 240);
  const gapCloseStrength = clampInt(Number(settings.gapCloseStrength ?? 0), 0, 3);
  const overlapRadius =
    options.layerBuildMode === "stacked-overlap" || settings.gapFill === "overlap"
      ? clampInt(Math.ceil(Number(settings.layerOverlapPx ?? 0)), 0, 4)
      : 0;
  const closeRadius =
    settings.gapFill === "close-small-gaps" ? Math.max(1, gapCloseStrength) : gapCloseStrength;

  const masks = new Map<number, Mask>();
  for (const item of layerItems) masks.set(item.index, new Uint8Array(total));
  for (let i = 0; i < total; i += 1) {
    const mask = masks.get(indices[i]);
    if (mask) mask[i] = 1;
  }

  let droppedPixels = 0;
  let holesFilled = 0;
  for (const item of layerItems) {
    let mask = masks.get(item.index);
    if (!mask) continue;
    if (minIslandPx > 0) {
      const cleaned = removeTinyComponents(mask, width, height, minIslandPx);
      mask = cleaned.mask;
      droppedPixels += cleaned.droppedPixels;
    }
    if (holeFillPx > 0 || closeRadius > 0) {
      const before = countMaskPixels(mask);
      if (closeRadius > 0) {
        mask = erodeMask(dilateMask(mask, width, height, closeRadius), width, height, closeRadius);
      }
      if (holeFillPx > 0) {
        mask = fillTinyHoles(mask, width, height, holeFillPx);
      }
      holesFilled += Math.max(0, countMaskPixels(mask) - before);
    }
    if (overlapRadius > 0) {
      mask = dilateMask(mask, width, height, overlapRadius);
    }
    masks.set(item.index, mask);
  }

  const out = new Uint8ClampedArray(data.length);
  if (settings.removeTransparent !== false || settings.transparent !== false) {
    for (let i = 0; i < total; i += 1) {
      const off = i * 4;
      out[off] = 255;
      out[off + 1] = 255;
      out[off + 2] = 255;
      out[off + 3] = 0;
    }
  } else {
    for (let i = 0; i < total; i += 1) {
      const off = i * 4;
      out[off] = 255;
      out[off + 1] = 255;
      out[off + 2] = 255;
      out[off + 3] = 255;
    }
  }

  for (const item of layerItems) {
    const mask = masks.get(item.index);
    if (!mask) continue;
    for (let i = 0; i < total; i += 1) {
      if (!mask[i]) continue;
      const off = i * 4;
      out[off] = item.color.r;
      out[off + 1] = item.color.g;
      out[off + 2] = item.color.b;
      out[off + 3] = 255;
    }
  }

  return {
    data: out,
    diagnostics: {
      layerCountBeforeCleanup: palette.length,
      layerCountAfterCleanup: collectPaletteFromData(out, settings).length,
      droppedPixels,
      holesFilled,
      overlapApplied: overlapRadius > 0,
      overlapRadius,
      closeRadius,
      maskBuildMode: "single-pass",
    },
  };
}

function getSafeLayeredPaletteCount(
  requested: number,
  width: number,
  height: number,
  layerBuildMode: LayerBuildMode,
): number {
  const pixels = width * height;
  if (layerBuildMode === "raw-vtracer") return requested;

  let max = layerBuildMode === "per-color-cutout" ? 18 : 28;
  if (pixels > 1_200_000) max = Math.min(max, layerBuildMode === "per-color-cutout" ? 16 : 24);
  if (pixels > 2_000_000) max = Math.min(max, layerBuildMode === "per-color-cutout" ? 14 : 22);
  if (pixels > 3_000_000) max = Math.min(max, layerBuildMode === "per-color-cutout" ? 12 : 20);
  return clampInt(Math.min(requested, max), 2, requested);
}

function removeTinyComponents(
  mask: Mask,
  width: number,
  height: number,
  minSize: number,
): { mask: Mask; droppedPixels: number } {
  const out = new Uint8Array(mask);
  const visited = new Uint8Array(mask.length);
  const stack: number[] = [];
  const component: number[] = [];
  let droppedPixels = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!out[i] || visited[i]) continue;
    stack.length = 0;
    component.length = 0;
    stack.push(i);
    visited[i] = 1;
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (const next of [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1,
      ]) {
        if (next < 0 || visited[next] || !out[next]) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }
    if (component.length < minSize) {
      droppedPixels += component.length;
      for (const pixel of component) out[pixel] = 0;
    }
  }
  return { mask: out, droppedPixels };
}

function fillTinyHoles(mask: Mask, width: number, height: number, maxHoleSize: number): Mask {
  const inverse = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) inverse[i] = mask[i] ? 0 : 1;
  const cleaned = removeTinyComponents(inverse, width, height, maxHoleSize);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) out[i] = cleaned.mask[i] ? 0 : 1;
  return out;
}

function dilateMask(mask: Mask, width: number, height: number, radius: number): Mask {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
          out[yy * width + xx] = 1;
        }
      }
    }
  }
  return out;
}

function erodeMask(mask: Mask, width: number, height: number, radius: number): Mask {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = true;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius) && keep; yy += 1) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
          if (!mask[yy * width + xx]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) out[y * width + x] = 1;
    }
  }
  return out;
}

function countMaskPixels(mask: Mask): number {
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) count += mask[i] ? 1 : 0;
  return count;
}

function countSvgPaths(svg: string): number {
  return (String(svg || "").match(/<path\b/gi) || []).length;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(String(value || "")).byteLength;
}

function countUniqueSvgFills(svg: string, settings: NormalizedTraceSettings): number {
  const fills = new Set<string>();
  const pathPattern = /<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathPattern.exec(svg))) {
    const fill = normalizeHexColor(
      match[1].match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1] || "",
    );
    if (!fill || isBackgroundColor(fill, settings)) continue;
    fills.add(fill);
  }
  return fills.size;
}

function buildTraceDiagnostics(input: {
  settings: NormalizedTraceSettings;
  prepared: PreparedImage;
  decodedWidth: number;
  decodedHeight: number;
  pathCount: number;
  svgBytes: number;
  layerCount: number;
}): Record<string, unknown> {
  if (input.settings.traceDiagnosticsMode !== "summary") return {};
  return {
    engine: "vtracer",
    traceMode: input.settings.traceMode || "single",
    layerBuildMode: input.prepared.layerBuildMode,
    requestedPaletteCount: input.prepared.requestedPaletteCount || undefined,
    decodedWidth: input.decodedWidth,
    decodedHeight: input.decodedHeight,
    pathCount: input.pathCount,
    svgBytes: input.svgBytes,
    layerCount: input.layerCount,
    effectivePaletteCount: input.prepared.effectivePaletteCount,
    ...input.prepared.diagnostics,
  };
}

function getLayerBuildMode(settings: NormalizedTraceSettings): LayerBuildMode {
  if (
    settings.layerBuildMode === "per-color-cutout" ||
    settings.layerBuildMode === "stacked-overlap" ||
    settings.layerBuildMode === "raw-vtracer"
  ) {
    return settings.layerBuildMode;
  }
  return "raw-vtracer";
}

function getRequestedPaletteCount(settings: NormalizedTraceSettings): number {
  const requested = Number(settings.requestedPaletteCount || settings.colorLayerCount || 0);
  if (!Number.isFinite(requested) || requested <= 0) return 0;
  return clampInt(requested, 2, 40);
}

function getPaletteAlgorithm(settings: NormalizedTraceSettings): PaletteAlgorithm {
  if (settings.paletteAlgorithm === "image-q-rgbquant") return "image-q-rgbquant";
  if (settings.paletteAlgorithm === "image-q-wuquant") return "image-q-wuquant";
  if (settings.paletteAlgorithm === "simple-posterize") {
    return getLayerBuildMode(settings) === "raw-vtracer"
      ? "simple-posterize"
      : "image-q-wuquant";
  }
  return "image-q-wuquant";
}

function getPaletteDistance(settings: NormalizedTraceSettings): PaletteDistance {
  if (
    settings.paletteDistance === "ciede2000" ||
    settings.paletteDistance === "bt709" ||
    settings.paletteDistance === "rgb"
  ) {
    return settings.paletteDistance;
  }
  return getPaletteAlgorithm(settings) === "simple-posterize" ? "bt709" : "ciede2000";
}

function collectPaletteFromData(
  data: Uint8ClampedArray,
  settings: NormalizedTraceSettings,
): RGB[] {
  const counts = new Map<string, { color: RGB; count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 18) continue;
    const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const hex = rgbToHex(color);
    if (isBackgroundColor(hex, settings)) continue;
    const current = counts.get(hex);
    if (current) current.count += 1;
    else counts.set(hex, { color, count: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.color)
    .slice(0, 64);
}

function mergePerceptualPalette(
  palette: RGB[],
  tolerance: number,
  distance: PaletteDistance,
): RGB[] {
  const mergeTolerance = clampNumber(Number(tolerance || 0), 0, 80);
  if (mergeTolerance <= 0 || palette.length <= 1) return palette;
  const merged: RGB[] = [];
  for (const color of palette) {
    let mergedIntoExisting = false;
    for (let i = 0; i < merged.length; i += 1) {
      if (perceptualDistance(color, merged[i], distance) > mergeTolerance) continue;
      merged[i] = {
        r: clampByte((merged[i].r + color.r) / 2),
        g: clampByte((merged[i].g + color.g) / 2),
        b: clampByte((merged[i].b + color.b) / 2),
      };
      mergedIntoExisting = true;
      break;
    }
    if (!mergedIntoExisting) merged.push(color);
  }
  return merged;
}

function snapPixelsToPalette(
  data: Uint8ClampedArray,
  palette: RGB[],
  distance: PaletteDistance,
  settings: NormalizedTraceSettings,
) {
  if (!palette.length) return;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 18) continue;
    const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
    if (isBackgroundColor(rgbToHex(color), settings)) continue;
    const nearest = palette[nearestPerceptualPaletteIndex(color, palette, distance)];
    data[i] = nearest.r;
    data[i + 1] = nearest.g;
    data[i + 2] = nearest.b;
  }
}

function nearestPerceptualPaletteIndex(
  color: RGB,
  palette: RGB[],
  distance: PaletteDistance,
): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i += 1) {
    const currentDistance = perceptualDistance(color, palette[i], distance);
    if (currentDistance >= bestDistance) continue;
    bestDistance = currentDistance;
    bestIndex = i;
  }
  return bestIndex;
}

function sortLayerItemsForWorker(
  a: LayerItem,
  b: LayerItem,
  sortBy: NormalizedTraceSettings["sortLayersBy"],
): number {
  if (sortBy === "original") return a.index - b.index;
  if (sortBy === "luminance") {
    const luminanceDiff = luminance(a.color) - luminance(b.color);
    if (Math.abs(luminanceDiff) > 0.01) return luminanceDiff;
  }
  return b.count - a.count;
}

function perceptualDistance(a: RGB, b: RGB, distance: PaletteDistance): number {
  if (distance === "rgb") return colorDistance(a, b);
  if (distance === "bt709") {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr * 0.2126 + dg * dg * 0.7152 + db * db * 0.0722);
  }
  return ciede2000Difference(
    { mode: "rgb", r: a.r / 255, g: a.g / 255, b: a.b / 255 },
    { mode: "rgb", r: b.r / 255, g: b.g / 255, b: b.b / 255 },
  );
}

function luminance(color: RGB): number {
  return (color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722) / 255;
}

function rgbToHex(color: RGB): string {
  return `#${toHexPair(color.r)}${toHexPair(color.g)}${toHexPair(color.b)}`;
}

function toHexPair(value: number): string {
  return clampByte(value).toString(16).padStart(2, "0");
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

function escapeSvgAttribute(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
