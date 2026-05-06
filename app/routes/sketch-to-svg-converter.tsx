import * as React from "react";
import type { Route } from "./+types/sketch-to-svg-converter";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import {
  annotateSharedSingleTraceSvg as annotateSharedSingleTraceSvgShared,
  neutralizeTransparencyCheckerboard as neutralizeTransparencyCheckerboardShared,
  runSharedLayeredColorTrace as runSharedLayeredColorTraceShared,
  runSharedPotraceSvgTrace as runSharedPotraceSvgTraceShared,
  runSharedRasterNormalization as runSharedRasterNormalizationShared,
} from "~/shared/tracing/serverFallback";
import { Link, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import {
  LayerPaletteEditor,
  LayeredTraceControls,
  type EditableSvgLayer,
  type SvgLayerMeta,
  type TraceMode,
} from "~/client/components/svg/LayerPaletteEditor";
import {
  getPresetLabelById,
  PresetPicker,
} from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import {
  getTraceOutputSvg,
  replaceTraceOutputCurrent,
  stepTraceOutputVersion,
  TraceOutputPanel,
  type TraceOutputItem,
  type TraceOutputLayerPatch,
} from "~/client/components/converter/TraceOutputPanel";
import { EditedSvgPreviewImage, getEditedSvg } from "~/client/components/svg/EditedSvgPreviewImage";
import { extendTracePresets } from "~/client/lib/converter/presetAdditions";
import { TraceAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import { useHybridTraceFetcher } from "~/client/lib/tracing/useHybridTraceFetcher";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  appendAdvancedTraceSettings,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";

const isServer = typeof document === "undefined";

export function meta({}: Route.MetaArgs) {
  const title = "Sketch to SVG Converter - Pencil and Ink Sketches | iLoveSVG";
  const description =
    "Convert hand sketches, pencil lines, marker drawings, and scanned artwork into SVG with sketch-tuned cleanup, smoothing, preview, and download.";
  const canonical = "https://www.ilovesvg.com/sketch-to-svg-converter";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { name: "robots", content: "index,follow" },

    // Canonical
    { tagName: "link", rel: "canonical", href: canonical },

    // OpenGraph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  return {
    origin: "https://www.ilovesvg.com",
    canonicalUrl: `https://www.ilovesvg.com/sketch-to-svg-converter`,
  };
}

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);
const DARK_BG_DEFAULT = "#0b1020";

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 400;
const LIVE_MED_MS = 1500;

type ReleaseFn = () => void;
type Gate = {
  acquireOrQueue: () => Promise<ReleaseFn>;
  running: number;
  queued: number;
};

