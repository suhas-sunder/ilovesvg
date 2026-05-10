import { extendTracePresets } from "~/client/lib/converter/presetAdditions";
import { TraceAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  appendAdvancedTraceSettings,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";
import * as React from "react";
import type { Route } from "./+types/photo-to-svg-outline";
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
import { useHybridTraceFetcher } from "~/client/lib/tracing/useHybridTraceFetcher";
import {
  LayerPaletteEditor,
  LayeredTraceControls,
  type EditableSvgLayer,
  type SvgLayerMeta,
  type TraceMode,
} from "~/client/components/svg/LayerPaletteEditor";

/** Stable server flag: true on SSR render, false in client bundle */
const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title = "Photo to SVG Outline Converter - Create Contour SVGs | iLoveSVG";
  const description =
    "Convert photos into outline-style SVG using server-assisted tracing and edge presets. Useful for contour art, decals, posters, and simplified photo graphics.";
  const canonical = "https://www.ilovesvg.com/photo-to-svg-outline";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },

    // Canonical
    { tagName: "link", rel: "canonical", href: canonical },

    // OpenGraph
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
   Limits & types (mirrored client/server)
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_MP = 30; // ~30 megapixels
const MAX_SIDE = 8000; // max width or height
const ALLOWED_MIME = new Set(["image/png", "image/jpeg"]);

// Live preview tiers (client)
const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 500;
const LIVE_MED_MS = 1900;

