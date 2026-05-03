import * as React from "react";
import type { Route } from "./+types/sticker-to-svg-for-cricut";
import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import {
  LayerPaletteEditor,
  LayeredTraceControls,
  applyLayerEditsToSvg,
  type EditableSvgLayer,
  type SvgLayerMeta,
  type TraceMode,
} from "~/client/components/svg/LayerPaletteEditor";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ChevronDownIcon, PresetPicker } from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import { extendTracePresets } from "~/client/lib/converter/presetAdditions";
import { TraceAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  appendAdvancedTraceSettings,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "Sticker to SVG for Cricut - Free Sticker Image to SVG Converter";
  const description =
    "Convert sticker images, decals, labels, sticker sheets, and simple artwork into Cricut-ready SVG files. Clean edges, remove speckles, smooth curves, and download SVG cut files online.";
  const canonical = "https://www.ilovesvg.com/sticker-to-svg-for-cricut";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Limits and types
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const DARK_BG_DEFAULT = "#0b1020";

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 450;
const LIVE_MED_MS = 1600;

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
      HEAVY_BACKEND_RATE_LIMITS,
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
      "sticker-to-svg-for-cricut",
      "raster-trace",
      HEAVY_BACKEND_RATE_LIMITS
    );
    if (!rateLimit.allowed) return createRateLimitedResponse(rateLimit);

    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;

    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        {
          error:
            "Upload too large for live conversion. Please resize the sticker image and try again.",
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
      return json({ error: "No sticker image uploaded." }, { status: 400 });
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
        { error: "Only PNG, JPG, JPEG, or WEBP sticker images are allowed." },
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
            "Server is busy converting other sticker images. We will retry automatically.",
          retryAfterMs,
          code: "BUSY",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
          },
        },
      );
    }

    try {
      const ab = await webFile.arrayBuffer();
      const input: Buffer = Buffer.from(ab);
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
            {
              error:
                "Could not read sticker image dimensions. Try a different PNG, JPG, or WEBP file.",
            },
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
              error: `Sticker image is too large: ${w}×${h} (~${mp.toFixed(
                1,
              )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {
        // If sharp metadata fails, Potrace may still handle valid smaller images.
      }

      const threshold = Number(form.get("threshold") ?? 220);
      const turdSize = Number(form.get("turdSize") ?? 3);
      const optTolerance = Number(form.get("optTolerance") ?? 0.34);
      const turnPolicy = String(form.get("turnPolicy") ?? "majority") as
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
      const { createLayeredColorSvg, annotateSingleTraceSvg } = await import(
        "../utils/svgLayerTrace.server"
      );
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
        const { createLayeredColorSvg: createServerLayeredColorSvg } = await import(
          "../utils/svgLayerTrace.server"
        );
        const layered = await createServerLayeredColorSvg(input, {
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
          gate: {
            running: gate.running,
            queued: gate.queued,
          },
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

      const { normalizeRasterForTrace } = await import(
        "../utils/imagePreprocess.server"
      );
      const prepped = await normalizeRasterForTrace(input, {
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

      const { traceBitmapToSvg } = await import("~/utils/potraceCompat");
      const opts: any = {
        color: "#000000",
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert: false,
        blackOnWhite: true,
      };

      const svgRaw: string = await traceBitmapToSvg(prepped, opts);

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

      const editable = annotateSingleTraceSvg(finalSVG, lineColor);
      const adjusted = applyTraceSvgOutputSettings(editable.svg, advancedTraceSettings, {
        width: ensured.width,
        height: ensured.height,
      });

      return json({
        svg: adjusted.svg,
        layers: editable.layers,
        width: adjusted.width,
        height: adjusted.height,
        gate: {
          running: gate.running,
          queued: gate.queued,
        },
      });
    } finally {
      try {
        release?.();
      } catch {}
    }
  } catch (err: any) {
    const { safeErrorMessage } = await import("~/utils/backendSecurity.server");
    return json(
      { error: safeErrorMessage(err?.message || "Server error during sticker SVG conversion.", "Server error during sticker SVG conversion.") },
      { status: 500 },
    );
  }
}

/* ========================
   Server image normalization
======================== */
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

/* ========================
   SVG helpers
======================== */
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

  const width = widthMatch ? Number(widthMatch[1]) : 1024;
  const height = heightMatch ? Number(heightMatch[1]) : 1024;

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

/* ========================
   UI types
======================== */
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

type Preset = {
  id: string;
  label: string;
  help: string;
  settings: Partial<Settings>;
};

const PRESETS: Preset[] = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    help: "Preserves separated color layers for Cricut-style sticker artwork.",
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
    help: "Uses fewer, smoother color layers for simpler sticker cuts.",
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
    help: "Keeps more color layers and fine details for richer sticker artwork.",
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
    help: "Creates fewer larger color regions for simpler layered assembly.",
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
    id: "sticker-clean",
    label: "Sticker - Clean default",
    help: "Best first choice for simple stickers, decals, and bold sticker artwork.",
    settings: {
      preprocess: "none",
      threshold: 220,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "sticker-bold",
    label: "Sticker - Bold cut lines",
    help: "Creates stronger shapes for vinyl decals, labels, and simple Cricut cuts.",
    settings: {
      preprocess: "none",
      threshold: 210,
      turdSize: 4,
      optTolerance: 0.42,
      turnPolicy: "black",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "sticker-sheet",
    label: "Sticker sheet - Clean shapes",
    help: "Useful for sticker sheets with multiple small designs on one image.",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 5,
      optTolerance: 0.4,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "kawaii-sticker",
    label: "Kawaii sticker - Smooth",
    help: "Smooths cute character stickers, icons, doodles, and rounded artwork.",
    settings: {
      preprocess: "none",
      threshold: 216,
      turdSize: 3,
      optTolerance: 0.52,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "label-sticker",
    label: "Label sticker - Text friendly",
    help: "Preserves lettering and label edges while still removing small speckles.",
    settings: {
      preprocess: "none",
      threshold: 230,
      turdSize: 2,
      optTolerance: 0.24,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "vinyl-decal",
    label: "Vinyl decal - Simple",
    help: "Reduces tiny details so the SVG is easier to cut and weed.",
    settings: {
      preprocess: "none",
      threshold: 206,
      turdSize: 6,
      optTolerance: 0.58,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "logo-sticker",
    label: "Logo sticker - Clean edges",
    help: "Good for turning logo-style sticker art into a cleaner Cricut SVG.",
    settings: {
      preprocess: "none",
      threshold: 214,
      turdSize: 2,
      optTolerance: 0.26,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "print-then-cut-outline",
    label: "Print then cut - Outline",
    help: "Creates a simplified outline-style SVG for sticker borders and cut planning.",
    settings: {
      preprocess: "edge",
      blurSigma: 1.0,
      edgeBoost: 1.2,
      threshold: 224,
      turdSize: 4,
      optTolerance: 0.42,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "photo-sticker",
    label: "Photo sticker - Edge cleanup",
    help: "Use when the sticker image is a photo, scan, or has shadows and uneven lighting.",
    settings: {
      preprocess: "edge",
      blurSigma: 1.15,
      edgeBoost: 1.35,
      threshold: 222,
      turdSize: 3,
      optTolerance: 0.38,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "low-contrast-sticker",
    label: "Low contrast - Boost edges",
    help: "Helps recover pale sticker art, light outlines, and low-contrast scans.",
    settings: {
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.7,
      threshold: 232,
      turdSize: 2,
      optTolerance: 0.34,
      turnPolicy: "minority",
      lineColor: "#000000",
      invert: false,
      transparent: true,
    },
  },
  {
    id: "white-sticker-dark",
    label: "White sticker on dark",
    help: "Creates a white-line preview on a dark background for light sticker designs.",
    settings: {
      preprocess: "none",
      threshold: 225,
      turdSize: 2,
      optTolerance: 0.32,
      turnPolicy: "minority",
      invert: true,
      lineColor: "#ffffff",
      transparent: false,
      bgColor: DARK_BG_DEFAULT,
    },
  },
  {
    id: "blue-cut-preview",
    label: "Blue cut preview",
    help: "Outputs a blue SVG preview for cut-line checking and craft planning.",
    settings: {
      preprocess: "none",
      threshold: 224,
      turdSize: 3,
      optTolerance: 0.34,
      turnPolicy: "majority",
      lineColor: "#0ea5e9",
      invert: false,
      transparent: true,
    },
  },
];

const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS);

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  threshold: 220,
  turdSize: 3,
  optTolerance: 0.34,
  turnPolicy: "majority",
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

const routeCapabilities = getRouteCapabilities("sticker-to-svg-for-cricut");

type ServerResult = {
  svg?: string;
  layers?: SvgLayerMeta[];
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  gate?: { running: number; queued: number };
};

type HistoryItem = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  stamp: number;
  presetLabel: string;
  settings: Settings;
};

type AutoMode = "fast" | "medium" | "off";

function getAutoMode(bytes?: number | null): AutoMode {
  if (bytes == null) return "off";
  if (bytes <= LIVE_FAST_MAX) return "fast";
  if (bytes <= LIVE_MED_MAX) return "medium";
  return "off";
}

function autoModeHint(mode: AutoMode): string {
  if (mode === "medium") return "Live preview is throttled for 10-25 MB files.";
  if (mode === "off")
    return "Use the button to convert larger files after compression.";
  return "";
}

function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium") {
    return "Large sticker image; updates run less frequently to keep the converter stable.";
  }

  if (mode === "off") {
    return "For best results, resize the sticker image before converting.";
  }

  return "";
}

/* ========================
   Page
======================== */
export default function StickerToSvgForCricut({}: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>("sticker-clean");
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [dims, setDims] = React.useState<{
    w: number;
    h: number;
    mp: number;
  } | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [fullscreenPreviewIndex, setFullscreenPreviewIndex] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const [toast, setToast] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showTips, setShowTips] = React.useState(true);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const objectUrlRef = React.useRef<string | null>(null);

  const pendingFirstConvertRef = React.useRef<{
    file: File;
    settings: Settings;
    requestId: number;
  } | null>(null);

  const requestIdRef = React.useRef(0);
  const lastSubmittedKeyRef = React.useRef<string | null>(null);

  const busy = fetcher.state !== "idle";

  const activePresetObject =
    DISPLAY_PRESETS.find((preset) => preset.id === activePreset) ?? PRESETS[0];

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const pending = pendingFirstConvertRef.current;

    if (!pending) return;
    if (!file) return;
    if (file !== pending.file) return;
    if (busy) return;

    pendingFirstConvertRef.current = null;
    submitFileForConversion(pending.file, pending.settings, "first-upload");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, busy]);

  React.useEffect(() => {
    if (fetcher.data?.error) {
      setErr(fetcher.data.error);
    }

    if (fetcher.data?.code === "BUSY" && fetcher.data.retryAfterMs && file) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      const retryFile = file;
      const retrySettings = settings;

      retryTimerRef.current = setTimeout(() => {
        submitFileForConversion(retryFile, retrySettings, "retry");
      }, fetcher.data.retryAfterMs);

      setInfo("Server is busy. Retrying automatically.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.error, fetcher.data?.code, fetcher.data?.retryAfterMs]);

  React.useEffect(() => {
    if (fetcher.data?.svg) {
      const item: HistoryItem = {
        svg: fetcher.data.svg,
        width: fetcher.data.width ?? 0,
        height: fetcher.data.height ?? 0,
        stamp: Date.now(),
        presetLabel: activePresetObject.label,
        settings,
      };

      setHistory((prev) => [item, ...prev].slice(0, 10));
      setErr(null);
      setInfo("Sticker image converted. Download the SVG or adjust settings.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height]);

  React.useEffect(() => {
    if (!file) return;
    if (pendingFirstConvertRef.current) return;
    if (autoMode === "off") return;
    if (busy) return;

    const delay = autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const liveFile = file;
    const liveSettings = settings;

    debounceRef.current = setTimeout(() => {
      submitFileForConversion(liveFile, liveSettings, "live-preview");
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode, busy]);

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
    const f = e.target.files?.[0];
    if (!f) return;

    await handleNewFile(f);
    e.currentTarget.value = "";
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
      setErr("Please choose a PNG, JPG, JPEG, or WEBP sticker image.");
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    pendingFirstConvertRef.current = null;
    lastSubmittedKeyRef.current = null;

    setFile(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setPreviewUrl(null);
    setSettings(DEFAULTS);
    setActivePreset("sticker-clean");
    setHistory([]);
    setErr(null);
    setInfo(null);
    setDims(null);
    setAutoMode("off");
    setOriginalFileSize(f.size);

    let chosen = f;

    try {
      if (chosen.size > LIVE_MED_MAX && chosen.size <= MAX_UPLOAD_BYTES) {
        setInfo("Compressing the sticker image locally for live preview.");
        chosen = await compressToTarget25MB(chosen);
      }

      if (requestId !== requestIdRef.current) return;

      if (chosen.size > MAX_UPLOAD_BYTES) {
        setErr("File too large. Max 30 MB per image.");
        setInfo(null);
        return;
      }

      await validateBeforeSubmit(chosen);

      if (requestId !== requestIdRef.current) return;

      const url = URL.createObjectURL(chosen);
      objectUrlRef.current = url;

      pendingFirstConvertRef.current = {
        file: chosen,
        settings: DEFAULTS,
        requestId,
      };

      setFile(chosen);
      setAutoMode(getAutoMode(chosen.size));
      setPreviewUrl(url);

      await measureAndSet(chosen);
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;

      pendingFirstConvertRef.current = null;
      setErr(e?.message || "Could not prepare this sticker image.");
      setInfo(null);
    }
  }

  function submitCurrentFile() {
    if (!file) {
      setErr("Choose a sticker image first.");
      return;
    }

    submitFileForConversion(file, settings, "manual");
  }

  async function submitFileForConversion(
    fileToConvert: File,
    settingsToUse: Settings,
    reason: "first-upload" | "manual" | "live-preview" | "retry",
  ) {
    if (!fileToConvert) {
      setErr("Choose a sticker image first.");
      return;
    }

    try {
      await validateBeforeSubmit(fileToConvert);
    } catch (e: any) {
      setErr(e?.message || "Sticker image is too large.");
      return;
    }

    const effective = getEffectiveSettings(settingsToUse);

    const submitKey = [
      reason,
      fileToConvert.name,
      fileToConvert.size,
      fileToConvert.lastModified,
      effective.threshold,
      effective.turdSize,
      effective.optTolerance,
      effective.turnPolicy,
      effective.lineColor,
      effective.invert,
      effective.transparent,
      effective.bgColor,
      effective.preprocess,
      effective.blurSigma,
      effective.edgeBoost,
      effective.traceMode,
      effective.colorLayerCount,
      effective.layerMaxTraceSide,
      effective.minRegionPercent,
      effective.layerOptTolerance,
      effective.layerTurdSize,
      effective.layerTurnPolicy,
      effective.posterize,
      effective.removeWhite,
      effective.removeTransparent,
    ].join("|");

    if (reason !== "manual" && lastSubmittedKeyRef.current === submitKey) {
      return;
    }

    lastSubmittedKeyRef.current = submitKey;

    const fd = new FormData();
    fd.append("file", fileToConvert);
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

    setErr(null);
    setInfo(reason === "first-upload" ? "Converting sticker image..." : null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "/sticker-to-svg-for-cricut?index"
          : `${window.location.pathname}?index`,
    });
  }

  function getEffectiveSettings(settingsToUse: Settings): Settings {
    if (settingsToUse.traceMode === "layered" || !settingsToUse.invert) return settingsToUse;

    const bg =
      !settingsToUse.bgColor ||
      settingsToUse.bgColor.toLowerCase() === "#ffffff" ||
      settingsToUse.bgColor.toLowerCase() === "#fff"
        ? DARK_BG_DEFAULT
        : settingsToUse.bgColor;

    return {
      ...settingsToUse,
      transparent: false,
      bgColor: bg,
      lineColor:
        settingsToUse.lineColor?.toLowerCase() === "#000000"
          ? "#ffffff"
          : settingsToUse.lineColor,
    };
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

  function buildPresetSettings(preset: Preset): Settings {
    return {
      ...DEFAULTS,
      traceMode: preset.settings.traceMode ?? "single",
      ...preset.settings,
    } as Settings;
  }

  function applyPreset(preset: Preset) {
    setActivePreset(preset.id);
    const nextSettings = buildPresetSettings(preset);
    setSettings(nextSettings);

    if (file && autoMode !== "off" && !busy) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const presetFile = file;
      debounceRef.current = setTimeout(
        () => {
          submitFileForConversion(presetFile, nextSettings, "live-preview");
        },
        autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS,
      );
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(
      () => {
        showToast("SVG copied");
      },
      () => {
        setErr("Copy failed. Download the SVG instead.");
      },
    );
  }

  function getHistoryItemSvg(item: HistoryItem): string {
    return item.layers?.length
      ? applyLayerEditsToSvg(item.svg, item.layers)
      : item.svg;
  }

  function setHistoryLayer(
    stamp: number,
    layerId: string,
    patch: Partial<Pick<EditableSvgLayer, "color" | "visible" | "opacity">>,
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
                  ? { ...layer, color: layer.originalColor, visible: true }
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
              })),
            },
      ),
    );
  }

  function downloadSvg(item: HistoryItem) {
    const b = new Blob([getHistoryItemSvg(item)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = makeDownloadName(file?.name || "sticker", "svg");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  function downloadSettingsCsv(item: HistoryItem) {
    const rows = [
      ["Field", "Value"],
      ["Original file", file?.name || ""],
      ["Preset", item.presetLabel],
      ["Width", item.width],
      ["Height", item.height],
      ["Threshold", item.settings.threshold],
      ["Turd size", item.settings.turdSize],
      ["Curve tolerance", item.settings.optTolerance],
      ["Turn policy", item.settings.turnPolicy],
      ["Line color", item.settings.lineColor],
      ["Transparent background", item.settings.transparent ? "Yes" : "No"],
      ["Background color", item.settings.bgColor],
      ["Preprocess", item.settings.preprocess],
      ["Blur sigma", item.settings.blurSigma],
      ["Edge boost", item.settings.edgeBoost],
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
      .join("\n");

    const b = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "sticker-to-svg-for-cricut-settings.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  function printResult() {
    window.print();
  }

  return (
    <>
      <main className="bg-slate-50 text-[#0f2537]">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="hidden py-6 lg:block">
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

          <section className="grid grid-cols-1 gap-4 items-start sm:pt-5 md:grid-cols-2 lg:pt-0 lg:pb-8">
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-sky-700">
                Cricut sticker vectorizer
              </p>

              <h1 className="m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-xl font-extrabold leading-none text-sky-950 sm:text-3xl">
                Sticker to SVG for Cricut
              </h1>

              <p className="mb-4 text-center text-sm leading-6 text-slate-600">
                Upload a sticker image, decal, label, sticker sheet, or simple
                artwork and convert it into a cleaner SVG cut file for Cricut
                Design Space.
              </p>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

              {activePresetObject?.help && (
                <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[13px] leading-5 text-slate-700">
                  <b className="text-sky-900">{activePresetObject.label}:</b>{" "}
                  {activePresetObject.help}
                </div>
              )}


              {!file ? (
                <DragArea
                  onPick={onPick}
                  onDrop={onDrop}
                  MAX_UPLOAD_BYTES={MAX_UPLOAD_BYTES}
                  MAX_MP={MAX_MP}
                  MAX_SIDE={MAX_SIDE}
                />
              ) : (
                <>
                  <div className="mt-0 flex items-center justify-between gap-2 rounded-lg border border-[#dae6ff] bg-[#f7faff] px-3 py-2 text-slate-900">
                    <div className="flex min-w-0 items-center gap-2">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="mr-1 h-[22px] w-[22px] rounded-md object-cover"
                        />
                      )}

                      <span title={file?.name || ""} className="truncate">
                        {file?.name} • {prettyBytes(file?.size || 0)}
                        {originalFileSize &&
                          originalFileSize > file.size &&
                          ` (shrunk from ${prettyBytes(originalFileSize)})`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        requestIdRef.current += 1;
                        pendingFirstConvertRef.current = null;
                        lastSubmittedKeyRef.current = null;

                        if (debounceRef.current)
                          clearTimeout(debounceRef.current);
                        if (retryTimerRef.current)
                          clearTimeout(retryTimerRef.current);

                        if (objectUrlRef.current) {
                          URL.revokeObjectURL(objectUrlRef.current);
                          objectUrlRef.current = null;
                        }

                        setFile(null);
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                        setHistory([]);
                      }}
                      className="cursor-pointer rounded-md border border-[#d6e4ff] bg-[#eff4ff] px-2 py-1 hover:bg-[#e5eeff]"
                      aria-label="Remove sticker image"
                    >
                      ×
                    </button>
                  </div>

                  {dims && (
                    <div className="mt-2 text-[13px] text-slate-700">
                      Detected sticker image size:{" "}
                      <b>
                        {dims.w}×{dims.h}
                      </b>{" "}
                      (~{dims.mp.toFixed(1)} MP)
                    </div>
                  )}
                </>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submitCurrentFile}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex w-full items-center justify-center rounded-lg border px-3.5 py-2 font-bold transition-colors",
                    "cursor-pointer border-[#0a24da] bg-[#0b2dff] text-white hover:border-[#091ec0] hover:bg-[#0a24da]",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Converting..." : "Convert Sticker to SVG"}
                </button>

                {file && autoMode !== "fast" && (
                  <span className="text-[13px] text-slate-600">
                    {autoModeHint(autoMode)} {autoModeDetail(autoMode)}
                  </span>
                )}

                {err && <span className="text-sm text-red-700">{err}</span>}

                {!err && info && (
                  <span className="text-[13px] text-slate-600">{info}</span>
                )}
              </div>


              <button
                type="button"
                onClick={() => setShowTips((v) => !v)}
                className="mt-3 inline-flex w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                aria-expanded={showTips}
              >
                Tips for cleaner Cricut sticker SVGs
                <ChevronDownIcon open={showTips} />
              </button>

              {showTips && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Use clean sticker art with strong contrast for best SVG
                      results.
                    </li>
                    <li>
                      Use the vinyl decal preset if Cricut creates too many tiny
                      cuts.
                    </li>
                    <li>
                      Raise speckle removal if the SVG has small unwanted dots.
                    </li>
                    <li>
                      Use edge mode for scanned stickers or photographed sticker
                      sheets.
                    </li>
                    <li>
                      Use print then cut outline mode when you mainly need a
                      border-style trace.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="order-3 min-w-0 rounded-2xl border border-sky-200 bg-sky-50/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:col-start-1 md:row-start-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full inline-flex items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-sky-950 cursor-pointer transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1"
                aria-expanded={showAdvanced}
                aria-controls="advanced-settings"
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-600 text-white shadow-sm">
                    <Icons name="settings" size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-5">
                      Advanced settings
                    </span>
                    <span className="block truncate text-[12px] font-medium leading-4 text-sky-700">
                      Trace detail, cleanup, layers, and export
                    </span>
                  </span>
                </span>

                <svg
                  className={[
                    "h-4 w-4 shrink-0 text-sky-700 transition-transform",
                    showAdvanced ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

                {showAdvanced && (
                  <TraceAdvancedSettingsPanel
                    id="advanced-settings"
                    open={showAdvanced}
                    settings={settings}
                    setSettings={setSettings}
                    capabilities={routeCapabilities}
                    detectedColorItems={history}
                    sourceFile={file}
                    removeColorsEnabled={!(file && (file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "")))}
                    buttonDisabled={buttonDisabled}
                    onUpdatePreview={() => { if (file) void submitFileForConversion(file, settings, "manual"); }}
                  />
                )}
            </div>

            {previewUrl && !showAdvanced && (
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

            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              {busy && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              )}

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item, index) => (
                    <div
                      key={item.stamp}
                      className="rounded-xl border border-slate-200 bg-white p-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="block text-[13px] font-semibold text-slate-800">
                            {item.presetLabel}
                          </span>
                          <span className="text-[13px] text-slate-700">
                            {item.width > 0 && item.height > 0
                              ? `${item.width} × ${item.height} px`
                              : "size unknown"}
                          </span>
                        </div>

                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                          Cricut SVG
                        </span>
                      </div>

                      <div className="my-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => downloadSvg(item)}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white hover:bg-sky-600"
                        >
                          <Icons
                            name="download"
                            size={16}
                            className="mr-1 inline-block"
                          />
                          Download SVG
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySvg(getHistoryItemSvg(item))}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
                        >
                          <Icons
                            name="copy"
                            size={16}
                            className="mr-1 inline-block"
                          />
                          Copy SVG
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadSettingsCsv(item)}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
                        >
                          Export Settings CSV
                        </button>

                        <button
                          type="button"
                          onClick={printResult}
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
                        >
                          Print to PDF
                        </button>
                      </div>

                      <div className="relative flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white transparent-checkerboard p-2">
                        <FullscreenPreviewButton onOpen={() => setFullscreenPreviewIndex(index)} />
                        <img
                          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                            getHistoryItemSvg(item),
                          )}`}
                          alt="Converted sticker SVG result"
                          className="h-auto max-w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                  <p className="converter-empty-output-state">
                  {!busy && (
                    <Icons
                      name="success"
                      size={20}
                      className="mr-1 inline-block"
                    />
                  )}
                  {busy
                    ? "Converting sticker image..."
                    : "Converted sticker SVGs appear here."}
                </p>
              )}
            </div>
          </section>
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
          <div className="fixed bottom-4 right-4 z-[1000] rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </main>

      <div className="block py-6 lg:hidden">
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

      <SeoSections />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ========================
   Client helpers
