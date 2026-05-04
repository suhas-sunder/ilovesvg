import * as React from "react";
import type { Route } from "./+types/png-to-layered-svg-for-cricut";
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
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import { ChevronDownIcon, PresetPicker } from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
  FullscreenPreviewButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import { EditedSvgPreviewImage } from "~/client/components/svg/EditedSvgPreviewImage";
import { extendLayeredPresets } from "~/client/lib/converter/presetAdditions";
import type { PresetBackendIntensity } from "~/client/lib/converter/presetIntensity";
import { LayeredAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  appendAdvancedTraceSettings,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";
import { AdvancedSettingsHelpSection } from "~/client/components/converter/AdvancedSettingsHelpSection";
import { logAppError } from "~/client/lib/errorLogging";

const isServer = typeof document === "undefined";

/* ========================
   Meta
======================== */
export function meta({}: Route.MetaArgs) {
  const title =
    "PNG to Layered SVG for Cricut - Free Layered PNG SVG Converter";
  const description =
    "Convert PNG artwork into editable layered SVG files for Cricut Design Space. Split colors into groups, recolor layers, preview, and download.";
  const canonical = "https://www.ilovesvg.com/png-to-layered-svg-for-cricut";

  return [
    { title },
    { name: "description", content: description },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#0b2dff" },
    { name: "robots", content: "index,follow" },

    { tagName: "link", rel: "canonical", href: canonical },

    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    { property: "og:site_name", content: "iLoveSVG" },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

/* ========================
   Limits
======================== */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_MP = 30;
const MAX_SIDE = 8000;
const MIN_TRACE_SIDE = 2;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 450;
const LIVE_MED_MS = 1600;

const MIN_LAYER_COUNT = 2;
const MAX_LAYER_COUNT = 10;
const MAX_TRACE_SIDE_DEFAULT = 1600;

/* ========================
   Server concurrency gate
======================== */
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
      "png-to-layered-svg-for-cricut",
      "layered-trace",
      HEAVY_BACKEND_RATE_LIMITS
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
    const clientRunId = sanitizeClientRunId(form.get("clientRunId"));

    const fileCountError = validateMultipartFileCount(form);
    if (fileCountError) return fileCountError;

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No PNG file uploaded." }, { status: 400 });
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
        { error: "Upload a PNG, JPG, JPEG, or WebP image." },
        { status: 415 },
      );
    }

    if ((webFile.size || 0) > MAX_UPLOAD_BYTES) {
      return json(
        {
          error: `File too large. Max ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB per PNG image.`,
        },
        { status: 413 },
      );
    }

    const gate = await getGate();
    let release: ReleaseFn | null = null;

    try {
      release = await gate.acquireOrQueue();
    } catch (e: any) {
      const retryAfterMs = Math.max(1500, Number(e?.retryAfterMs) || 2500);

      return json(
        {
          error:
            "Server is busy converting other PNG layered SVGs. Retrying automatically.",
          retryAfterMs,
          code: "BUSY",
          clientRunId,
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
      // @ts-ignore Buffer exists in Remix node runtime
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
            { error: "Could not read PNG dimensions. Try a different file." },
            { status: 415 },
          );
        }

        if (w < MIN_TRACE_SIDE || h < MIN_TRACE_SIDE) {
          return json(
            {
              error:
                "Image is too small to trace safely. Please upload an image at least 2×2 pixels.",
            },
            { status: 415 },
          );
        }

        const mp = (w * h) / 1_000_000;
        if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
          return json(
            {
              error: `PNG too large: ${w}×${h} (~${mp.toFixed(
                1,
              )} MP). Max ${MAX_SIDE}px per side or ${MAX_MP} MP.`,
            },
            { status: 413 },
          );
        }
      } catch {
        // Continue. Main conversion will fail cleanly if invalid.
      }

      const layerCount = clampInt(
        Number(form.get("layerCount") ?? 4),
        MIN_LAYER_COUNT,
        MAX_LAYER_COUNT,
      );

      const maxTraceSide = clampInt(
        Number(form.get("maxTraceSide") ?? MAX_TRACE_SIDE_DEFAULT),
        600,
        2400,
      );

      const minRegionPercent = clampNumber(
        Number(form.get("minRegionPercent") ?? 0.25),
        0,
        5,
      );

      const optTolerance = clampNumber(
        Number(form.get("optTolerance") ?? 0.35),
        0.05,
        1.2,
      );

      const turdSize = clampInt(Number(form.get("turdSize") ?? 3), 0, 20);

      const posterize =
        String(form.get("posterize") ?? "true").toLowerCase() === "true";

      const removeWhite =
        String(form.get("removeWhite") ?? "false").toLowerCase() === "true";

      const removeTransparent =
        String(form.get("removeTransparent") ?? "true").toLowerCase() ===
        "true";

      const transparent =
        String(form.get("transparent") ?? "true").toLowerCase() === "true";

      const bgColor = sanitizeHexColor(
        String(form.get("bgColor") ?? "#ffffff"),
        "#ffffff",
      );

      const turnPolicy = String(form.get("turnPolicy") ?? "minority") as
        | "black"
        | "white"
        | "left"
        | "right"
        | "minority"
        | "majority";

      const {
        readAdvancedTraceFormSettings,
        shouldRemoveSelectedColors,
      } = await import("../utils/converterSettings.server");
      const advancedTraceSettings = readAdvancedTraceFormSettings(form);

      const { createLayeredColorSvg } = await import(
        "../utils/svgLayerTrace.server"
      );
      const result = await createLayeredColorSvg(input, {
        layerCount,
        maxTraceSide,
        minRegionPercent,
        optTolerance,
        turdSize,
        posterize,
        removeWhite,
        removeTransparent,
        transparent,
        bgColor,
        turnPolicy,
        removeColors: shouldRemoveSelectedColors(advancedTraceSettings, "layered")
          ? advancedTraceSettings.removeColors
          : [],
        removeColorTolerance: advancedTraceSettings.removeColorTolerance,
        backgroundAlpha: advancedTraceSettings.backgroundAlpha,
        layerAlpha: advancedTraceSettings.layerAlpha,
        colorMergeTolerance: advancedTraceSettings.colorMergeTolerance,
        posterizeStrength: advancedTraceSettings.posterizeStrength,
        sortLayersBy: advancedTraceSettings.sortLayersBy,
        brightness: advancedTraceSettings.brightness,
        contrast: advancedTraceSettings.contrast,
        outputWidth: advancedTraceSettings.outputWidth,
        outputHeight: advancedTraceSettings.outputHeight,
        preserveAspectRatio: advancedTraceSettings.preserveAspectRatio,
      })

      return json({
        ...result,
        clientRunId,
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
    void err;
    return json(
      {
        error:
          "Layered SVG conversion failed. Please try a smaller image or fewer color layers.",
        code: "CONVERSION_FAILED",
      },
      { status: 500 },
    );
  }
}

/* ========================
   Layered SVG engine
======================== */
type RGB = { r: number; g: number; b: number };

type LayeredOptions = {
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  optTolerance: number;
  turdSize: number;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  transparent: boolean;
  bgColor: string;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
};

type ServerLayer = {
  id: string;
  name: string;
  color: string;
  pixelPercent: number;
  pathTags: string;
};

async function rasterToLayeredSvg(
  input: Buffer,
  options: LayeredOptions,
): Promise<{
  svg: string;
  width: number;
  height: number;
  layers: ServerLayer[];
  palette: string[];
}> {
  throw new Error("Layered SVG tracing is handled by the server action.");
}