// Concurrency gate (server)
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
      "photo-to-svg-outline",
      "raster-trace"
    );
    if (!rateLimit.allowed) return createRateLimitedResponse(rateLimit);

    const contentLength = Number(request.headers.get("content-length") || "0");
    const MAX_OVERHEAD = 5 * 1024 * 1024;
    if (contentLength && contentLength > MAX_UPLOAD_BYTES + MAX_OVERHEAD) {
      return json(
        { error: "Upload too large. Please resize and try again." },
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
    if (!file || typeof file === "string")
      return json({ error: "No file uploaded." }, { status: 400 });

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
          error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
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
      // @ts-ignore Buffer exists in Remix node runtime
      const input: Buffer = Buffer.from(ab);
      const signatureError = validateFileSignature(input, webFile, ALLOWED_MIME);
      if (signatureError) return signatureError;

      // Authoritative dimension guard via sharp metadata (best-effort)
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
              error: `Image too large: ${w}×${h} (~${mp.toFixed(1)} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {}

      // Photo-outline defaults (still user-overridable via form)
      const threshold = Number(form.get("threshold") ?? 228);
      const turdSize = Number(form.get("turdSize") ?? 3);
      const optTolerance = Number(form.get("optTolerance") ?? 0.5);
      const turnPolicy = String(form.get("turnPolicy") ?? "majority") as
        | "black"
        | "white"
        | "left"
        | "right"
        | "minority"
        | "majority";
      const lineColor = String(form.get("lineColor") ?? "#000000");
      const invert =
        String(form.get("invert") ?? "false").toLowerCase() === "true";

      const transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";
      const bgColor = String(form.get("bgColor") ?? "#ffffff");

      // Always default to edge mode on this page
      const preprocess = String(form.get("preprocess") ?? "edge") as
        | "none"
        | "edge";
      const blurSigma = Number(form.get("blurSigma") ?? 1.15);
      const edgeBoost = Number(form.get("edgeBoost") ?? 1.25);
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
          fillStrokeWidth: advancedTraceSettings.fillStrokeWidth,
          fillStrokeColor: advancedTraceSettings.fillStrokeColor,
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
        color: lineColor,
        threshold,
        turdSize,
        optTolerance,
        turnPolicy,
        invert,
        blackOnWhite: !invert,
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
    const {
      createInvalidUploadDecodeResponse,
      isInvalidUploadDecodeError,
      safeErrorMessage,
    } = await import("~/utils/backendSecurity.server");
    if (isInvalidUploadDecodeError(err)) {
      return createInvalidUploadDecodeResponse();
    }
    return json(
      { error: safeErrorMessage(err?.message || "Server error during conversion.", "Server error during conversion.") },
      { status: 500 },
    );
  }
}

/* ---------- Image normalization for Potrace (server-side, robust) ---------- */
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

  let min = 255,
    max = 0,
    sum = 0,
    count = 0;
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

/* ---------- SVG helpers (Node-safe, no DOMParser) ---------- */
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
   UI (types)
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
    id: "photo-outline-clean",
    label: "Photo Outline - Clean (default)",
    settings: {
      preprocess: "edge",
      blurSigma: 1.15,
      edgeBoost: 1.25,
      threshold: 228,
      turdSize: 3,
      optTolerance: 0.5,
      turnPolicy: "majority",
      lineColor: "#000000",
      invert: false,
    },
  },
  {
    id: "photo-outline-soft",
    label: "Photo Outline - Soft (less texture)",
    settings: {
      preprocess: "edge",
      blurSigma: 1.6,
      edgeBoost: 1.05,
      threshold: 222,
      turdSize: 4,
      optTolerance: 0.52,
      turnPolicy: "majority",
    },
  },
  {
    id: "photo-outline-strong",
    label: "Photo Outline - Strong edges",
    settings: {
      preprocess: "edge",
      blurSigma: 0.85,
      edgeBoost: 1.55,
      threshold: 236,
      turdSize: 3,
      optTolerance: 0.55,
      turnPolicy: "black",
    },
  },
  {
    id: "photo-outline-detail",
    label: "Photo Outline - Fine detail (can be noisy)",
    settings: {
      preprocess: "edge",
      blurSigma: 0.9,
      edgeBoost: 1.35,
      threshold: 226,
      turdSize: 1,
      optTolerance: 0.35,
      turnPolicy: "minority",
    },
  },
  {
    id: "white-on-black",
    label: "Invert - White outline on black",
    settings: {
      preprocess: "edge",
      blurSigma: 1.15,
      edgeBoost: 1.25,
      threshold: 228,
      turdSize: 3,
      optTolerance: 0.5,
      turnPolicy: "majority",
      invert: true,
      lineColor: "#ffffff",
    },
  },
];

const DISPLAY_PRESETS = extendTracePresets<Preset>(PRESETS);

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  threshold: 228,
  turdSize: 3,
  optTolerance: 0.5,
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

  preprocess: "edge",
  blurSigma: 1.15,
  edgeBoost: 1.25,
};

const routeCapabilities = getRouteCapabilities("photo-to-svg-outline");

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
  if (mode === "medium") return "Live preview is throttled for 10-25 MB files.";
  return "";
}
function autoModeDetail(mode: AutoMode): string {
  if (mode === "medium")
    return "Large file; updates run less often to keep things smooth.";
  return "";
}

export default function PhotoToSvgOutline({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useHybridTraceFetcher<ServerResult>({ routeId: "photo-to-svg-outline" });

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] = React.useState<string>(
    "photo-outline-clean",
  );

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

  React.useEffect(() => {
    if (fetcher.data?.error) setErr(fetcher.data.error);
    else setErr(null);

    if (fetcher.data?.retryAfterMs) {
      const ms = Math.max(800, fetcher.data.retryAfterMs);
      setInfo(`Server busy, retrying in ${(ms / 1000).toFixed(1)}s`);
      const t = setTimeout(() => {
        if (file) submitConvert();
      }, ms);
      return () => clearTimeout(t);
    } else {
      setInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

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

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    if (f.size > MAX_UPLOAD_BYTES) {
      setInfo("Huge file detected, compressing on your device");
      try {
        chosen = await compressToTarget25MB(f);
      } catch (e: any) {
        setInfo(null);
        setErr(
          e?.message || "This photo is too large. Please resize and try again.",
        );
        setFile(null);
        setPreviewUrl(null);
        setAutoMode("off");
        setOriginalFileSize(null);
        return;
      }
    } else if (f.size > LIVE_MED_MAX) {
      setInfo("Large photo detected, compressing on your device for preview");
      try {
        const shrunk = await compressToTarget25MB(f);
        chosen = shrunk;
        setInfo(`Compressed on-device to ${prettyBytes(shrunk.size)}.`);
      } catch (e: any) {
        setErr(
          e?.message ||
            "Could not compress below 25 MB. Live preview will be disabled.",
        );
        setInfo(null);
        chosen = f;
      }
    }

    if (chosen.size > MAX_UPLOAD_BYTES) {
      setErr(
        `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
      );
      setInfo(null);
      setFile(null);
      setPreviewUrl(null);
      setAutoMode("off");
      setOriginalFileSize(null);
      return;
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    await measureAndSet(chosen);
  }

  async function submitConvert(targetFile = file, targetSettings = settings) {
    if (!targetFile) {
      setErr("Choose a photo first.");
      return;
    }

    try {
      await validateBeforeSubmit(targetFile);
    } catch (e: any) {
      setErr(e?.message || "Photo is too large.");
      return;
    }

    const fd = new FormData();
    fd.append("file", targetFile);
    fd.append("threshold", String(targetSettings.threshold));
    fd.append("turdSize", String(targetSettings.turdSize));
    fd.append("optTolerance", String(targetSettings.optTolerance));
    fd.append("turnPolicy", targetSettings.turnPolicy);
    fd.append("lineColor", targetSettings.lineColor);
    fd.append("invert", String(targetSettings.invert));
    fd.append("transparent", String(targetSettings.transparent));
    fd.append("bgColor", targetSettings.bgColor);
    fd.append("preprocess", targetSettings.preprocess);
    fd.append("blurSigma", String(targetSettings.blurSigma));
    fd.append("edgeBoost", String(targetSettings.edgeBoost));
    fd.append("presetId", activePreset);

    pendingSourceFileNameRef.current = targetFile.name;
    setErr(null);

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action: `${window.location.pathname}?index`,
    });
  }

  // Tiered live preview
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!file) return;
    if (autoMode === "off") return;

    const delay = autoMode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void submitConvert(file, settings), delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode]);

  const buttonDisabled = isServer || !hydrated || busy || !file;

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
          <section className="grid grid-cols-1 gap-4 items-start sm:pt-5 md:grid-cols-2 lg:pt-0 lg:pb-8">
            {/* INPUT */}
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="font-display m-0 mb-3 inline-flex w-full items-center justify-center gap-2 text-center text-[28px] font-[800] leading-[1.05] text-sky-950 sm:text-[34px]">
                Photo to SVG Outline
              </h1>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
              />

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
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#f7faff] border border-[#dae6ff] text-slate-900 mt-0">
                    <div className="flex items-center min-w-0 gap-2">
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt=""
                          className="w-[22px] h-[22px] rounded-md object-cover mr-1"
                        />
                      )}
                      <span title={file?.name || ""} className="truncate">
                        {file?.name} • {prettyBytes(file?.size || 0)}
                        {originalFileSize && originalFileSize > file.size
                          ? ` (shrunk from ${prettyBytes(originalFileSize)})`
                          : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setFile(null);
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


              {/* Convert + status */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => void submitConvert()}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons name="convert" size={20} className="mr-1" />
                  {busy ? "Converting…" : "Convert photo to outline"}
                </button>

                {file && autoMode !== "fast" && (
                  <span className="text-[13px] text-slate-600">
                    {autoModeHint(autoMode)} {autoModeDetail(autoMode)}
                  </span>
                )}

                {err && <span className="text-red-700 text-sm">{err}</span>}
                {!err && info && (
                  <span className="text-[13px] text-slate-600">{info}</span>
                )}
              </div>


              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">
                  Photo outline tuning tips
                </div>
                <ul className="mt-2 text-sm text-slate-600 list-disc pl-5">
                  <li>
                    Too much texture: raise <b>blur σ</b> and raise{" "}
                    <b>turd size</b>.
                  </li>
                  <li>
                    Missing edges: increase <b>edge boost</b> or increase{" "}
                    <b>threshold</b>.
                  </li>
                  <li>
                    Output is too chunky: lower <b>threshold</b> and reduce{" "}
                    <b>edge boost</b>.
                  </li>
                </ul>
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
              downloadFileName="photo-to-svg-outline.svg"
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
      <SeoSections />
      <OtherToolsLinks />
      <RelatedSites />
      <SocialLinks />
      <SiteFooter />
    </>
  );
}