async function getGate(): Promise<Gate> {
  const { getConversionGate } = await import("~/utils/conversionGate.server");
  return getConversionGate();
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method.toUpperCase() !== "POST") {
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return json(
        { error: "Unsupported content type. Use multipart/form-data." },
        { status: 415 },
      );
    }

    const {
      checkBackendConversionRateLimit,
      createRateLimitedResponse,
      validateSameOrigin,
      validateMultipartFileCount,
      validateUploadedFileBasics,
      validateFileSignature,
    } = await import("~/utils/backendSecurity.server");

    const originError = validateSameOrigin(request);
    if (originError) return originError;

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "sketch-to-svg-converter",
      "raster-trace"
    );
    if (!rateLimit.allowed) return createRateLimitedResponse(rateLimit);

    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        {
          error:
            "Upload too large for live conversion. Please resize and try again.",
        },
        { status: 413 },
      );
    }

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const fileCountError = validateMultipartFileCount(form);
    if (fileCountError) return fileCountError;

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No file uploaded." }, { status: 400 });
    }

    const webFile = file as File;
    const uploadError = validateUploadedFileBasics(webFile, {
      allowedMimeTypes: ALLOWED_MIME,
      maxBytes: MAX_UPLOAD_BYTES,
      label: "supported image",
    });
    if (uploadError) return uploadError;
    if (!ALLOWED_MIME.has(webFile.type)) {
      return json(
        { error: "Only PNG or JPEG images are allowed." },
        { status: 415 },
      );
    }
    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB per image.`,
        },
        { status: 413 },
      );
    }

    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1000, Number(e?.retryAfterMs) || 1500);
      return json(
        {
          error:
            "Server is busy converting other images. We'll retry automatically.",
          retryAfterMs,
          code: "BUSY",
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
        },
      );
    }

    try {
      const ab = await webFile.arrayBuffer();
      // @ts-ignore
      let input: Buffer = Buffer.from(ab);
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      try {
        const { getSharp } = await import("~/utils/conversionModules.server");
      const sharp = await getSharp();
        const meta = await sharp(input).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;

        if (!w || !h) {
          return json(
            { error: "Could not read image dimensions. Try a different file." },
            { status: 415 },
          );
        }

        if (w < 2 || h < 2) {
          return json(
            {
              error:
                "Image is too small to trace safely. Please upload an image at least 2x2 pixels.",
            },
            { status: 415 },
          );
        }

        const mp = (w * h) / 1_000_000;
        if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
          return json(
            {
              error: `Image too large: ${w}×${h} (~${mp.toFixed(
                1,
              )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {}

      const threshold = Number(form.get("threshold") ?? 224);
      const turdSize = Number(form.get("turdSize") ?? 2);
      const optTolerance = Number(form.get("optTolerance") ?? 0.28);
      const turnPolicy = String(form.get("turnPolicy") ?? "minority") as
        | "black"
        | "white"
        | "left"
        | "right"
        | "minority"
        | "majority";

      const whiteOnDark =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      let lineColor = String(form.get("lineColor") ?? "#000000");

      let transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      let bgColor = String(form.get("bgColor") ?? "#ffffff");

      const preprocess = String(form.get("preprocess") ?? "none") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 0.8);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.0);
      const {
        applyTraceSvgOutputSettings,
        readAdvancedTraceFormSettings,
        shouldRemoveSelectedColors,
      } = await import("../utils/converterSettings.server");
      const advancedTraceSettings = readAdvancedTraceFormSettings(form);

      const traceMode = String(form.get("traceMode") ?? "single") as TraceMode;
      const routeLayeredTrace = runSharedLayeredColorTraceShared;
      const routeAnnotateSingleTrace = annotateSharedSingleTraceSvgShared;
      const colorLayerCount = Number(form.get("colorLayerCount") ?? 5);
      const layerMaxTraceSide = Number(form.get("layerMaxTraceSide") ?? 1600);
      const minRegionPercent = Number(form.get("minRegionPercent") ?? 0.35);
      const layerOptTolerance = Number(form.get("layerOptTolerance") ?? 0.45);
      const layerTurdSize = Number(form.get("layerTurdSize") ?? 4);
      const layerTurnPolicy = String(
        form.get("layerTurnPolicy") ?? "majority",
      ) as Settings["layerTurnPolicy"];
      const posterize =
        String(form.get("posterize") ?? "true").toLowerCase() === "true";
      const removeWhite =
        String(form.get("removeWhite") ?? "false").toLowerCase() === "true";
      const removeTransparent =
        String(form.get("removeTransparent") ?? "true").toLowerCase() ===
        "true";

      if (traceMode === "layered") {
        const routeLayeredTraceAdapter = runSharedLayeredColorTraceShared;
        const layered = await routeLayeredTraceAdapter(input, {
          layerCount: Math.round(colorLayerCount),
          maxTraceSide: Math.round(layerMaxTraceSide),
          minRegionPercent,
          optTolerance: layerOptTolerance,
          turdSize: Math.round(layerTurdSize),
          posterize,
          removeWhite,
          removeTransparent,
          transparent,
          bgColor,
          turnPolicy: layerTurnPolicy,
          removeColors: shouldRemoveSelectedColors(advancedTraceSettings, "layered")
            ? advancedTraceSettings.removeColors
            : [],
          removeColorTolerance: advancedTraceSettings.removeColorTolerance,
          layerAlpha: advancedTraceSettings.layerAlpha,
          backgroundAlpha: advancedTraceSettings.backgroundAlpha,
          colorMergeTolerance: advancedTraceSettings.colorMergeTolerance,
          posterizeStrength: advancedTraceSettings.posterizeStrength,
          sortLayersBy: advancedTraceSettings.sortLayersBy,
          brightness: advancedTraceSettings.brightness,
          contrast: advancedTraceSettings.contrast,
          outputWidth: advancedTraceSettings.outputWidth,
          outputHeight: advancedTraceSettings.outputHeight,
          preserveAspectRatio: advancedTraceSettings.preserveAspectRatio,
        });

        return json({
          svg: layered.svg,
          layers: layered.layers,
          width: layered.width,
          height: layered.height,
          engineUsed: "potrace",
          sourceKind: "raster",
          gate: { running: gate.running, queued: gate.queued },
        });
      }

      if (whiteOnDark) {
        transparent = false;
        if (
          !bgColor ||
          bgColor.toLowerCase() === "#ffffff" ||
          bgColor.toLowerCase() === "#fff"
        ) {
          bgColor = DARK_BG_DEFAULT;
        }
        if (!lineColor || lineColor.toLowerCase() === "#000000") {
          lineColor = "#ffffff";
        }
      }

      const routeRasterNormalize = runSharedRasterNormalizationShared;
      const prepped = await routeRasterNormalize(input, {
        preprocess,
        blurSigma,
        edgeBoost,
        threshold,
        maxTraceSide: advancedTraceSettings.maxTraceSide,
        removeColors: shouldRemoveSelectedColors(advancedTraceSettings, "single")
          ? advancedTraceSettings.removeColors
          : [],
        removeColorTolerance: advancedTraceSettings.removeColorTolerance,
        brightness: advancedTraceSettings.brightness,
        contrast: advancedTraceSettings.contrast,
        edgeThreshold: advancedTraceSettings.edgeThreshold,
        edgeThickness: advancedTraceSettings.edgeThickness,
        noiseReduction: advancedTraceSettings.noiseReduction,
        gapCloseStrength: advancedTraceSettings.gapCloseStrength,
        minIslandPx: advancedTraceSettings.minIslandPx,
        holeFillPx: advancedTraceSettings.holeFillPx,
      });

      const routePotraceTrace = runSharedPotraceSvgTraceShared;
      const opts: any = {
        color: "#000000",
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert: false,
        blackOnWhite: true,
      };

      const svgRaw: string = await routePotraceTrace(prepped, opts);

      const safeSvg = coerceSvg(svgRaw);
      const ensured = ensureViewBoxResponsive(safeSvg);
      const svg2 = recolorPaths(ensured.svg, lineColor);
      const svg3 = stripFullWhiteBackgroundRect(
        svg2,
        ensured.width,
        ensured.height,
      );
      const finalSVG = transparent
        ? svg3
        : injectBackgroundRectString(
            svg3,
            ensured.width,
            ensured.height,
            bgColor,
          );

      const editable = routeAnnotateSingleTrace(finalSVG, lineColor);
      const adjusted = applyTraceSvgOutputSettings(editable.svg, advancedTraceSettings, {
        width: ensured.width,
        height: ensured.height,
      });

      return json({
        svg: adjusted.svg,
        layers: editable.layers,
        width: adjusted.width,
        height: adjusted.height,
        engineUsed: "potrace",
        sourceKind: "raster",
        gate: { running: gate.running, queued: gate.queued },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    const { safeErrorMessage } = await import("~/utils/backendSecurity.server");
    return json(
      { error: safeErrorMessage(err?.message || "Server error during conversion.", "Server error during conversion.") },
      { status: 500 },
    );
  }
}