======================== */
async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  if ("createImageBitmap" in window) {
    const bmp = await createImageBitmap(file);
    return { w: bmp.width, h: bmp.height };
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
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only PNG, JPG, JPEG, or WEBP sticker images are allowed.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per image.");
  }

  const { w, h } = await getImageSize(file);

  if (!w || !h) throw new Error("Could not read sticker image dimensions.");

  const mp = (w * h) / 1_000_000;

  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Sticker image is too large: ${w}×${h} (~${mp.toFixed(
        1,
      )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
    );
  }
}

async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX;

  if (file.size <= TARGET) return file;

  if (!file.type.startsWith("image/")) {
    throw new Error("Unsupported file type for compression.");
  }

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

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
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

  const qualities = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52];

  for (const q of qualities) {
    const b = await encode(q);

    if (b.size <= TARGET) {
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    }
  }

  let scale = 0.9;

  while (w > 64 && h > 64) {
    w = Math.max(64, Math.floor(w * scale));
    h = Math.max(64, Math.floor(h * scale));

    const b = await encode(0.75);

    if (b.size <= TARGET) {
      return new File([b], renameToJpeg(file.name), { type: "image/jpeg" });
    }

    scale = Math.max(0.5, scale - 0.07);
  }

  throw new Error(
    "This sticker image cannot be reduced below 25 MB without excessive quality loss.",
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

function makeDownloadName(name: string, extension: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "sticker";

  return `${safeBase}-cricut.${extension}`;
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

/* ========================
   UI helpers
======================== */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-3 py-2">
      <span className="min-w-[180px] shrink-0 text-[13px] text-slate-700">
        {label}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
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
      className="w-[110px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900"
    />
  );
}