function collectPixels(
  raw: Buffer,
  width: number,
  height: number,
  options: {
    removeTransparent: boolean;
    removeWhite: boolean;
    posterize: boolean;
  },
): RGB[] {
  const total = width * height;
  const pixels: RGB[] = [];

  const sampleStep = Math.max(1, Math.floor(total / 16000));

  for (let i = 0; i < total; i += sampleStep) {
    const off = i * 4;
    const a = raw[off + 3];

    if (options.removeTransparent && a < 18) continue;

    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];

    if (a < 255 && !options.removeTransparent) {
      r = blendChannel(r, a, 255);
      g = blendChannel(g, a, 255);
      b = blendChannel(b, a, 255);
    }

    if (options.posterize) {
      r = posterizeChannel(r);
      g = posterizeChannel(g);
      b = posterizeChannel(b);
    }

    if (options.removeWhite && isNearWhite({ r, g, b })) continue;

    pixels.push({ r, g, b });
  }

  return pixels;
}

function assignAllPixelsToPalette(
  raw: Buffer,
  width: number,
  height: number,
  options: {
    palette: RGB[];
    removeTransparent: boolean;
    removeWhite: boolean;
    posterize: boolean;
  },
): {
  layerForPixel: Int16Array;
  counts: number[];
  assignableCount: number;
} {
  const total = width * height;
  const layerForPixel = new Int16Array(total);
  layerForPixel.fill(-1);

  const counts = new Array(options.palette.length).fill(0);
  let assignableCount = 0;

  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const a = raw[off + 3];

    if (options.removeTransparent && a < 18) continue;

    let r = raw[off];
    let g = raw[off + 1];
    let b = raw[off + 2];

    if (a < 255 && !options.removeTransparent) {
      r = blendChannel(r, a, 255);
      g = blendChannel(g, a, 255);
      b = blendChannel(b, a, 255);
    }

    if (options.posterize) {
      r = posterizeChannel(r);
      g = posterizeChannel(g);
      b = posterizeChannel(b);
    }

    const rgb = { r, g, b };

    if (options.removeWhite && isNearWhite(rgb)) continue;

    const nearest = nearestPaletteIndex(rgb, options.palette);
    layerForPixel[i] = nearest;
    counts[nearest]++;
    assignableCount++;
  }

  return { layerForPixel, counts, assignableCount };
}

function buildPalette(pixels: RGB[], requestedCount: number): RGB[] {
  const k = clampInt(requestedCount, MIN_LAYER_COUNT, MAX_LAYER_COUNT);

  const uniqueMap = new Map<string, RGB>();
  for (const p of pixels) {
    uniqueMap.set(`${p.r},${p.g},${p.b}`, p);
    if (uniqueMap.size >= 4096) break;
  }

  const unique = Array.from(uniqueMap.values());
  if (unique.length <= k) return unique;

  const centroids = seedCentroids(unique, k);

  for (let iter = 0; iter < 12; iter++) {
    const sums = centroids.map(() => ({
      r: 0,
      g: 0,
      b: 0,
      count: 0,
    }));

    for (const p of pixels) {
      const idx = nearestPaletteIndex(p, centroids);
      sums[idx].r += p.r;
      sums[idx].g += p.g;
      sums[idx].b += p.b;
      sums[idx].count++;
    }

    for (let i = 0; i < centroids.length; i++) {
      const s = sums[i];
      if (!s.count) continue;

      centroids[i] = {
        r: Math.round(s.r / s.count),
        g: Math.round(s.g / s.count),
        b: Math.round(s.b / s.count),
      };
    }
  }

  return dedupePalette(centroids).slice(0, k);
}

function seedCentroids(pixels: RGB[], k: number): RGB[] {
  const sorted = [...pixels].sort((a, b) => {
    const lumDiff = luminance(a) - luminance(b);
    if (Math.abs(lumDiff) > 1) return lumDiff;
    return a.r + a.g + a.b - (b.r + b.g + b.b);
  });

  const seeds: RGB[] = [];

  for (let i = 0; i < k; i++) {
    const idx = Math.round((i / Math.max(1, k - 1)) * (sorted.length - 1));
    seeds.push(sorted[idx]);
  }

  return dedupePalette(seeds);
}

function dedupePalette(palette: RGB[]): RGB[] {
  const seen = new Set<string>();
  const out: RGB[] = [];

  for (const p of palette) {
    const key = `${p.r},${p.g},${p.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }

  return out;
}

async function traceMaskToPathTags(
  maskPng: Buffer,
  options: {
    turdSize: number;
    optTolerance: number;
    turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  },
): Promise<string> {
  const { traceBitmapToSvg } = await import("~/utils/potraceCompat");
  const opts: any = {
    color: "#000000",
    threshold: 128,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  };

  const svgRaw: string = await traceBitmapToSvg(maskPng, opts);

  return extractPathTags(svgRaw);
}

function extractPathTags(svg: string): string {
  const matches = svg.match(/<path\b[^>]*>/gi) || [];

  return matches
    .map((tag) => {
      let clean = tag;

      clean = clean.replace(/\sfill\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "");
      clean = clean.replace(/\s\/?>$/i, " />");

      return clean;
    })
    .join("");
}

function buildLayeredSvgString({
  width,
  height,
  layers,
  transparent,
  bgColor,
}: {
  width: number;
  height: number;
  layers: ServerLayer[];
  transparent: boolean;
  bgColor: string;
}) {
  const background = transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${bgColor}" />`;

  const body = layers
    .map((layer, index) => {
      const fill = sanitizeHexColor(layer.color, "#000000");
      const safeId = escapeXmlAttr(layer.id || `layer-${index + 1}`);
      const safeLabel = escapeXmlAttr(layer.name || `Layer ${index + 1}`);

      return `<g id="${safeId}" data-layer-name="${safeLabel}" data-layer-color="${fill}" fill="${fill}">${layer.pathTags}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from PNG for Cricut">${background}${body}</svg>`;
}

function maskHasInk(mask: Buffer) {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 250) return true;
  }

  return false;
}

function nearestPaletteIndex(color: RGB, palette: RGB[]) {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i++) {
    const d = colorDistance(color, palette[i]);

    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }

  return best;
}

function colorDistance(a: RGB, b: RGB) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;

  return dr * dr * 0.32 + dg * dg * 0.52 + db * db * 0.16;
}

function luminance(c: RGB) {
  return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
}

function blendChannel(channel: number, alpha: number, bg: number) {
  return Math.round((channel * alpha + bg * (255 - alpha)) / 255);
}

function posterizeChannel(v: number) {
  return Math.round(v / 32) * 32;
}

function isNearWhite(c: RGB) {
  return c.r >= 244 && c.g >= 244 && c.b >= 244;
}

function rgbToHex(c: RGB) {
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function toHex(n: number) {
  return clampInt(n, 0, 255).toString(16).padStart(2, "0");
}

function sanitizeHexColor(input: string, fallback: string) {
  const value = String(input || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  return fallback;
}

function escapeXmlAttr(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.round(Math.min(max, Math.max(min, n)));
}

function sanitizeClientRunId(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);
}

/* ========================
   UI types and presets
======================== */
type Settings = TraceAdvancedSettings & {
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  optTolerance: number;
  turdSize: number;
  turnPolicy: "black" | "white" | "left" | "right" | "minority" | "majority";
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  transparent: boolean;
  bgColor: string;
};

type Preset = {
  id: string;
  label: string;
  settings: Partial<Settings>;
  category?: "layered";
  backendIntensity?: PresetBackendIntensity;
};

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  layerCount: 5,
  maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
  minRegionPercent: 0.35,
  optTolerance: 0.45,
  turdSize: 4,
  turnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
  transparent: true,
  bgColor: "#ffffff",
};

const routeCapabilities = getRouteCapabilities("png-to-layered-svg-for-cricut");