async function normalizeForPotrace(
  input: Buffer,
  _opts: {
    preprocess: "none" | "edge";
    blurSigma: number;
    edgeBoost: number;
    threshold?: number;
    maxTraceSide?: number;
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
  },
): Promise<Buffer> {
  return input;
}

function isFlatBuffer(buf: Buffer, sampleStep = 53): boolean {
  const len = buf.length;
  if (len === 0) return true;

  let min = 255;
  let max = 0;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < len; i += sampleStep) {
    const v = buf[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    count++;
  }

  const mean = sum / Math.max(count, 1);
  const range = max - min;

  if (range <= 2) return true;
  if (mean <= 8 || mean >= 247) return true;

  let varSum = 0;
  for (let i = 0; i < len; i += sampleStep) {
    const v = buf[i] - mean;
    varSum += v * v;
  }
  const variance = varSum / Math.max(count - 1, 1);
  return variance < 8;
}

function coerceSvg(svgRaw: string | null | undefined): string {
  const fallback =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"></svg>';
  if (!svgRaw) return fallback;
  const trimmed = String(svgRaw).trim();
  if (/^<svg\b/i.test(trimmed)) return trimmed;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${trimmed}</svg>`;
}

function ensureViewBoxResponsive(svg: string): {
  svg: string;
  width: number;
  height: number;
} {
  const openTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return { svg, width: 1024, height: 1024 };

  const openTag = openTagMatch[0];
  const hasViewBox = /viewBox\s*=\s*["'][^"']*["']/.test(openTag);
  const widthMatch = openTag.match(/width\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
  const heightMatch = openTag.match(/height\s*=\s*["'](\d+(\.\d+)?)(px)?["']/i);
  let width = widthMatch ? Number(widthMatch[1]) : 1024;
  let height = heightMatch ? Number(heightMatch[1]) : 1024;

  let newOpen = openTag;

  if (!hasViewBox) {
    newOpen = newOpen.replace(
      /<svg\b/i,
      `<svg viewBox="0 0 ${Math.round(width)} ${Math.round(height)}"`,
    );
  }

  newOpen = newOpen
    .replace(/\swidth\s*=\s*["'][^"']*["']/i, "")
    .replace(/\sheight\s*=\s*["'][^"']*["']/i, "");

  const newSVG = svg.replace(openTag, newOpen);
  return { svg: newSVG, width, height };
}

function recolorPaths(svg: string, fillColor: string): string {
  let out = svg.replace(
    /<path\b([^>]*?)\sfill\s*=\s*["'][^"']*["']([^>]*?)>/gi,
    (_m, a, b) => `<path${a} fill="${fillColor}"${b}>`,
  );
  out = out.replace(
    /<path\b((?:(?!>)[\s\S])*?)>(?![\s\S]*?<\/path>)/gi,
    (m, attrs) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `<path${attrs} fill="${fillColor}">`;
    },
  );
  return out;
}

function stripFullWhiteBackgroundRect(
  svg: string,
  width: number,
  height: number,
): string {
  const whitePattern =
    /(#ffffff|#fff|white|rgb\(255\s*,\s*255\s*,\s*255\)|rgba\(255\s*,\s*255\s*,\s*255\s*,\s*1\))/i;

  const numeric = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0["'][^>]*y\\s*=\\s*["']0["'][^>]*width\\s*=\\s*["']${escapeReg(
      String(width),
    )}["'][^>]*height\\s*=\\s*["']${escapeReg(
      String(height),
    )}["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig",
  );

  const percent = new RegExp(
    `<rect\\b[^>]*x\\s*=\\s*["']0%?["'][^>]*y\\s*=\\s*["']0%?["'][^>]*width\\s*=\\s*["']100%["'][^>]*height\\s*=\\s*["']100%["'][^>]*fill\\s*=\\s*["']${whitePattern.source}["'][^>]*>`,
    "ig",
  );

  return svg.replace(numeric, "").replace(percent, "");
}