/* ========================
   SEO sections
======================== */
function SeoSections() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1180px] px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sticker image to SVG cut file converter
              </p>

              <h2 className="text-2xl font-bold leading-tight text-sky-950 md:text-3xl">
                Convert sticker images into Cricut-ready SVG files
              </h2>

              <p className="text-slate-600">
                This sticker to SVG converter helps turn sticker art, labels,
                decals, sticker sheets, and simple illustrations into SVG files
                for Cricut Design Space. Upload a PNG, JPG, JPEG, or WEBP
                sticker image, choose a cleanup preset, preview the vector
                result, and download an SVG cut file.
              </p>

              <p className="text-slate-600">
                It works best for clean sticker artwork with strong contrast,
                simple shapes, clear outlines, logo-style stickers, text labels,
                icons, and cartoon-style designs. Use the smoothing and speckle
                controls to reduce messy paper texture, extra dots, and tiny
                unwanted cuts.
              </p>

              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    k: "Sticker-first presets",
                    v: "Decals, labels, sticker sheets, logos",
                  },
                  {
                    k: "Cricut-friendly cleanup",
                    v: "Speckle removal and curve smoothing",
                  },
                  {
                    k: "Transparent SVG",
                    v: "Useful for vinyl, decals, labels, and cards",
                  },
                  {
                    k: "Live preview",
                    v: "Tune settings before downloading",
                  },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="text-sm font-semibold text-sky-950">
                      {x.k}
                    </div>
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

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              What kinds of sticker images work best?
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Sticker sheets",
                "Vinyl decals",
                "Logo stickers",
                "Label stickers",
                "Kawaii stickers",
                "Cartoon stickers",
                "Planner stickers",
                "Simple icons",
                "Text labels",
                "Print then cut art",
                "Scanned stickers",
                "Transparent PNG stickers",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-sky-950">
                  Best source images
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Use clean sticker artwork with clear outlines and high
                  contrast. Transparent PNG stickers, simple logo stickers, and
                  bold decal art usually convert better than busy photos or
                  heavily shaded images.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold text-sky-950">
                  Best Cricut projects
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Converted sticker SVGs work well for vinyl decals, planner
                  stickers, labels, simple sticker borders, custom signs,
                  cardstock crafts, and cut-file planning in Cricut Design
                  Space.
                </p>
              </div>
            </div>
          </section>

          <section
            itemScope
            itemType="https://schema.org/HowTo"
            className="mt-12"
          >
            <div className="flex items-end justify-between gap-4">
              <h3 itemProp="name" className="text-lg font-bold text-sky-950">
                How to convert a sticker image to SVG for Cricut
              </h3>

              <span className="text-xs text-slate-500">
                Upload, clean up, preview, download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a sticker image",
                  body: "Choose a PNG, JPG, JPEG, or WEBP sticker image. Transparent PNG artwork usually gives cleaner SVG results.",
                },
                {
                  title: "Pick the closest sticker preset",
                  body: "Use sticker clean, vinyl decal, label sticker, logo sticker, photo sticker, or print then cut outline mode depending on your image.",
                },
                {
                  title: "Adjust cleanup settings",
                  body: "Use threshold to capture more or fewer edges, speckle removal to remove dots, and curve smoothing to reduce rough cut paths.",
                },
                {
                  title: "Preview the SVG result",
                  body: "Check whether the converted file keeps the main sticker shape without adding too many tiny background marks.",
                },
                {
                  title: "Download and upload to Cricut Design Space",
                  body: "Download the SVG file and upload it to Cricut Design Space. If the file feels too complex, return and increase smoothing or speckle removal.",
                },
              ].map((s, i) => (
                <li
                  key={s.title}
                  itemScope
                  itemType="https://schema.org/HowToStep"
                  itemProp="step"
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {i + 1}
                    </div>

                    <div>
                      <div
                        itemProp="name"
                        className="font-semibold text-sky-950"
                      >
                        {s.title}
                      </div>

                      <div
                        itemProp="itemListElement"
                        className="mt-1 text-sm leading-6 text-slate-600"
                      >
                        {s.body}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              How sticker cleanup settings affect your SVG
            </h3>

            <p className="mt-2 max-w-[80ch] text-sm leading-6 text-slate-600">
              Sticker images can include shadows, compression artifacts, paper
              texture, background pixels, or tiny colored details that become
              extra SVG paths. These settings help you control how much detail
              Cricut has to process.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Threshold",
                  body: "Higher values include lighter edges and details. Lower values keep only darker or stronger sticker shapes.",
                },
                {
                  title: "Speckle removal",
                  body: "Removes tiny dots caused by scans, paper grain, compression noise, and unwanted background pixels.",
                },
                {
                  title: "Curve smoothing",
                  body: "Higher values make rough sticker edges smoother and can reduce the number of small cut paths.",
                },
                {
                  title: "Preprocess",
                  body: "Use normal mode for clean digital sticker art. Use edge mode for photos, scans, and low-contrast sticker images.",
                },
                {
                  title: "Corner handling",
                  body: "Changes how ambiguous corners and small gaps are resolved. Majority is often cleaner; minority is often more faithful.",
                },
                {
                  title: "Transparent background",
                  body: "Best for most Cricut SVG files. Use a solid background only when you want to preview white or colored lines.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">
                    {c.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Common sticker-to-SVG problems and fixes
            </h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                [
                  "SVG has too many dots",
                  "Raise speckle removal and use the sticker sheet or vinyl decal preset.",
                ],
                [
                  "Light sticker edges disappear",
                  "Raise threshold or use the low contrast preset.",
                ],
                [
                  "Cricut cuts too many tiny pieces",
                  "Increase curve smoothing and use the vinyl decal preset.",
                ],
                [
                  "Photo shadows appear in the SVG",
                  "Use photo sticker mode and crop the background before uploading.",
                ],
                [
                  "Text looks too thin",
                  "Use the label sticker preset or lower the threshold slightly.",
                ],
                [
                  "Edges look jagged",
                  "Increase curve smoothing and avoid low-resolution sticker images.",
                ],
              ].map(([t, d]) => (
                <div
                  key={t}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-sky-950">{t}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </section>

          <CurrentRouteGuide />

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold text-sky-950">
              Frequently asked questions
            </h3>

            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Can I turn a sticker image into an SVG for Cricut?",
                  a: "Yes. Upload a PNG, JPG, JPEG, or WEBP sticker image, choose a sticker preset, adjust cleanup settings if needed, and download the SVG file for Cricut Design Space.",
                },
                {
                  q: "What file types can I upload?",
                  a: "This converter accepts PNG, JPG, JPEG, and WEBP images up to 30 MB, with practical live-preview handling for files up to 25 MB after local compression.",
                },
                {
                  q: "What kind of sticker image converts best?",
                  a: "High-contrast sticker art converts best. Transparent PNG artwork, bold decals, simple labels, and clean logo-style stickers usually convert better than busy photos or shaded images.",
                },
                {
                  q: "Why does my Cricut SVG have lots of tiny pieces?",
                  a: "The converter may be tracing texture, compression noise, shadows, or small colored details. Raise speckle removal, increase curve smoothing, or use the vinyl decal preset.",
                },
                {
                  q: "Should I use this for print then cut stickers?",
                  a: "You can use it to create simplified outlines or SVG cut paths. For full-color print then cut artwork, keep your original image for printing and use the SVG result for shape planning.",
                },
                {
                  q: "Can I use this for sticker sheets?",
                  a: "Yes. Use the sticker sheet preset. It is designed to reduce small specks while keeping the main sticker shapes visible.",
                },
                {
                  q: "Is the output a real SVG?",
                  a: "Yes. The result is an SVG file with vector paths that can be downloaded, copied, and uploaded to Cricut Design Space.",
                },
                {
                  q: "Why did my photo sticker not convert cleanly?",
                  a: "Photo-style stickers often contain gradients, shadows, and fine detail. Try photo sticker mode, crop the background, increase smoothing, and use a higher-resolution source image.",
                },
              ].map((x) => (
                <article
                  key={x.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4
                    itemProp="name"
                    className="m-0 font-semibold text-sky-950"
                  >
                    {x.q}
                  </h4>

                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm leading-6 text-slate-600"
                  >
                    <span itemProp="text">{x.a}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