const PRESET_DEFINITIONS: Preset[] = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    settings: {
      layerCount: 5,
      maxTraceSide: MAX_TRACE_SIDE_DEFAULT,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-color-smoother",
    label: "Layered color SVG - Smoother",
    settings: {
      layerCount: 4,
      maxTraceSide: 1200,
      minRegionPercent: 0.55,
      optTolerance: 0.65,
      turdSize: 7,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-color-detail",
    label: "Layered color SVG - More detail",
    settings: {
      layerCount: 8,
      maxTraceSide: 2000,
      minRegionPercent: 0.2,
      optTolerance: 0.32,
      turdSize: 2,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "layered-color-fewer",
    label: "Layered color SVG - Fewer larger layers",
    settings: {
      layerCount: 3,
      maxTraceSide: 1200,
      minRegionPercent: 0.8,
      optTolerance: 0.75,
      turdSize: 9,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
    },
  },
  {
    id: "png-balanced",
    label: "PNG - Balanced Layers",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.25,
      optTolerance: 0.35,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "transparent-png-clean",
    label: "Transparent PNG - Clean Layers",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.2,
      optTolerance: 0.32,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "png-logo-clean",
    label: "PNG Logo - Clean Multi-Color",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.18,
      optTolerance: 0.25,
      turdSize: 2,
      posterize: false,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 2000,
    },
  },
  {
    id: "png-icon-flat",
    label: "PNG Icon - Flat Layers",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.15,
      optTolerance: 0.22,
      turdSize: 2,
      posterize: false,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 2000,
    },
  },
  {
    id: "png-sticker",
    label: "PNG Sticker - Bold Colors",
    settings: {
      layerCount: 6,
      minRegionPercent: 0.3,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "png-print-then-cut",
    label: "PNG Print Then Cut - Simplified",
    settings: {
      layerCount: 7,
      minRegionPercent: 0.25,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "png-vinyl",
    label: "PNG to Vinyl - Fewer Pieces",
    settings: {
      layerCount: 3,
      minRegionPercent: 1,
      optTolerance: 0.7,
      turdSize: 8,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "black",
      maxTraceSide: 1200,
    },
  },
  {
    id: "png-htv",
    label: "PNG to HTV - Simple Layers",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.85,
      optTolerance: 0.68,
      turdSize: 8,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1200,
    },
  },
  {
    id: "png-paper-craft",
    label: "Paper Craft - Stacked Colors",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.45,
      optTolerance: 0.5,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "png-cardstock",
    label: "Cardstock - Bold Cutouts",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.8,
      optTolerance: 0.65,
      turdSize: 7,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1200,
    },
  },
  {
    id: "png-clipart",
    label: "PNG Clipart - Clean Color Areas",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.22,
      optTolerance: 0.3,
      turdSize: 3,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
  {
    id: "png-cartoon",
    label: "PNG Cartoon - More Colors",
    settings: {
      layerCount: 8,
      minRegionPercent: 0.2,
      optTolerance: 0.42,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1700,
    },
  },
  {
    id: "png-kids-illustration",
    label: "Kids Illustration - Bright Layers",
    settings: {
      layerCount: 8,
      minRegionPercent: 0.25,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "png-white-bg-remove",
    label: "White Background PNG - Remove",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1500,
    },
  },
  {
    id: "png-shadow-layer",
    label: "Shadow Layer - Bold Shapes",
    settings: {
      layerCount: 3,
      minRegionPercent: 1,
      optTolerance: 0.8,
      turdSize: 8,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "black",
      maxTraceSide: 1200,
    },
  },
  {
    id: "png-2-color",
    label: "PNG 2 Color - Simple Cut",
    settings: {
      layerCount: 2,
      minRegionPercent: 0.5,
      optTolerance: 0.45,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1300,
    },
  },
  {
    id: "png-3-color-decal",
    label: "PNG 3 Color - Decal",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.45,
      optTolerance: 0.5,
      turdSize: 5,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "png-high-detail",
    label: "PNG High Detail - Preserve Colors",
    settings: {
      layerCount: 10,
      minRegionPercent: 0.1,
      optTolerance: 0.28,
      turdSize: 2,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 2200,
    },
  },
  {
    id: "png-sublimation-preview",
    label: "PNG Sublimation Preview",
    settings: {
      layerCount: 8,
      minRegionPercent: 0.15,
      optTolerance: 0.4,
      turdSize: 3,
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: false,
      bgColor: "#ffffff",
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
];

const PRESETS: Preset[] = PRESET_DEFINITIONS.map((preset) => ({
  ...preset,
  category: preset.category ?? "layered",
}));
const DISPLAY_PRESETS = extendLayeredPresets<Preset>(PRESETS);
const DEFAULT_PRESET_ID = PRESETS[0]?.id ?? "layered-color";

type ServerResult = {
  svg?: string;
  error?: string;
  width?: number;
  height?: number;
  retryAfterMs?: number;
  code?: string;
  clientRunId?: string;
  gate?: { running: number; queued: number };
  layers?: ServerLayer[];
  palette?: string[];
};

type LayerState = {
  id: string;
  name: string;
  color: string;
  originalColor: string;
  visible: boolean;
  opacity?: number;
  originalOpacity?: number;
  pixelPercent: number;
  pathTags: string;
};

type HistoryItem = {
  svg: string;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  stamp: number;
  name: string;
  parentStamp?: number | null;
  presetId?: string;
  presetLabel?: string;
  settingsSnapshot?: Settings;
  layers: LayerState[];
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
    return "Large PNG file; updates run less frequently to keep things smooth.";
  return "";
}

/* ========================
   Page
======================== */
export default function PngToLayeredSvgForCricut({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useFetcher<ServerResult>();

  const [file, setFile] = React.useState<File | null>(null);
  const [originalFileSize, setOriginalFileSize] = React.useState<number | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULTS);
  const [activePreset, setActivePreset] =
    React.useState<string>(DEFAULT_PRESET_ID);

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
  const [activeHistoryStamp, setActiveHistoryStamp] = React.useState<
    number | null
  >(null);
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const [toast, setToast] = React.useState<string | null>(null);
  const [openSettingsStamp, setOpenSettingsStamp] = React.useState<
    number | null
  >(null);
  const activeHistoryItem =
    history.find((item) => item.stamp === activeHistoryStamp) ||
    history[0] ||
    null;

  function selectHistoryOutput(id: string | number) {
    const stamp = Number(id);
    const item = history.find((candidate) => candidate.stamp === stamp);
    if (!item) return;
    setActiveHistoryStamp((current) =>
      current === item.stamp ? current : item.stamp,
    );
    const snapshot = item.settingsSnapshot;
    if (snapshot) {
      setSettings((current) =>
        settingsEqual(current, snapshot) ? current : snapshot,
      );
    }
    const presetId = item.presetId;
    if (presetId) {
      setActivePreset((current) => (current === presetId ? current : presetId));
    }
  }

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const retryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const outputCounterRef = React.useRef(0);
  const activeHistoryStampRef = React.useRef<number | null>(null);
  const latestSubmittedRunIdRef = React.useRef("");
  const clientRunIdCounterRef = React.useRef(0);
  const lastProcessedResultKeyRef = React.useRef("");
  const fileMeasureRunIdRef = React.useRef(0);
  const busyRetryCountRef = React.useRef(0);
  const lastHandledBusyKeyRef = React.useRef("");
  const lastSubmittedRef = React.useRef<{
    settings: Settings;
    presetId: string;
    parentStamp: number | null;
    replaceStamp: number | null;
  }>({
    settings: DEFAULTS,
    presetId: DEFAULT_PRESET_ID,
    parentStamp: null,
    replaceStamp: null,
  });

  const busy = fetcher.state !== "idle";

  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    activeHistoryStampRef.current = activeHistoryStamp;
  }, [activeHistoryStamp]);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;

    const mode = autoMode;
    if (mode === "off") return;

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void submitConvert(file, settings);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [file, autoMode]);

  React.useEffect(() => {
    if (!fetcher.data?.svg || !fetcher.data.layers?.length) return;
    const clientRunId = fetcher.data.clientRunId || "";
    if (
      clientRunId &&
      latestSubmittedRunIdRef.current &&
      clientRunId !== latestSubmittedRunIdRef.current
    ) {
      return;
    }

    const resultKey = [
      clientRunId || "legacy",
      fetcher.data.svg.length,
      fetcher.data.width ?? 0,
      fetcher.data.height ?? 0,
      fetcher.data.layers.length,
    ].join(":");
    if (lastProcessedResultKeyRef.current === resultKey) return;
    lastProcessedResultKeyRef.current = resultKey;
    busyRetryCountRef.current = 0;
    lastHandledBusyKeyRef.current = "";

    const outputNumber = outputCounterRef.current + 1;
    outputCounterRef.current = outputNumber;
    const submitted = lastSubmittedRef.current;
    const presetLabel =
      DISPLAY_PRESETS.find((preset) => preset.id === submitted.presetId)?.label ||
      "Custom settings";
    const stamp = Date.now();
    const item: HistoryItem = {
      svg: fetcher.data.svg,
      width: fetcher.data.width ?? 0,
      height: fetcher.data.height ?? 0,
      originalWidth: fetcher.data.width ?? 0,
      originalHeight: fetcher.data.height ?? 0,
      stamp,
      name: submitted.parentStamp
        ? `Output ${outputNumber} · Derived from Output`
        : `Output ${outputNumber} · ${presetLabel}`,
      parentStamp: submitted.parentStamp,
      presetId: submitted.presetId,
      presetLabel,
      settingsSnapshot: submitted.settings,
      layers: fetcher.data.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        color: layer.color,
        originalColor: layer.color,
        visible: true,
        opacity: 1,
        originalOpacity: 1,
        pixelPercent: layer.pixelPercent,
        pathTags: layer.pathTags,
      })),
    };

    if (submitted.replaceStamp) {
      setHistory((prev) => {
        let replaced = false;
        const next = prev.map((candidate) => {
          if (candidate.stamp !== submitted.replaceStamp) return candidate;
          replaced = true;
          return {
            ...item,
            stamp: candidate.stamp,
            name: candidate.name,
            parentStamp: candidate.parentStamp,
          };
        });
        return replaced ? next : [item, ...prev].slice(0, 10);
      });
      setActiveHistoryStamp(submitted.replaceStamp);
      setOpenSettingsStamp(submitted.replaceStamp);
    } else {
      setHistory((prev) => [item, ...prev].slice(0, 10));
      setActiveHistoryStamp((current) => (current === stamp ? current : stamp));
    }
    setInfo(null);
  }, [
    fetcher.data?.svg,
    fetcher.data?.width,
    fetcher.data?.height,
    fetcher.data?.clientRunId,
    fetcher.data?.layers,
  ]);

  React.useEffect(() => {
    if (history.length === 0) {
      if (activeHistoryStamp !== null) setActiveHistoryStamp(null);
      return;
    }

    if (!activeHistoryStamp || !history.some((item) => item.stamp === activeHistoryStamp)) {
      setActiveHistoryStamp(history[0].stamp);
    }
  }, [history, activeHistoryStamp]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;
    const clientRunId = fetcher.data.clientRunId || "";
    if (
      clientRunId &&
      latestSubmittedRunIdRef.current &&
      clientRunId !== latestSubmittedRunIdRef.current
    ) {
      return;
    }

    if (fetcher.data.code === "BUSY" && file) {
      const busyKey = [
        clientRunId || "legacy",
        fetcher.data.retryAfterMs ?? "",
        fetcher.data.error,
      ].join(":");
      if (lastHandledBusyKeyRef.current === busyKey) return;
      lastHandledBusyKeyRef.current = busyKey;

      if (busyRetryCountRef.current >= 3) {
        setInfo(null);
        setErr(
          "Server is still busy converting other images. Please try again in a moment.",
        );
        logAppError(new Error(fetcher.data.error), {
          flowStep: "png_layered_busy_retry_limit",
          flowKind: "conversion",
          action: "BUSY",
          selectedFileType: file.type,
          selectedFileSize: file.size,
          imageDimensions: dims ? { width: dims.w, height: dims.h } : null,
          settingsSnapshot: settings,
        });
        return;
      }
      busyRetryCountRef.current += 1;
      const retryAfterMs = Math.max(1500, fetcher.data.retryAfterMs ?? 2500);
      setInfo("Server is busy. Retrying automatically.");

      if (retryRef.current) clearTimeout(retryRef.current);

      retryRef.current = setTimeout(() => {
        submitConvert(file, settings);
      }, retryAfterMs);

      return;
    }

    setErr((current) =>
      current === fetcher.data?.error ? current : fetcher.data?.error || null,
    );
    logAppError(new Error(fetcher.data.error), {
      flowStep: "png_layered_conversion_response",
      flowKind: "conversion",
      action: fetcher.data.code || "server_response",
      selectedFileType: file?.type,
      selectedFileSize: file?.size,
      imageDimensions: dims ? { width: dims.w, height: dims.h } : null,
      settingsSnapshot: settings,
    });
  }, [
    fetcher.data?.error,
    fetcher.data?.code,
    fetcher.data?.retryAfterMs,
    fetcher.data?.clientRunId,
    file,
    dims,
    settings,
  ]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [previewUrl]);

  async function measureAndSet(f: File, runId = fileMeasureRunIdRef.current) {
    try {
      const { w, h } = await getImageSize(f);
      if (fileMeasureRunIdRef.current !== runId) return;
      const mp = (w * h) / 1_000_000;
      setDims((current) =>
        current && current.w === w && current.h === h && current.mp === mp
          ? current
          : { w, h, mp },
      );
    } catch (error) {
      if (fileMeasureRunIdRef.current !== runId) return;
      setDims((current) => (current === null ? current : null));
      logAppError(error, {
        flowStep: "png_layered_measure_image",
        flowKind: "async-processing",
        selectedFileType: f.type,
        selectedFileSize: f.size,
      });
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
      setErr("Please choose a PNG, JPG, JPEG, or WebP image.");
      return;
    }

    suppressLiveRef.current = true;
    busyRetryCountRef.current = 0;
    latestSubmittedRunIdRef.current = "";
    lastProcessedResultKeyRef.current = "";
    lastHandledBusyKeyRef.current = "";
    const measureRunId = fileMeasureRunIdRef.current + 1;
    fileMeasureRunIdRef.current = measureRunId;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);

    setFile(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(null);
    setSettings(DEFAULTS);
    setActivePreset(DEFAULT_PRESET_ID);
    setHistory([]);
    setActiveHistoryStamp(null);
    setOpenSettingsStamp(null);
    outputCounterRef.current = 0;
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    try {
      if (f.size > LIVE_MED_MAX) {
        setInfo("Compressing large PNG locally for live layered preview.");
        chosen = await compressToTarget25MB(f);
      }

      await validateBeforeSubmit(chosen);
    } catch (e: any) {
      suppressLiveRef.current = false;
      setInfo(null);
      setErr(e?.message || "PNG image is too large.");
      return;
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));

    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);

    await measureAndSet(chosen, measureRunId);

    suppressLiveRef.current = false;

    void submitConvert(chosen, DEFAULTS, {
      presetId: DEFAULT_PRESET_ID,
      parentStamp: null,
    });
  }

  async function submitConvert(
    fileOverride?: File | null,
    settingsOverride?: Settings,
    meta?: {
      presetId?: string;
      parentStamp?: number | null;
      replaceStamp?: number | null;
    },
  ) {
    const sourceFile = fileOverride ?? file;
    const sourceSettings = settingsOverride ?? settings;

    if (!sourceFile) {
      setErr("Choose a PNG image first.");
      return;
    }

    try {
      await validateBeforeSubmit(sourceFile);
    } catch (e: any) {
      setErr(e?.message || "PNG image is too large.");
      return;
    }

    const fd = new FormData();
    fd.append("file", sourceFile);
    fd.append("layerCount", String(sourceSettings.layerCount));
    fd.append("maxTraceSide", String(sourceSettings.maxTraceSide));
    fd.append("minRegionPercent", String(sourceSettings.minRegionPercent));
    fd.append("optTolerance", String(sourceSettings.optTolerance));
    fd.append("turdSize", String(sourceSettings.turdSize));
    fd.append("turnPolicy", sourceSettings.turnPolicy);
    fd.append("posterize", String(sourceSettings.posterize));
    fd.append("removeWhite", String(sourceSettings.removeWhite));
    fd.append("removeTransparent", String(sourceSettings.removeTransparent));
    fd.append("transparent", String(sourceSettings.transparent));
    fd.append("bgColor", sourceSettings.bgColor);
    appendAdvancedTraceSettings(fd, sourceSettings);
    const clientRunId = `png-layered-${Date.now()}-${++clientRunIdCounterRef.current}`;
    latestSubmittedRunIdRef.current = clientRunId;
    fd.append("clientRunId", clientRunId);

    setErr(null);
    lastSubmittedRef.current = {
      settings: sourceSettings,
      presetId: meta?.presetId ?? activePreset,
      parentStamp: meta?.parentStamp ?? activeHistoryStampRef.current,
      replaceStamp: meta?.replaceStamp ?? null,
    };

    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "?index"
          : `${window.location.pathname}?index`,
    });
  }

  function applyPreset(preset: Preset) {
    const nextSettings = {
      ...DEFAULTS,
      ...preset.settings,
    } as Settings;
    setActivePreset((current) => (current === preset.id ? current : preset.id));
    setSettings((current) =>
      settingsEqual(current, nextSettings) ? current : nextSettings,
    );
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (file && autoMode !== "off") {
      void submitConvert(file, nextSettings, {
        presetId: preset.id,
        parentStamp: activeHistoryStamp,
      });
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  function handleCopySvg(svg: string) {
    navigator.clipboard.writeText(svg).then(() => {
      showToast("Layered SVG copied");
    });
  }

  function updateHistoryItemLayers(
    stamp: number,
    updater: (layers: LayerState[]) => LayerState[],
  ) {
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.stamp !== stamp) return item;
        const layers = updater(item.layers);
        if (layerStateArraysEqual(item.layers, layers)) return item;
        changed = true;
        return {
          ...item,
          layers,
        };
      });
      return changed ? next : prev;
    });
  }

  function updateLatestOutputLayer(layerId: string, patch: Partial<LayerState>) {
    if (!activeHistoryItem) return;
    updateHistoryItemLayers(activeHistoryItem.stamp, (layers) =>
      layers.map((layer) =>
        layer.id === layerId && hasLayerPatchChanges(layer, patch)
          ? { ...layer, ...patch }
          : layer,
      ),
    );
  }

  function resetLatestOutputLayer(layerId: string) {
    if (!activeHistoryItem) return;
    updateHistoryItemLayers(activeHistoryItem.stamp, (layers) =>
      layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              color: layer.originalColor,
              visible: true,
              opacity: layer.originalOpacity ?? 1,
            }
          : layer,
      ),
    );
  }

  function resetAllLatestOutputLayers() {
    if (!activeHistoryItem) return;
    updateHistoryItemLayers(activeHistoryItem.stamp, (layers) =>
      layers.map((layer) => ({
        ...layer,
        color: layer.originalColor,
        visible: true,
        opacity: layer.originalOpacity ?? 1,
      })),
    );
  }

  function updateLatestOutputSize(size: { width: number; height: number }) {
    const stamp = activeHistoryItem?.stamp;
    if (!stamp) return;
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.stamp !== stamp) return item;
        const originalWidth = item.originalWidth || item.width;
        const originalHeight = item.originalHeight || item.height;
        if (
          item.width === size.width &&
          item.height === size.height &&
          item.originalWidth === originalWidth &&
          item.originalHeight === originalHeight
        ) {
          return item;
        }
        changed = true;
        return {
          ...item,
          width: size.width,
          height: size.height,
          originalWidth,
          originalHeight,
        };
      });
      return changed ? next : prev;
    });
  }

  const buttonDisabled = isServer || !hydrated || busy || !file;

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

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start sm:pt-6 lg:pt-0 lg:pb-8">
            <div className="order-1 min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] sm:border sm:border-slate-200">
              <h1 className="inline-flex text-center w-full justify-center mb-3 text-sky-950 items-center gap-2 text-xl sm:text-3xl font-extrabold leading-none m-0">
                PNG to Layered SVG for Cricut
              </h1>

              <p className="mb-3 text-center text-sm text-slate-600">
                Convert transparent PNGs, logos, clipart, decals, stickers, and
                other raster artwork into editable color-separated SVG layers
                for Cricut Design Space.
              </p>

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
                        {originalFileSize &&
                          originalFileSize > file.size &&
                          ` (shrunk from ${prettyBytes(originalFileSize)})`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        if (debounceRef.current) {
                          clearTimeout(debounceRef.current);
                        }
                        if (retryRef.current) clearTimeout(retryRef.current);
                        setFile(null);
                        setPreviewUrl(null);
                        setAutoMode("off");
                        setDims(null);
                        setErr(null);
                        setInfo(null);
                        setOriginalFileSize(null);
                        setHistory([]);
                        setActiveHistoryStamp(null);
                        setOpenSettingsStamp(null);
                        outputCounterRef.current = 0;
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
                  onClick={() => submitConvert(file, settings)}
                  disabled={buttonDisabled}
                  suppressHydrationWarning
                  className={[
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors",
                    "text-white bg-[#0b2dff] border-[#0a24da] hover:bg-[#0a24da] hover:border-[#091ec0]",
                    "disabled:opacity-70 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icons
                    name="convert"
                    size={18}
                    className="mr-1"
                    title="Convert"
                  />
                  {busy ? "Building PNG layers…" : "Convert PNG to Layered SVG"}
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

              {previewUrl && (
                <div className="hidden md:flex flex-col mt-3 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <p className="text-slate-700 ml-2 mt-1">
                    Original PNG Preview:
                  </p>
                  <img
                    src={previewUrl}
                    alt="Input PNG"
                    className="relative w-full h-auto block transparent-checkerboard"
                  />
                </div>
              )}
            </div>

            <div className="order-2 min-w-0 overflow-auto rounded-2xl border border-slate-300/40 bg-[#43546b] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start">
              {busy && (
                <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              )}

              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item, index) => {
                    const isActiveOutput =
                      activeHistoryItem?.stamp === item.stamp;
                    const itemSettings = isActiveOutput
                      ? settings
                      : item.settingsSnapshot || settings;
                    const editedSvg = buildClientLayeredSvg({
                      width: item.width,
                      height: item.height,
                      viewBoxWidth: item.originalWidth || item.width,
                      viewBoxHeight: item.originalHeight || item.height,
                      layers: item.layers,
                      transparent: itemSettings.transparent,
                      bgColor: itemSettings.bgColor,
                      backgroundAlpha: itemSettings.backgroundAlpha ?? 1,
                      layerAlpha: itemSettings.layerAlpha ?? 1,
                    });

                    return (
                      <div
                        key={item.stamp}
                        onDoubleClick={() => selectHistoryOutput(item.stamp)}
                        className={[
                          "rounded-xl border bg-white p-2 transition-colors",
                          isActiveOutput
                            ? "border-sky-400 ring-2 ring-sky-100"
                            : "border-slate-200",
                        ].join(" ")}
                      >
                        <div className="flex gap-3 items-center flex-wrap justify-between">
                          <span className="text-[13px] font-semibold text-slate-700">
                            {item.name}
                            {isActiveOutput ? " · editing" : ""}
                          </span>
                          <span className="text-[13px] text-slate-600">
                            {item.width > 0 && item.height > 0
                              ? `${item.width} × ${item.height} px`
                              : "size unknown"}{" "}
                            • {item.layers.length} layers
                          </span>
                        </div>
                        <p className="m-0 mt-1 text-[12px] text-slate-500">
                          Open Settings on an output to edit that preview.
                        </p>

                        <div className="flex gap-2 flex-wrap my-2">
                          <button
                            type="button"
                            onClick={() => {
                              const b = new Blob([editedSvg], {
                                type: "image/svg+xml;charset=utf-8",
                              });
                              const u = URL.createObjectURL(b);
                              const a = document.createElement("a");
                              a.href = u;
                              a.download = "png-to-layered-svg-for-cricut.svg";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(u);
                            }}
                            className="flex justify-center items-center px-3 py-2 rounded-lg font-semibold border bg-sky-500 hover:bg-sky-600 text-white border-sky-600 cursor-pointer"
                          >
                            <Icons
                              name="download"
                              size={16}
                              className="inline-block mr-1"
                            />
                            Download Layered SVG
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopySvg(editedSvg)}
                            className="flex justify-center items-center px-3 py-2 rounded-lg font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 cursor-pointer"
                          >
                            <Icons
                              name="copy"
                              size={16}
                              className="inline-block mr-1"
                            />
                            Copy SVG
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              selectHistoryOutput(item.stamp);
                              setOpenSettingsStamp((current) =>
                                current === item.stamp ? null : item.stamp,
                              );
                            }}
                            aria-expanded={openSettingsStamp === item.stamp}
                            aria-controls={`output-settings-${item.stamp}`}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          >
                            <Icons
                              name="settings"
                              size={16}
                              className="mr-1 inline-block"
                            />
                            Settings
                          </button>
                        </div>

                        {openSettingsStamp === item.stamp && (
                          <div
                            id={`output-settings-${item.stamp}`}
                            className="mb-2 rounded-xl border border-sky-200 bg-sky-50/70 p-2"
                          >
                            <LayeredAdvancedSettingsPanel
                              id={`output-settings-panel-${item.stamp}`}
                              open={true}
                              settings={itemSettings}
                              setSettings={setSettings}
                              capabilities={routeCapabilities}
                              detectedColorItems={[item]}
                              sourceFile={file}
                              removeColorsEnabled={
                                !(file && (file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "")))
                              }
                              outputLayerItems={item.layers}
                              outputSize={{
                                width: item.width,
                                height: item.height,
                                originalWidth: item.originalWidth || item.width,
                                originalHeight: item.originalHeight || item.height,
                              }}
                              onOutputLayerChange={(layerId, patch) =>
                                updateHistoryItemLayers(item.stamp, (layers) =>
                                  layers.map((layer) =>
                                    layer.id === layerId
                                      ? { ...layer, ...patch }
                                      : layer,
                                  ),
                                )
                              }
                              onResetOutputLayer={(layerId) =>
                                updateHistoryItemLayers(item.stamp, (layers) =>
                                  layers.map((layer) =>
                                    layer.id === layerId
                                      ? {
                                          ...layer,
                                          color: layer.originalColor,
                                          visible: true,
                                          opacity: layer.originalOpacity ?? 1,
                                        }
                                      : layer,
                                  ),
                                )
                              }
                              onResetAllOutputLayers={() =>
                                updateHistoryItemLayers(item.stamp, (layers) =>
                                  layers.map((layer) => ({
                                    ...layer,
                                    color: layer.originalColor,
                                    visible: true,
                                    opacity: layer.originalOpacity ?? 1,
                                  })),
                                )
                              }
                              onOutputSizeChange={(size) => {
                                selectHistoryOutput(item.stamp);
                                updateLatestOutputSize(size);
                              }}
                              helpHref="#advanced-settings-help"
                              buttonDisabled={buttonDisabled}
                              liveSectionDescription="These settings edit this output card directly. Copy and download use the current visible SVG."
                              livePreviewLead={
                                <div className="rounded-xl border border-slate-200 bg-white p-2">
                                  <p className="m-0 mb-2 text-[13px] font-bold text-slate-900">
                                    Layer colors
                                  </p>
                                  <LayerControls
                                    layers={item.layers}
                                    onChange={(nextLayers) =>
                                      updateHistoryItemLayers(
                                        item.stamp,
                                        () => nextLayers,
                                      )
                                    }
                                    onLayerChange={(layerId, patch) =>
                                      updateHistoryItemLayers(item.stamp, (layers) =>
                                        layers.map((layer) =>
                                          layer.id === layerId
                                            ? { ...layer, ...patch }
                                            : layer,
                                        ),
                                      )
                                    }
                                    onReset={() =>
                                      updateHistoryItemLayers(item.stamp, (layers) =>
                                        layers.map((layer) => ({
                                          ...layer,
                                          color: layer.originalColor,
                                          visible: true,
                                          opacity: layer.originalOpacity ?? 1,
                                        })),
                                      )
                                    }
                                  />
                                </div>
                              }
                              convertSectionDescription="These settings retrace the source image for this output only. Unapplied changes apply after Update preview."
                              hideOutputLayerStyling={true}
                              onUpdatePreview={() =>
                                void submitConvert(file, itemSettings, {
                                  presetId: item.presetId,
                                  parentStamp: item.parentStamp,
                                  replaceStamp: item.stamp,
                                })
                              }
                            />
                          </div>
                        )}

                        <div className="relative rounded-xl border border-slate-200 bg-white transparent-checkerboard min-h-[240px] flex items-center justify-center p-2">
                          <FullscreenPreviewButton onOpen={() => setFullscreenPreviewIndex(index)} />
                          <EditedSvgPreviewImage
                            svg={editedSvg}
                            alt="Layered SVG result from PNG"
                            className="max-w-full h-auto"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="converter-empty-output-state">
                  {!busy && (
                    <Icons
                      name="success"
                      size={20}
                      className="inline-block mr-1"
                    />
                  )}
                  {busy
                    ? "Building layered SVG…"
                    : "Layered SVG files appear here..."}
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
            svg: buildClientLayeredSvg({ width: item.width, height: item.height, viewBoxWidth: item.originalWidth || item.width, viewBoxHeight: item.originalHeight || item.height, layers: item.layers, transparent: (activeHistoryItem?.stamp === item.stamp ? settings : item.settingsSnapshot || settings).transparent, bgColor: (activeHistoryItem?.stamp === item.stamp ? settings : item.settingsSnapshot || settings).bgColor, backgroundAlpha: (activeHistoryItem?.stamp === item.stamp ? settings : item.settingsSnapshot || settings).backgroundAlpha ?? 1, layerAlpha: (activeHistoryItem?.stamp === item.stamp ? settings : item.settingsSnapshot || settings).layerAlpha ?? 1 }),
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

      <AdvancedSettingsHelpSection />
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
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Upload a PNG, JPG, JPEG, or WebP image.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large. Max 30 MB per PNG image.");
  }

  const { w, h } = await getImageSize(file);

  if (!w || !h) throw new Error("Could not read PNG dimensions.");
  if (w < MIN_TRACE_SIDE || h < MIN_TRACE_SIDE) {
    throw new Error(
      "Image is too small to trace safely. Please upload an image at least 2×2 pixels.",
    );
  }

  const mp = (w * h) / 1_000_000;

  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `PNG too large: ${w}×${h} (~${mp.toFixed(
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

    ctx.drawImage(img as any, 0, 0, w, h);

    const mime = "image/png";

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

  let scale = 0.9;

  while (w > 64 && h > 64) {
    w = Math.max(64, Math.floor(w * scale));
    h = Math.max(64, Math.floor(h * scale));

    const b = await encode(0.92);

    if (b.size <= TARGET) {
      return new File([b], renameToPng(file.name), { type: "image/png" });
    }

    scale = Math.max(0.5, scale - 0.07);
  }

  throw new Error(
    "This PNG cannot be reduced below 25 MB without excessive degradation.",
  );
}

function renameToPng(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.png`;
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