function injectBackgroundRectString(
  svg: string,
  width: number,
  height: number,
  color: string,
): string {
  const openTagMatch = svg.match(/<svg\b[^>]*>/i);
  if (!openTagMatch) return svg;
  const openTag = openTagMatch[0];

  const rect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${color}"/>`;
  const idx = svg.indexOf(openTag) + openTag.length;
  return svg.slice(0, idx) + rect + svg.slice(idx);
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Settings = TraceAdvancedSettings & {
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  lineColor: string;
  invert: boolean;
  traceMode: TraceMode;
  colorLayerCount: number;
  layerMaxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy:
    | "black"
    | "white"
    | "left"
    | "right"
    | "minority"
    | "majority";
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;

  transparent: boolean;
  bgColor: string;
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
};

type Preset = { id: string; label: string; settings: Partial<Settings> };

const PRESETS: Preset[] = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    settings: {
      traceMode: "layered",
      colorLayerCount: 5,
      layerMaxTraceSide: 1600,
      minRegionPercent: 0.35,
      layerOptTolerance: 0.45,
      layerTurdSize: 4,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "layered-color-smoother",
    label: "Layered color SVG - Smoother",
    settings: {
      traceMode: "layered",
      colorLayerCount: 4,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.55,
      layerOptTolerance: 0.65,
      layerTurdSize: 7,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "layered-color-detail",
    label: "Layered color SVG - More detail",
    settings: {
      traceMode: "layered",
      colorLayerCount: 8,
      layerMaxTraceSide: 2000,
      minRegionPercent: 0.2,
      layerOptTolerance: 0.32,
      layerTurdSize: 2,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "layered-color-fewer",
    label: "Layered color SVG - Fewer larger layers",
    settings: {
      traceMode: "layered",
      colorLayerCount: 3,
      layerMaxTraceSide: 1200,
      minRegionPercent: 0.8,
      layerOptTolerance: 0.75,
      layerTurdSize: 9,
      layerTurnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      invert: false,
    },
  },
  {
    id: "sketch-pencil-light",
    label: "Sketch  -  Pencil (light)",
    settings: {
      preprocess: "edge",
      blurSigma: 1.2,
      edgeBoost: 1.4,
      threshold: 210,
      turdSize: 2,
      optTolerance: 0.42,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "sketch-pen-clean",
    label: "Sketch  -  Pen (clean)",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 2,
      optTolerance: 0.28,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "sketch-marker-bold",
    label: "Sketch  -  Marker (bold)",
    settings: {
      preprocess: "none",
      threshold: 212,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "sketch-gap-seal",
    label: "Sketch  -  Seal gaps",
    settings: {
      preprocess: "none",
      threshold: 218,
      turdSize: 4,
      optTolerance: 0.36,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "scan-clean",
    label: "Scan  -  Clean (remove speckles)",
    settings: {
      preprocess: "none",
      threshold: 226,
      turdSize: 4,
      optTolerance: 0.3,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "whiteboard",
    label: "Whiteboard  -  Anti-glare",
    settings: {
      preprocess: "edge",
      blurSigma: 1.3,
      edgeBoost: 1.15,
      threshold: 220,
      turdSize: 2,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#0f172a",
      invert: false,
    },
  },
  {
    id: "invert-white-on-black",
    label: "Invert  -  White lines on dark",
    settings: {
      preprocess: "none",
      threshold: 225,
      turdSize: 2,
      optTolerance: 0.3,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
];

const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS, { includeStrokePresets: true });

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  threshold: 224,
  turdSize: 2,
  optTolerance: 0.28,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,
  traceMode: "single",
  colorLayerCount: 5,
  layerMaxTraceSide: 1600,
  minRegionPercent: 0.35,
  layerOptTolerance: 0.45,
  layerTurdSize: 4,
  layerTurnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,

  transparent: true,
  bgColor: "#ffffff",
  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1.0,
};

const routeCapabilities = getRouteCapabilities("sketch-to-svg-converter");

type ServerResult = {
  svg?: string;
  layers?: SvgLayerMeta[];
  error?: string;
  width?: number;
  height?: number;
  engineUsed?: "vtracer" | "potrace" | "centerline";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  engineUsed?: "vtracer" | "potrace" | "centerline";
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  stamp: number;
  sourceFileName?: string;
};

type AutoMode = "fast" | "medium" | "off";
function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}
function autoModeHint(mode: AutoMode): string {
  if (mode === "medium")
    return "Live preview is throttled for 10 to 25 MB files.";
  if (mode === "off")
    return "File is large. We will try on-device compression.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Updates run less frequently to keep things smooth.";
  return "";
}

export default function SketchToSvgConverter({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useHybridTraceFetcher<ServerResult>({ routeId: "sketch-to-svg-converter" });
  const [file, setFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("sketch-pencil-light");
  const busy = fetcher.state !== "idle";
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);

  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [updatingOutputStamp, setUpdatingOutputStamp] = React.useState<
    number | null
  >(null);
  const pendingReplaceStampRef = React.useRef<number | null>(null);
  const pendingOutputSettingsRef = React.useRef<Settings | null>(null);
  const pendingSourceFileNameRef = React.useRef<string | null>(null);
  const lastHandledResultKeyRef = React.useRef<string | null>(null);
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);

  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const resultKey = `${fetcher.data.svg}:${fetcher.data.width ?? ""}:${fetcher.data.height ?? ""}`;
      if (lastHandledResultKeyRef.current === resultKey) return;
      lastHandledResultKeyRef.current = resultKey;

      const settingsSnapshot = pendingOutputSettingsRef.current ?? settings;
      const replaceStamp = pendingReplaceStampRef.current;
      const item: HistoryItem & TraceOutputItem<Settings> = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        engineUsed: fetcher.data.engineUsed,
        sourceKind: fetcher.data.sourceKind,
        warnings: fetcher.data.warnings,
        timings: fetcher.data.timings,
        layerBuildMode: fetcher.data.layerBuildMode,
        requestedPaletteCount: fetcher.data.requestedPaletteCount,
        actualPaletteCount: fetcher.data.actualPaletteCount,
        outputDetectedColors: fetcher.data.outputDetectedColors,
        pathCount: fetcher.data.pathCount,
        svgBytes: fetcher.data.svgBytes,
        stamp: Date.now(),
        sourceFileName: pendingSourceFileNameRef.current ?? undefined,
        presetLabel: getPresetLabelById(DISPLAY_PRESETS, activePreset),
        layers: (fetcher.data.layers ?? []).map((layer) => ({ ...layer })),
      
        settingsSnapshot,
        draftSettings: settingsSnapshot,
      };
      setHistory((prev) => {
        if (replaceStamp) {
          return prev.map((existing) =>
            existing.stamp === replaceStamp
              ? (replaceTraceOutputCurrent(
                  existing as HistoryItem & TraceOutputItem<Settings>,
                  item,
                ) as HistoryItem)
              : existing,
          );
        }

        return [item, ...prev].slice(0, 10);
      });

      pendingReplaceStampRef.current = null;
      pendingOutputSettingsRef.current = null;
      pendingSourceFileNameRef.current = null;
      setUpdatingOutputStamp(null);
    }
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    if (!fetcher.data?.error || !pendingReplaceStampRef.current) return;

    const replaceStamp = pendingReplaceStampRef.current;
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === replaceStamp
          ? {
              ...item,
              updateError:
                fetcher.data?.error ||
                "Could not update this output. The current preview was preserved.",
            }
          : item,
      ),
    );
    pendingReplaceStampRef.current = null;
    pendingOutputSettingsRef.current = null;
    pendingSourceFileNameRef.current = null;
    setUpdatingOutputStamp(null);
  }, [fetcher.data?.error]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!fileRef.current) return;

    const mode = autoMode;
    if (mode === "off") return;

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitConvert(fileRef.current);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [autoMode, file]);

  async function measureAndSet(f: File) {
    try {
      const { w, h } = await getImageSize(f);
      const mp = (w * h) / 1_000_000;
      setDims({ w, h, mp });
    } catch {
      setDims(null);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    await handleNewFile(f);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await handleNewFile(f);
  }

  async function handleNewFile(f: File) {
    if (!ALLOWED_MIME.has(f.type)) {
      setErr("Please choose a PNG or JPEG.");
      return;
    }

    suppressLiveRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setErr(null);
    setInfo(null);
    setDims(null);

    setSettings(DEFAULTS);
    setActivePreset("sketch-pencil-light");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    setOriginalFileSize(f.size);

    let chosen = f;

    try {
      if (chosen.size > LIVE_MED_MAX) {
        chosen = await compressToTarget25MB(chosen);
      }
      if (chosen.size > MAX_UPLOAD_BYTES) {
        setErr("File too large. Please resize and try again.");
        setFile(null);
        fileRef.current = null;
        setAutoMode("off");
        return;
      }
    } catch (e: any) {
      setErr(e?.message || "Could not prepare this image for preview.");
      setFile(null);
      fileRef.current = null;
      setAutoMode("off");
      return;
    }

    fileRef.current = chosen;
    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);

    suppressLiveRef.current = false;
    submitConvert(chosen);
  }

  async function submitConvert(f?: File | null, settingsOverride?: Settings) {
    const current = f || fileRef.current;
    const currentSettings = settingsOverride ?? settings;
    if (!current) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(current);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
      return;
    }

    const effective = (() => {
      if (currentSettings.traceMode === "layered" || !currentSettings.invert) return currentSettings;
      const bg =
        !currentSettings.bgColor ||
        currentSettings.bgColor.toLowerCase() === "#ffffff" ||
        currentSettings.bgColor.toLowerCase() === "#fff"
          ? DARK_BG_DEFAULT
          : currentSettings.bgColor;

      return {
        ...currentSettings,
        transparent: false,
        bgColor: bg,
        lineColor:
          currentSettings.lineColor?.toLowerCase() === "#000000"
            ? "#ffffff"
            : currentSettings.lineColor,
      };
    })();

    pendingSourceFileNameRef.current = current.name;

    const fd = new FormData();
    fd.append("file", current);
    fd.append("threshold", String(effective.threshold));
    fd.append("turdSize", String(effective.turdSize));
    fd.append("optTolerance", String(effective.optTolerance));
    fd.append("turnPolicy", effective.turnPolicy);
    fd.append("lineColor", effective.lineColor);
    fd.append("invert", String(effective.invert));
    fd.append("traceMode", effective.traceMode);
    fd.append("colorLayerCount", String(effective.colorLayerCount));
    fd.append("layerMaxTraceSide", String(effective.layerMaxTraceSide));
    fd.append("minRegionPercent", String(effective.minRegionPercent));
    fd.append("layerOptTolerance", String(effective.layerOptTolerance));
    fd.append("layerTurdSize", String(effective.layerTurdSize));
    fd.append("layerTurnPolicy", effective.layerTurnPolicy);
    fd.append("posterize", String(effective.posterize));
    fd.append("removeWhite", String(effective.removeWhite));
    fd.append("removeTransparent", String(effective.removeTransparent));
    fd.append("transparent", String(effective.transparent));
    fd.append("bgColor", effective.bgColor);
    fd.append("preprocess", effective.preprocess);
    fd.append("blurSigma", String(effective.blurSigma));
    fd.append("edgeBoost", String(effective.edgeBoost));
    appendAdvancedTraceSettings(fd, effective);
    fd.append("presetId", activePreset);

    setErr(null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !fileRef.current;

  function buildPresetSettings(preset: Preset): Settings {
    return {
      ...DEFAULTS,
      traceMode: preset.settings.traceMode ?? "single",
      ...preset.settings,
    } as Settings;
  }

  function applyPreset(preset: Preset) {
    const nextSettings = buildPresetSettings(preset);
    setActivePreset(preset.id);
    setSettings(nextSettings);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (file && autoMode !== "off") {
      void submitConvert(file, nextSettings);
    }
  }

  const [toast, setToast] = React.useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => showToast("SVG copied"));
  }

  function getHistoryItemSvg(item: HistoryItem): string {
    return getTraceOutputSvg(item as HistoryItem & TraceOutputItem<Settings>);
  }

  function toggleOutputSettings(stamp: number) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              settingsOpen: !(item as HistoryItem & TraceOutputItem<Settings>)
                .settingsOpen,
            }
          : item,
      ),
    );
  }

  function updateOutputDraftSettings(
    stamp: number,
    updater: React.SetStateAction<Settings>,
  ) {
    setHistory((prev) =>
      prev.map((item) => {
        if (item.stamp !== stamp) return item;

        const outputItem = item as HistoryItem & TraceOutputItem<Settings>;
        const current =
          outputItem.draftSettings ?? outputItem.settingsSnapshot ?? settings;
        const next =
          typeof updater === "function"
            ? (updater as (value: Settings) => Settings)(current)
            : updater;

        return {
          ...item,
          draftSettings: next,
        };
      }),
    );
  }

  function submitOutputUpdate(stamp: number) {
    const item = history.find((candidate) => candidate.stamp === stamp) as
      | (HistoryItem & TraceOutputItem<Settings>)
      | undefined;
    if (!item) return;

    const nextSettings =
      item.draftSettings ?? item.settingsSnapshot ?? settings;
    pendingReplaceStampRef.current = stamp;
    pendingOutputSettingsRef.current = nextSettings;
    setUpdatingOutputStamp(stamp);
    void submitConvert(file, nextSettings);
  }

  function stepOutputVersion(stamp: number, direction: "previous" | "next") {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? (stepTraceOutputVersion(
              item as HistoryItem & TraceOutputItem<Settings>,
              direction,
            ) as HistoryItem)
          : item,
      ),
    );
  }

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: TraceOutputLayerPatch,
  ) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp !== stamp
          ? item
          : {
              ...item,
              layers: item.layers?.map((layer) =>
                layer.id === layerId ? { ...layer, ...patch } : layer,
              ),
            },
      ),
    );
  }

  function resetHistoryLayer(stamp: number, layerId: string) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp !== stamp
          ? item
          : {
              ...item,
              layers: item.layers?.map((layer) =>
                layer.id === layerId
                  ? { ...layer, color: layer.originalColor, visible: true, opacity: layer.originalOpacity ?? 1 }
                  : layer,
              ),
            },
      ),
    );
  }

  function resetAllHistoryLayers(stamp: number) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp !== stamp
          ? item
          : {
              ...item,
              layers: item.layers?.map((layer) => ({
                ...layer,
                color: layer.originalColor,
                visible: true,
                opacity: layer.originalOpacity ?? 1,
              })),
            },
      ),
    );
  }


  const breadcrumbName = "Sketch to SVG Converter";
  const origin = "https://www.ilovesvg.com";

  const faq = [
    {
      q: "What counts as a sketch for this converter?",
      a: "A sketch can be a photo or scan of pencil, pen, or marker lines on paper, or a digital drawing exported as PNG or JPEG.",
    },
    {
      q: "Which preset should I start with?",
      a: "Pen (clean) works well for dark ink lines. Pencil (light) is better for faint graphite. Marker (bold) is tuned for thick strokes.",
    },
    {
      q: "Why do thin pencil lines disappear?",
      a: "If lines are light, increase Threshold or use the Pencil (light) preset, which boosts edges before tracing.",
    },
    {
      q: "How do I remove tiny specks from a scan?",
      a: "Increase Turd size. This removes small isolated dots before the SVG is generated.",
    },
    {
      q: "Why does the server sometimes say it is busy?",
      a: "Vectorization is CPU-heavy. When traffic is high, the server may return a busy response and the app retries after a short delay.",
    },
    {
      q: "Will the SVG be editable?",
      a: "Yes. The result is made of paths that can be recolored and edited in vector tools, depending on how clean the original sketch is.",
    },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${origin}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: breadcrumbName,
        item: `${origin}/sketch-to-svg-converter`,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  function setHistorySize(
    stamp: number,
    size: { width: number; height: number },
  ) {
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              width: size.width,
              height: size.height,
            }
          : item,
      ),
    );
  }

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]">
        <div className="max-w-[1180px] mx-auto px-4">
          <div className="hidden lg:block py-6">
            <AdSenseDelayed
              slot="2090332782"
              delayMs={1500}
              minHeight={90}
              maxHeight={120}
              format="horizontal"
              fullWidth={true}
              className="mx-auto w-full max-w-[970px]"
            />
          </div>

          <section className="lg:pt-0 lg:pb-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="flex text-center text-sky-800 text-xl sm:text-3xl w-full justify-center font-extrabold leading-none mb-3">
                Sketch to SVG Converter
              </h1>
              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              <div className="text-[13px] text-slate-600 mb-2">
                Limits: <b>{MAX_UPLOAD_BYTES / (1024 * 1024)} MB</b> •{" "}
                <b>{MAX_MP} MP</b> • <b>{MAX_SIDE}px</b> longest side
              </div>

              {!fileRef.current ? (
                <DragArea onPick={onPick} onDrop={onDrop} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
                    <div className="flex items-center min-w-0 gap-2">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="w-[22px] h-[22px] rounded-md object-cover mr-1"
                        />
                      )}
                      <span
                        title={fileRef.current?.name || ""}
                        className="truncate"
                      >
                        {fileRef.current?.name} •{" "}
                        {prettyBytes(fileRef.current?.size || 0)}
                        {originalFileSize &&
                          fileRef.current &&
                          originalFileSize > fileRef.current.size &&
                          ` (shrunk from ${prettyBytes(originalFileSize)})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setFile(null);
                        fileRef.current = null;
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                      }}
                      className="px-2 py-1 rounded-md border border-[#d6e4ff] bg-[#eff4ff] cursor-pointer hover:bg-[#e5eeff]"
                    >
                      ×
                    </button>
                  </div>
                  {dims && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected size:{" "}
                      <b>
                        {dims.w}×{dims.h}
                      </b>{" "}
                      (~{dims.mp.toFixed(1)} MP)
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => submitConvert()}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons name="convert" size={20} className="mr-1" />
                  {busy ? "Converting…" : "Convert"}
                </button>

                {fileRef.current && autoMode !== "fast" && (
                  <span className="text-[13px] text-slate-600">
                    {autoModeHint(autoMode)} {autoModeDetail(autoMode)}
                  </span>
                )}

                {err && <span className="text-red-700 text-sm">{err}</span>}
                {!err && info && (
                  <span className="text-[13px] text-slate-600">{info}</span>
                )}
              </div>

            </div>

            {previewUrl && (
              <div className="order-4 hidden min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:col-start-1 md:row-start-3 md:flex">
                <p className="m-0 border-b border-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-700">
                  Original image
                </p>
                <img
                  src={previewUrl}
                  alt="Input"
                  className="relative block h-auto w-full transparent-checkerboard"
                />
              </div>
            )}
            <TraceOutputPanel
              history={history}
              busy={busy}
              buttonDisabled={buttonDisabled}
              updatingStamp={updatingOutputStamp}
              file={file}
              fallbackSettings={settings}
              routeCapabilities={routeCapabilities}
              downloadLabel="Download SVG"
              downloadFileName="sketch-to-svg-converter.svg"
              emptyTitle="Converted files appear here..."
              emptyDescription="Convert your input to preview, copy, or download the result."
              fullscreenPreviewIndex={fullscreenPreviewIndex}
              setFullscreenPreviewIndex={setFullscreenPreviewIndex}
              onCopySvg={handleCopySvg}
              onToggleSettings={toggleOutputSettings}
              onDraftSettingsChange={updateOutputDraftSettings}
              onUpdatePreview={submitOutputUpdate}
              onStepVersion={stepOutputVersion}
              onOutputLayerChange={setHistoryLayer}
              onResetOutputLayer={resetHistoryLayer}
              onResetAllOutputLayers={resetAllHistoryLayers}
              onOutputSizeChange={setHistorySize}
            />
          </section>

          <SeoSections />

          <CurrentRouteGuide />

          <section className="bg-white border border-slate-200 rounded-2xl p-6 mt-6">
            <h2 className="text-lg font-bold m-0">
              Frequently asked questions
            </h2>
            <div className="mt-4 grid gap-3">
              {faq.map((x) => (
                <article
                  key={x.q}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h3 className="m-0 font-semibold">{x.q}</h3>
                  <p className="mt-2 text-sm text-slate-600">{x.a}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="text-[12px] text-slate-600 mt-6 bg-white border border-slate-200 rounded-xl p-4">
            Tools on this site are for budgeting and comparison. Calculations
            use standard time-period assumptions, including a 365-day year and
            average month length. Always confirm payment schedules and lease
            terms in your rental agreement.
          </div>
        </div>

        <FullscreenOutputPreview
          items={history}
          activeIndex={fullscreenPreviewIndex}
          setActiveIndex={setFullscreenPreviewIndex}
          getPreviewImage={(item, index) => ({
            id: String(item.stamp),
            label: `Output ${index + 1}`,
            svg: getHistoryItemSvg(item),
            width: item.width,
            height: item.height,
            kind: "SVG",
          })}
        />

        {toast && (
          <div className="fixed right-4 bottom-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000]">
            {toast}
          </div>
        )}
      </main>
      <div className="block lg:hidden py-6">
        <AdSenseDelayed
          slot="6632213024"
          delayMs={1500}
          minHeight={90}
          maxHeight={100}
          format="horizontal"
          fullWidth={true}
          className="mx-auto w-full max-w-[360px]"
        />
      </div>
      <ContextualAffiliateCard />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />

      {faq.length > 0 && (
        <script
          key="ld-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <script
        key="ld-breadcrumbs"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
    </>
  );
}

async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  if ("createImageBitmap" in window) {
    const bmp = await createImageBitmap(file);
    try {
      return { w: bmp.width, h: bmp.height };
    } finally {
      bmp.close?.();
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function validateBeforeSubmit(file: File) {
  if (!ALLOWED_MIME.has(file.type))
    throw new Error("Only PNG or JPEG images are allowed.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error("File too large. Max 30 MB per image.");
  const { w, h } = await getImageSize(file);
  if (!w || !h) throw new Error("Could not read image dimensions.");
  const mp = (w * h) / 1_000_000;
  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
    );
  }
}

async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX;
  if (file.size <= TARGET) return file;
  if (!file.type.startsWith("image/"))
    throw new Error("Unsupported file type for compression.");

  const img =
    "createImageBitmap" in window
      ? await createImageBitmap(file)
      : await loadImageElement(file);

  let w = img.width;
  let h = img.height;

  const encode = async (quality: number): Promise<Blob> => {
    const canvas =
      "OffscreenCanvas" in window
        ? new OffscreenCanvas(w, h)
        : (document.createElement("canvas") as HTMLCanvasElement);
    if (!(canvas as any).getContext) throw new Error("Canvas unsupported.");
    (canvas as any).width = w;
    (canvas as any).height = h;
    const ctx = (canvas as any).getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unsupported.");
    ctx.drawImage(img as any, 0, 0, w, h);

    const mime = "image/jpeg";
    const blob: Blob = await new Promise((res, rej) => {
      if ("convertToBlob" in (canvas as any)) {
        (canvas as any)
          .convertToBlob({ type: mime, quality })
          .then(res)
          .catch(rej);
      } else {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
          mime,
          quality,
        );
      }
    });
    return blob;
  };

  const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
  for (const q of qualities) {
    const b = await encode(q);
    if (b.size <= TARGET)
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
  }

  let scale = 0.9;
  while (w > 64 && h > 64) {
    w = Math.max(64, Math.floor(w * scale));
    h = Math.max(64, Math.floor(h * scale));
    const b = await encode(0.75);
    if (b.size <= TARGET)
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    scale = Math.max(0.5, scale - 0.07);
  }

  throw new Error(
    "This image cannot be reduced below 25 MB without excessive degradation.",
  );
}

function renameToJpeg(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.jpg`;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
    </label>
  );
}