/* ===== Client-side helpers (dimension precheck + compression <=25MB) ===== */
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

/** Compress to <=25MB (best effort). Converts PNG -> JPEG if needed. */
async function compressToTarget25MB(file: File): Promise<File> {
  const TARGET = LIVE_MED_MAX; // 25MB
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
    "This photo cannot be reduced below 25 MB without heavy quality loss.",
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

/* ===== UI helpers ===== */
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
  let v = bytes,
    i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

/* ===== Header & footer ===== */
function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 h-12 flex items-center justify-between">
        <a href="/" className="font-extrabold tracking-tight text-slate-900">
          i<span className="text-sky-600">🩵</span>SVG
        </a>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-4 text-[14px] font-semibold">
            <li>
              <a
                href="/#other-tools"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                All Tools
              </a>
            </li>
            <li>
              <a
                href="/image-to-svg-outline"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Image Outline
              </a>
            </li>
            <li>
              <a
                href="/photo-to-svg-outline"
                className="text-slate-900 underline underline-offset-4"
                aria-current="page"
              >
                Photo Outline
              </a>
            </li>
            <li>
              <a
                href="/logo-to-svg-converter"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Logo to SVG
              </a>
            </li>
            <li>
              <a
                href="/svg-recolor"
                className="text-slate-700 hover:text-slate-900 transition-colors"
              >
                Recolor
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

/* ===== SEO sections (photo-specific) ===== */
function SeoSections() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              photo to svg outline
            </p>

            <h2 className="mt-2 text-2xl md:text-3xl font-bold leading-tight text-slate-900">
              Turn photos into clean outline SVGs
            </h2>

            <p className="mt-3 text-slate-700 max-w-[88ch] leading-relaxed">
              This tool is tuned for photographs, not logos. It runs an{" "}
              <strong>edge-first</strong> pipeline to extract contours and
              suppress texture, then vectorizes the result into SVG paths. The
              goal is a clean outline you can edit, recolor, and scale without
              the “hairy” line noise that happens when you trace a photo
              directly.
            </p>

            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "Photo-first", v: "Edge preprocessing tuned for photos" },
                { k: "Noise control", v: "Blur and speck removal presets" },
                {
                  k: "Editable output",
                  v: "SVG paths with responsive viewBox",
                },
                {
                  k: "Private by default",
                  v: "In-memory conversion, no disk writes",
                },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {x.k}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{x.v}</div>
                </div>
              ))}
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

          {/* Utility-first content (photo-specific) */}
          <section>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
              <h3 className="m-0 text-xl font-bold text-slate-900">
                How to get a clean outline from a photo
              </h3>

              <div className="mt-3 grid gap-4 text-slate-700 leading-relaxed">
                <p className="m-0">
                  Photos contain texture: skin pores, fabric weave, grass,
                  noise, compression artifacts, and background detail. If you
                  trace that directly, the SVG turns into thousands of tiny
                  edges. The “clean outline” look comes from doing the opposite:
                  reduce detail first, then trace only the strongest contours.
                </p>

                <p className="m-0">
                  Start by choosing a preset that matches your input. For busy
                  scenes and noisy images, begin with a <strong>Soft</strong>{" "}
                  outline preset that uses more blur and stronger speck removal.
                  For simple subjects on plain backgrounds, use{" "}
                  <strong>Strong edges</strong> to keep bold contours. Then use
                  the preview to balance three controls: blur (remove texture),
                  threshold (what counts as an edge), and cleanup (remove small
                  isolated blobs).
                </p>

                <p className="m-0">
                  If you want a drawing-like outline, you usually want{" "}
                  <strong>fewer</strong> lines, not more. Increase blur until
                  the interior texture disappears, then raise edge strength
                  slightly to bring back only the main shape. Once the contour
                  is stable, increase curve tolerance to reduce nodes and smooth
                  the paths so the SVG edits cleanly in design tools.
                </p>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3 not-prose">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Blur reduces texture
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Raise blur when you see “hairy” noise lines from skin,
                    fabric, grass, or JPEG artifacts.
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Threshold selects edges
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Raise threshold to keep only stronger contours. Lower it if
                    the outline is missing key parts.
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Cleanup removes specks
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Increase speck removal (turd size) when you see random dots
                    and isolated blobs.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-lg font-bold text-slate-900">Best for</h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Portrait outlines",
                "Product photos",
                "Scenes",
                "Animals",
                "Stickers",
                "Simplified icons",
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Cleaner outputs",
                  body: "Use Soft for noisy photos and busy backgrounds. It increases blur and speck removal to suppress texture.",
                },
                {
                  title: "Stronger contours",
                  body: "Use Strong edges when the outline is too faint. Then raise threshold slightly to avoid pulling in texture.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {c.title}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ unchanged */}
          <CurrentRouteGuide />

          <section
            className="mt-12"
            itemScope
            itemType="https://schema.org/FAQPage"
          >
            <h3 className="text-lg font-bold text-slate-900">FAQ</h3>
            <div className="mt-4 grid gap-3">
              {[
                {
                  q: "Why does my photo become a mess of lines?",
                  a: "Increase blur and turd size, or use Photo Outline Soft. It reduces texture and background noise.",
                },
                {
                  q: "Why are edges missing?",
                  a: "Increase edge boost or increase threshold. If the photo is low-contrast, boost edges more.",
                },
                {
                  q: "Can I make it look more like a drawing?",
                  a: "Yes. Increase curve tolerance slightly and use stronger edges, then recolor/adjust background.",
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
                    className="m-0 font-semibold text-slate-900"
                  >
                    {x.q}
                  </h4>
                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm text-slate-700 leading-relaxed"
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