function buildClientLayeredSvg({
  width,
  height,
  viewBoxWidth = width,
  viewBoxHeight = height,
  layers,
  transparent,
  bgColor,
  backgroundAlpha = 1,
  layerAlpha = 1,
}: {
  width: number;
  height: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  layers: LayerState[];
  transparent: boolean;
  bgColor: string;
  backgroundAlpha?: number;
  layerAlpha?: number;
}) {
  const safeBackgroundAlpha = normalizeClientOpacity(backgroundAlpha);
  const bg = transparent
    ? ""
    : `<rect x="0" y="0" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="${sanitizeClientColor(
        bgColor,
        "#ffffff",
      )}"${safeBackgroundAlpha < 1 ? ` opacity="${formatClientOpacity(safeBackgroundAlpha)}"` : ""} />`;

  const body = layers
    .filter((layer) => layer.visible)
    .map((layer, index) => {
      const color = sanitizeClientColor(layer.color, layer.originalColor);
      const safeId = escapeClientAttr(layer.id || `layer-${index + 1}`);
      const safeName = escapeClientAttr(layer.name || `Layer ${index + 1}`);
      const opacity = normalizeClientOpacity(
        normalizeClientOpacity(layer.opacity) * normalizeClientOpacity(layerAlpha),
      );
      const opacityAttr =
        opacity < 1 ? ` opacity="${formatClientOpacity(opacity)}" data-editor-opacity="true"` : "";

      return `<g id="${safeId}" data-layer-name="${safeName}" fill="${color}"${opacityAttr}>${layer.pathTags}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" role="img" aria-label="Layered SVG from PNG for Cricut">${bg}${body}</svg>`;
}

function settingsEqual(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hasLayerPatchChanges(
  layer: LayerState,
  patch: Partial<LayerState>,
): boolean {
  if ("color" in patch && patch.color !== layer.color) return true;
  if ("visible" in patch && patch.visible !== layer.visible) return true;
  if ("opacity" in patch && patch.opacity !== layer.opacity) return true;
  return false;
}

function layerStateArraysEqual(a: LayerState[], b: LayerState[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((layer, index) => {
    const next = b[index];
    return (
      layer.id === next.id &&
      layer.name === next.name &&
      layer.color === next.color &&
      layer.originalColor === next.originalColor &&
      layer.visible === next.visible &&
      layer.opacity === next.opacity &&
      layer.originalOpacity === next.originalOpacity &&
      layer.pixelPercent === next.pixelPercent &&
      layer.pathTags === next.pathTags
    );
  });
}

function normalizeClientOpacity(value?: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, Number(value)));
}

function formatClientOpacity(value: number) {
  return normalizeClientOpacity(value)
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function sanitizeClientColor(input: string, fallback: string) {
  return normalizeClientColorInput(input) || fallback || "#000000";
}

function normalizeClientColorInput(input: string) {
  const value = String(input || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  return null;
}

function escapeClientAttr(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

/* ========================
   UI components
======================== */
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

function LayerControls({
  layers,
  onLayerChange,
  onReset,
}: {
  layers: LayerState[];
  onChange: (layers: LayerState[]) => void;
  onLayerChange: (layerId: string, patch: Partial<LayerState>) => void;
  onReset: () => void;
}) {
  return (
    <div className="my-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-sky-950 m-0">Edit SVG layers</h2>

        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Reset layers
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {layers.map((layer, index) => (
          <LayerControlRow
            key={layer.id}
            layer={layer}
            index={index}
            onLayerChange={onLayerChange}
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        These edits update this specific result. Hide unwanted PNG fragments or
        recolor each SVG color group before downloading.
      </p>
    </div>
  );
}

function LayerControlRow({
  layer,
  index,
  onLayerChange,
}: {
  layer: LayerState;
  index: number;
  onLayerChange: (layerId: string, patch: Partial<LayerState>) => void;
}) {
  const [draftColor, setDraftColor] = React.useState(layer.color);
  const [draftHex, setDraftHex] = React.useState(layer.color);
  const latestColorRef = React.useRef(layer.color);
  const commitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setDraftColor((current) => (current === layer.color ? current : layer.color));
    setDraftHex((current) => (current === layer.color ? current : layer.color));
    latestColorRef.current = layer.color;
  }, [layer.color]);

  React.useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  function commitColor(color: string) {
    const normalized = normalizeClientColorInput(color);
    if (!normalized) {
      setDraftHex(latestColorRef.current);
      return;
    }
    latestColorRef.current = normalized;

    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    setDraftColor(normalized);
    setDraftHex((current) => (current === normalized ? current : normalized));

    if (normalized !== layer.color) {
      onLayerChange(layer.id, { color: normalized });
    }
  }

  function scheduleColorCommit(color: string) {
    setDraftHex((current) => (current === color ? current : color));
    const normalized = normalizeClientColorInput(color);
    if (!normalized) return;
    setDraftColor((current) => (current === normalized ? current : normalized));
    latestColorRef.current = normalized;

    if (commitTimerRef.current) return;

    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;

      if (latestColorRef.current !== layer.color) {
        onLayerChange(layer.id, { color: latestColorRef.current });
      }
    }, 120);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(e) =>
            onLayerChange(layer.id, { visible: e.target.checked })
          }
          className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
          title="Show or hide layer"
        />

        <input
          type="color"
          value={draftColor}
          onChange={(e) => {
            const nextColor = e.target.value;
            setDraftColor(nextColor);
            scheduleColorCommit(nextColor);
          }}
          onBlur={() => commitColor(latestColorRef.current)}
          onMouseUp={() => commitColor(latestColorRef.current)}
          onTouchEnd={() => commitColor(latestColorRef.current)}
          onKeyUp={() => commitColor(latestColorRef.current)}
          className="w-10 h-8 rounded-md border border-slate-200 bg-white cursor-pointer"
          title="Change layer color"
        />
        <input
          type="text"
          value={draftHex}
          onChange={(event) => scheduleColorCommit(event.target.value)}
          onBlur={() => commitColor(draftHex)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitColor(draftHex);
            }
          }}
          aria-label={`Layer ${index + 1} hex color`}
          className="w-[104px] rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">
            Layer {index + 1}
          </div>
          <div className="text-xs text-slate-500">
            {draftColor.toUpperCase()} • {layer.pixelPercent}% of traced pixels
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (commitTimerRef.current) {
              clearTimeout(commitTimerRef.current);
              commitTimerRef.current = null;
            }

            latestColorRef.current = layer.originalColor;
            setDraftColor(layer.originalColor);
            onLayerChange(layer.id, {
              color: layer.originalColor,
              visible: true,
              opacity: layer.originalOpacity ?? 1,
            });
          }}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Reset
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <span className="shrink-0">
          Opacity {Math.round(normalizeClientOpacity(layer.opacity) * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(normalizeClientOpacity(layer.opacity) * 100)}
          onChange={(event) =>
            onLayerChange(layer.id, {
              opacity: normalizeClientOpacity(Number(event.target.value) / 100),
            })
          }
          className="min-w-0 flex-1 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />
      </label>
    </div>
  );
}