function Num({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-[110px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
    />
  );
}

function prettyBytes(bytes: number) {
  const u = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200 mt-6 rounded-2xl">
      <div className="max-w-[1180px] mx-auto px-4 py-10 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Sketch vectorizer (PNG/JPEG to SVG)
              </p>
              <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                Turn sketches into clean SVG paths
              </h2>
              <p className="text-slate-600 ">
                This tool is tuned for pencil and ink drawings, scanned notes,
                and whiteboard photos. Use edge preprocessing for faint lines,
                increase turd size to remove dust, and adjust curve tolerance to
                balance detail and smoothness.
              </p>
              <p className="mt-2 text-slate-600 mx-auto">
                Convert photos or scans of sketches into clean, editable SVG.
                Use sketch-tuned presets for pencil, pen, marker, and whiteboard
                input, with live preview and on-device compression for large
                images.
              </p>
              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    k: "Sketch presets",
                    v: "Pencil, pen, marker, scan cleanup",
                  },
                  { k: "Live preview", v: "Fast ≤10 MB, throttled ≤25 MB" },
                  {
                    k: "Editable SVG",
                    v: "Paths that can be recolored and refined",
                  },
                  {
                    k: "In-memory processing",
                    v: "No accounts, no persistent storage",
                  },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold">{x.k}</div>
                    <div className="mt-1 text-sm text-slate-600">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>
          <ExampleSvgConversion />
          <div className="block py-6">
            <AdSenseDelayed
              slot="7336722354"
              delayMs={2500}
              afterInteraction={true}
              className="my-3"
              format="rectangle"
              fullWidth={false}
              minHeight={250}
              maxHeight={300}
            />
          </div>
          <section>
            <h3 className="text-lg font-bold">
              Tips for better sketch results
            </h3>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                {
                  t: "Crop excess background",
                  d: "Remove large blank borders to reduce noise and improve tracing speed.",
                },
                {
                  t: "Increase contrast before upload",
                  d: "If pencil is faint, increase contrast or use Edge preprocess with higher edge boost.",
                },
                {
                  t: "Remove specks with turd size",
                  d: "For scans, raising turd size removes dust and isolated dots from the SVG.",
                },
                {
                  t: "Use curve tolerance to smooth",
                  d: "Higher curve tolerance reduces nodes and smooths shapes, which often helps sketch clean-up.",
                },
              ].map((x) => (
                <div
                  key={x.t}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{x.t}</div>
                  <p className="mt-1 text-sm text-slate-600">{x.d}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