/* ========================
   SEO sections
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "Can I convert a PNG to a layered SVG for Cricut?",
      a: "Yes. Upload a PNG, choose a preset, adjust the layer count and cleanup settings, then download a Cricut-ready layered SVG.",
    },
    {
      q: "Does this work with transparent PNG files?",
      a: "Yes. Transparent PNGs are one of the best inputs for this tool because the converter can ignore transparent pixels and focus on visible artwork.",
    },
    {
      q: "What PNG preset should I start with?",
      a: "Start with PNG - Balanced Layers. For transparent artwork, use Transparent PNG - Clean Layers. For vinyl, use PNG to Vinyl - Fewer Pieces.",
    },
    {
      q: "Why does my PNG create too many tiny Cricut pieces?",
      a: "Tiny pieces usually come from anti-aliasing, shadows, gradients, texture, or small color fragments. Use fewer layers, raise speckle removal, and increase minimum layer size.",
    },
    {
      q: "Should I remove white background from my PNG?",
      a: "Use white background removal when the white area is just canvas or empty background. Do not use it if white is part of the actual design.",
    },
    {
      q: "Can I recolor each PNG SVG layer?",
      a: "Yes. Each result has layer controls that let you recolor or hide individual SVG layers before downloading.",
    },
    {
      q: "Is this better for PNG than JPG?",
      a: "Usually yes. PNG artwork often has cleaner edges, transparency, and less compression noise than JPG, which can produce cleaner Cricut layers.",
    },
    {
      q: "Does this page only accept PNG files?",
      a: "No. The page is optimized around PNG-style use cases, especially transparent artwork, but it also accepts JPG, JPEG, and WebP images.",
    },
  ];

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                PNG to layered Cricut SVG
              </p>

              <h2 className="text-2xl md:text-3xl font-bold leading-tight text-sky-950">
                Convert PNG images into layered SVG files for Cricut Design
                Space
              </h2>

              <p className="text-slate-600">
                This PNG to layered SVG converter is built for Cricut users who
                start with transparent PNGs, logos, stickers, clipart, decals,
                and flattened PNG artwork. It separates the image into
                color-based SVG groups so you can recolor, hide, cut, or edit
                each layer.
              </p>

              <p className="text-slate-600">
                PNG files usually convert cleaner than JPG files because they
                often preserve transparency and sharper edges. This page
                includes PNG-focused presets for transparent artwork, logos,
                vinyl, HTV, cardstock, stickers, shadow layers, and high-detail
                craft designs.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    k: "PNG-focused presets",
                    v: "Transparent, logo, sticker, vinyl, and HTV modes",
                  },
                  {
                    k: "Color layers",
                    v: "Split PNG artwork into SVG groups",
                  },
                  {
                    k: "Transparent cleanup",
                    v: "Ignore transparent pixels for cleaner layers",
                  },
                  {
                    k: "Layer editing",
                    v: "Recolor or hide layers before export",
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

          <section className="mt-8">
            <h3 className="text-lg font-bold text-sky-950">
              Best uses for this PNG to layered SVG converter
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Transparent PNGs",
                "Cricut stickers",
                "Vinyl decals",
                "HTV designs",
                "PNG logos",
                "Clipart",
                "Cardstock cutouts",
                "Shadow layers",
                "Small business labels",
                "Print then cut prep",
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
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  For transparent PNG artwork
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use transparent PNG presets when the artwork already has no
                  background. The converter can ignore transparent pixels and
                  focus on visible color regions.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  For vinyl, HTV, and cardstock
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use fewer layers, stronger cleanup, and larger minimum layer
                  size when you need files that are easier to cut, weed, and
                  assemble.
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
                How to convert PNG to layered SVG for Cricut
              </h3>
              <span className="text-xs text-slate-500">
                Upload PNG → choose preset → edit layers → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a PNG image",
                  body: "Use a clean PNG with clear color separation. Transparent PNGs, logos, clipart, and sticker-style images work best.",
                },
                {
                  title: "Choose a PNG-specific preset",
                  body: "Use transparent PNG presets for cutout artwork, vinyl presets for fewer pieces, and logo presets for cleaner color edges.",
                },
                {
                  title: "Adjust layer count",
                  body: "Use fewer layers for cutting and weeding. Use more layers for stickers, clipart, and colorful illustrations.",
                },
                {
                  title: "Clean up small fragments",
                  body: "Raise speckle removal and minimum layer size if the PNG creates tiny unwanted pieces.",
                },
                {
                  title: "Recolor or hide layers",
                  body: "Use the layer controls inside each result card to edit the final SVG before downloading.",
                },
                {
                  title: "Download the layered SVG",
                  body: "Upload the SVG into Cricut Design Space and work with each color group separately.",
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
                    <div className="shrink-0 h-8 w-8 rounded-full bg-slate-900 text-white text-sm font-bold grid place-items-center">
                      {i + 1}
                    </div>
                    <div>
                      <div itemProp="name" className="font-semibold">
                        {s.title}
                      </div>
                      <div
                        itemProp="itemListElement"
                        className="mt-1 text-sm text-slate-600"
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
              Which PNG layered SVG preset should you use?
            </h3>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "PNG - Balanced Layers",
                  body: "Best first try for most PNG files. It balances color separation with manageable Cricut layer complexity.",
                },
                {
                  title: "Transparent PNG - Clean Layers",
                  body: "Best for cutout PNG files with alpha transparency and no visible background.",
                },
                {
                  title: "PNG Logo - Clean Multi-Color",
                  body: "Best for logos, icons, and flat graphics where sharp color edges matter.",
                },
                {
                  title: "PNG to Vinyl - Fewer Pieces",
                  body: "Best for vinyl projects where cleaner cuts and easier weeding matter more than preserving every color.",
                },
                {
                  title: "PNG to HTV - Simple Layers",
                  body: "Best for heat-transfer vinyl designs that need fewer stacked pieces.",
                },
                {
                  title: "Paper Craft - Stacked Colors",
                  body: "Best for cardstock, party decorations, classroom cutouts, and layered paper projects.",
                },
                {
                  title: "PNG Sticker - Bold Colors",
                  body: "Best for sticker-style artwork where stronger color blocks are useful.",
                },
                {
                  title: "PNG High Detail - Preserve Colors",
                  body: "Best when visual detail matters more than simple cutting. Expect larger SVGs and more layers.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              PNG to layered SVG settings explained
            </h3>

            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              PNG conversion usually works well for Cricut because PNG files can
              preserve transparency and sharper artwork edges. These settings
              control how much detail becomes separate SVG layers.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Layer count",
                  body: "Controls how many color groups are extracted from the PNG. More layers keep more color detail but create more Cricut pieces.",
                },
                {
                  title: "Remove transparent pixels",
                  body: "Ignores transparent PNG areas so the converter only traces visible artwork.",
                },
                {
                  title: "Posterize PNG colors",
                  body: "Simplifies similar colors before tracing. Keep this enabled for most sticker, clipart, and craft PNG files.",
                },
                {
                  title: "Minimum layer size",
                  body: "Filters out tiny PNG fragments. Raise it when anti-aliasing or texture creates too many small pieces.",
                },
                {
                  title: "Remove white background",
                  body: "Removes near-white PNG areas. Use it for white canvas backgrounds, not for white design details.",
                },
                {
                  title: "Speckle removal",
                  body: "Removes tiny traced islands inside each layer. Higher values make PNG results cleaner for cutting.",
                },
                {
                  title: "Curve tolerance",
                  body: "Higher values smooth rough edges and reduce nodes. Lower values preserve more detail.",
                },
                {
                  title: "Layer color controls",
                  body: "Each result card includes layer controls so you can recolor or hide specific SVG groups before export.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-bold text-sky-950">
              How this PNG layered SVG converter works
            </h3>

            <div className="mt-3 grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  1. The PNG is simplified into color groups
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  The converter samples the PNG, reduces similar colors, and
                  filters transparent or white areas when requested.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  2. Each color group becomes a trace mask
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Every detected PNG color group is isolated so it can be traced
                  into a separate vector shape group.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  3. The result exports as layered SVG
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Each layer becomes its own SVG group, making the downloaded
                  file easier to recolor, hide, cut, and edit in Cricut Design
                  Space.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Tips for cleaner PNG layered SVGs
            </h3>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Use transparent PNGs when possible",
                  body: "Transparent PNG files usually layer better because there is no background to remove.",
                },
                {
                  title: "Use fewer layers for vinyl",
                  body: "For vinyl or HTV, start with 2 to 4 layers. Too many color groups can create hard-to-weed pieces.",
                },
                {
                  title: "Use more layers for stickers",
                  body: "For stickers or colorful clipart, 5 to 8 layers can preserve more of the PNG's visual style.",
                },
                {
                  title: "Remove white only when it is background",
                  body: "White background removal is useful for blank canvas backgrounds, but it can remove white design details too.",
                },
                {
                  title: "Raise cleanup for textured PNGs",
                  body: "Textures and shadows can create small fragments. Increase speckle removal and minimum layer size to simplify the SVG.",
                },
                {
                  title: "Compare multiple attempts",
                  body: "Each conversion result stays in the preview area, so you can compare presets and download the best layered SVG.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>
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
              PNG to layered SVG for Cricut FAQ
            </h3>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {faqs.map((x) => (
                <article
                  key={x.q}
                  itemScope
                  itemType="https://schema.org/Question"
                  itemProp="mainEntity"
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h4 itemProp="name" className="m-0 font-semibold">
                    {x.q}
                  </h4>
                  <p
                    itemScope
                    itemType="https://schema.org/Answer"
                    itemProp="acceptedAnswer"
                    className="mt-2 text-sm text-slate-600"
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
