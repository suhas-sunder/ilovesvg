import * as React from "react";
import type { Route } from "./+types/sketch-to-svg-for-cricut";
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
import { type ActionFunctionArgs } from "react-router";
import { CurrentRouteGuide, OtherToolsLinks } from "~/client/components/navigation/OtherToolsLinks";
import { RelatedSites } from "~/client/components/navigation/RelatedSites";
import SocialLinks from "~/client/components/navigation/SocialLinks";
import { AdSenseDelayed } from "~/client/components/ads/AdsenseDelayed";
import SiteFooter from "~/client/components/navigation/SiteFooter";
import DragArea from "~/client/components/ui/DragArea";
import Icons from "~/client/assets/icons/Icons";
import { ContextualAffiliateCard } from "~/client/components/ads/ContextualAffiliateCard";
import ExampleSvgConversion from "~/client/components/layout/ExampleSvgConversion";
import {
  ChevronDownIcon,
  PresetPicker,
} from "~/client/components/converter/PresetSelector";
import {
  FullscreenOutputPreview,
} from "~/client/components/converter/FullscreenOutputPreview";
import {
  getEditedSvg as getSharedEditedSvg,
} from "~/client/components/svg/EditedSvgPreviewImage";
import {
  BespokeTraceOutputPanel,
  getBespokeTraceOutputSvg,
} from "~/client/components/converter/BespokeTraceOutputPanel";
import {
  createOutputSourceSnapshot,
  cleanupUnusedSourceSnapshots,
  type OutputSourceSnapshot,
} from "~/client/lib/converter/sourceSnapshots";
import {
  mergeOutputSourceSnapshot,
  trimOutputHistory,
} from "~/client/lib/converter/outputHistory";
import { extendLayeredPresets } from "~/client/lib/converter/presetAdditions";
import { LayeredAdvancedSettingsPanel } from "~/client/components/converter/AdvancedSettingsPanel";
import { getRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import { useHybridTraceFetcher } from "~/client/lib/tracing/useHybridTraceFetcher";
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
  const title = "Sketch to SVG for Cricut - Free Layered Sketch SVG Converter";
  const description =
    "Convert hand sketches, pencil sketches, scanned sketches, signatures, handwriting, and simple sketch-style artwork into layered SVG files for Cricut Design Space. Remove white backgrounds, adjust layers, recolor SVG groups, preview results, and download a Cricut-ready SVG.";
  const canonical = "https://www.ilovesvg.com/sketch-to-svg-for-cricut";

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
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const LIVE_FAST_MAX = 10 * 1024 * 1024;
const LIVE_MED_MAX = 25 * 1024 * 1024;
const LIVE_FAST_MS = 450;
const LIVE_MED_MS = 1600;

const MIN_LAYER_COUNT = 2;
const MAX_LAYER_COUNT = 10;
const MAX_TRACE_SIDE_DEFAULT = 1600;

const PAGE_RATE_LIMITS = {
  perMinute: 120,
  perFiveMinutes: 400,
  perHour: 1500,
  perDay: 3000,
};

type RateLimitWindowName = "minute" | "fiveMinutes" | "hour" | "day";
type RateLimitWindowState = { count: number; resetAt: number };
type RateLimitRecord = Record<RateLimitWindowName, RateLimitWindowState>;
type BackendRateLimitResult =
  | {
      allowed: true;
      headers: Headers;
    }
  | {
      allowed: false;
      headers: Headers;
      retryAfterMs: number;
      retryAfterText: string;
    };

const RATE_LIMIT_WINDOWS: Array<{
  name: RateLimitWindowName;
  ms: number;
  limit: number;
  limitHeader: string;
  remainingHeader: string;
}> = [
  {
    name: "minute",
    ms: 60 * 1000,
    limit: PAGE_RATE_LIMITS.perMinute,
    limitHeader: "X-RateLimit-Limit-Minute",
    remainingHeader: "X-RateLimit-Remaining-Minute",
  },
  {
    name: "fiveMinutes",
    ms: 5 * 60 * 1000,
    limit: PAGE_RATE_LIMITS.perFiveMinutes,
    limitHeader: "X-RateLimit-Limit-Five-Minutes",
    remainingHeader: "X-RateLimit-Remaining-Five-Minutes",
  },
  {
    name: "hour",
    ms: 60 * 60 * 1000,
    limit: PAGE_RATE_LIMITS.perHour,
    limitHeader: "X-RateLimit-Limit-Hour",
    remainingHeader: "X-RateLimit-Remaining-Hour",
  },
  {
    name: "day",
    ms: 24 * 60 * 60 * 1000,
    limit: PAGE_RATE_LIMITS.perDay,
    limitHeader: "X-RateLimit-Limit-Day",
    remainingHeader: "X-RateLimit-Remaining-Day",
  },
];

function getRateLimitStore(): Map<string, RateLimitRecord> {
  const g = globalThis as any;
  if (!g.__ilovesvg_action_rate_limits) {
    g.__ilovesvg_action_rate_limits = new Map<string, RateLimitRecord>();
  }
  return g.__ilovesvg_action_rate_limits as Map<string, RateLimitRecord>;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .slice(0, 160);
}

function getBackendRateLimitKey(
  request: Request,
  routeName: string,
  actionName: string,
): string {
  const ip = normalizeKeyPart(getClientIp(request));
  const ua = normalizeKeyPart(request.headers.get("user-agent") || "unknown");

  return `${ip}:${ua}:${normalizeKeyPart(routeName)}:${normalizeKeyPart(
    actionName,
  )}`;
}

function createFreshRateLimitRecord(now: number): RateLimitRecord {
  return {
    minute: { count: 0, resetAt: now + 60 * 1000 },
    fiveMinutes: { count: 0, resetAt: now + 5 * 60 * 1000 },
    hour: { count: 0, resetAt: now + 60 * 60 * 1000 },
    day: { count: 0, resetAt: now + 24 * 60 * 60 * 1000 },
  };
}

function formatRetryAfter(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function checkBackendConversionRateLimit(
  request: Request,
  routeName: string,
  actionName: string,
): BackendRateLimitResult {
  const now = Date.now();
  const store = getRateLimitStore();
  const key = getBackendRateLimitKey(request, routeName, actionName);
  const record = store.get(key) ?? createFreshRateLimitRecord(now);

  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = now + windowConfig.ms;
    }
  }

  const exceeded = RATE_LIMIT_WINDOWS.filter(
    (windowConfig) => record[windowConfig.name].count >= windowConfig.limit,
  );

  const headers = new Headers();
  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    headers.set(windowConfig.limitHeader, String(windowConfig.limit));
    headers.set(
      windowConfig.remainingHeader,
      String(Math.max(0, windowConfig.limit - state.count)),
    );
  }

  if (exceeded.length > 0) {
    const retryAfterMs = Math.max(
      1000,
      Math.min(
        ...exceeded.map(
          (windowConfig) => record[windowConfig.name].resetAt - now,
        ),
      ),
    );

    headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    store.set(key, record);

    return {
      allowed: false,
      headers,
      retryAfterMs,
      retryAfterText: formatRetryAfter(retryAfterMs),
    };
  }

  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    record[windowConfig.name].count += 1;
  }

  for (const windowConfig of RATE_LIMIT_WINDOWS) {
    const state = record[windowConfig.name];
    headers.set(
      windowConfig.remainingHeader,
      String(Math.max(0, windowConfig.limit - state.count)),
    );
  }

  store.set(key, record);
  return { allowed: true, headers };
}

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

    const rateLimit = checkBackendConversionRateLimit(
      request,
      "sketch-to-svg-for-cricut",
      "raster-trace",
    );

    if (!rateLimit.allowed) {
      return json(
        {
          error: `Too many conversions from this connection. Please try again in ${rateLimit.retryAfterText}.`,
          retryAfterMs: rateLimit.retryAfterMs,
          code: "RATE_LIMITED",
        },
        { status: 429, headers: rateLimit.headers },
      );
    }

    const uploadHandler = createMemoryUploadHandler({
      maxPartSize: MAX_UPLOAD_BYTES,
    });
    const form = await parseMultipartFormData(request, uploadHandler);

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ error: "No image uploaded." }, { status: 400 });
    }

    const webFile = file as File;

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
      const retryAfterMs = Math.max(1500, Number(e?.retryAfterMs) || 2500);

      return json(
        {
          error:
            "Server is busy converting other sketch SVGs. Retrying automatically.",
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
      // @ts-ignore Buffer exists in Remix node runtime
      const input: Buffer = Buffer.from(ab);

      const { validateFileSignature } = await import("~/utils/backendSecurity.server");
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
        String(form.get("removeWhite") ?? "true").toLowerCase() === "true";

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

      const routeLayeredTrace = runSharedLayeredColorTraceShared;
      const result = await routeLayeredTrace(input, {
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
          fillStrokeWidth: advancedTraceSettings.fillStrokeWidth,
          fillStrokeColor: advancedTraceSettings.fillStrokeColor,
      })

      return json({
        ...result,
        engineUsed: result.engineUsed || "potrace",
        sourceKind: result.sourceKind || "raster",
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
      {
        error: safeErrorMessage(
          err?.message || "Server error during sketch to SVG conversion.",
          "Server error during sketch to SVG conversion.",
        ),
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
  name?: string;
  label?: string;
  color: string;
  originalColor?: string;
  visible?: boolean;
  opacity?: number;
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
  const routePotraceTrace = runSharedPotraceSvgTraceShared;
  const opts: any = {
    color: "#000000",
    threshold: 128,
    turdSize: options.turdSize,
    optTolerance: options.optTolerance,
    turnPolicy: options.turnPolicy,
    invert: false,
    blackOnWhite: true,
  };

  const svgRaw: string = await routePotraceTrace(maskPng, opts);

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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from sketch for Cricut">${background}${body}</svg>`;
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
};

const DEFAULTS: Settings = {
  ...DEFAULT_TRACE_ADVANCED_SETTINGS,
  layerCount: 4,
  maxTraceSide: 1600,
  minRegionPercent: 0.25,
  optTolerance: 0.35,
  turdSize: 3,
  turnPolicy: "minority",
  posterize: true,
  removeWhite: true,
  removeTransparent: true,
  transparent: true,
  bgColor: "#ffffff",
};

const routeCapabilities = getRouteCapabilities("sketch-to-svg-for-cricut");

const PRESETS: Preset[] = [
  {
    id: "layered-color",
    label: "Layered color SVG",
    settings: {
      layerCount: 5,
      maxTraceSide: 1600,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 4,
      turnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
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
      turnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
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
      turnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
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
      turnPolicy: "majority",
      posterize: true,
      removeWhite: false,
      removeTransparent: true,
      transparent: true,
    },
  },
  {
    id: "sketch-balanced",
    label: "Sketch - Balanced Layers",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.25,
      optTolerance: 0.35,
      turdSize: 3,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "pencil-clean",
    label: "Pencil Sketch - Clean Layers",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.45,
      optTolerance: 0.45,
      turdSize: 6,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1400,
    },
  },
  {
    id: "ink-drawing",
    label: "Ink Sketch - Sharp Lines",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.2,
      optTolerance: 0.28,
      turdSize: 2,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1900,
    },
  },
  {
    id: "scan-cleanup",
    label: "Scanned Sketch - Remove Speckles",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.75,
      optTolerance: 0.55,
      turdSize: 9,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1300,
    },
  },
  {
    id: "notebook-cleanup",
    label: "Notebook Sketch - Paper Cleanup",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.9,
      optTolerance: 0.65,
      turdSize: 10,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1200,
    },
  },
  {
    id: "hand-lettering",
    label: "Hand Lettering - Smooth",
    settings: {
      layerCount: 2,
      minRegionPercent: 0.3,
      optTolerance: 0.24,
      turdSize: 3,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1900,
    },
  },
  {
    id: "signature",
    label: "Signature - Clean Cut",
    settings: {
      layerCount: 2,
      minRegionPercent: 0.25,
      optTolerance: 0.2,
      turdSize: 2,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1900,
    },
  },
  {
    id: "coloring-page",
    label: "Coloring Page - Bold Lines",
    settings: {
      layerCount: 2,
      minRegionPercent: 0.85,
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
    id: "vinyl-sketch",
    label: "Sketch to Vinyl - Fewer Pieces",
    settings: {
      layerCount: 2,
      minRegionPercent: 1.1,
      optTolerance: 0.78,
      turdSize: 10,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1200,
    },
  },
  {
    id: "htv-sketch",
    label: "Sketch to HTV - Simple Layers",
    settings: {
      layerCount: 3,
      minRegionPercent: 0.9,
      optTolerance: 0.7,
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
    id: "sticker-outline",
    label: "Sticker Art - Clean Outlines",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.4,
      optTolerance: 0.5,
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
    id: "marker-art",
    label: "Marker Sketch - Bold Color Layers",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "kids-drawing",
    label: "Kids Sketch - Simple Layers",
    settings: {
      layerCount: 4,
      minRegionPercent: 0.55,
      optTolerance: 0.65,
      turdSize: 7,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1300,
    },
  },
  {
    id: "sketch-logo",
    label: "Sketch Logo - Clean Shapes",
    settings: {
      layerCount: 5,
      minRegionPercent: 0.2,
      optTolerance: 0.3,
      turdSize: 3,
      posterize: false,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1900,
    },
  },
  {
    id: "shadow-layer",
    label: "Shadow Layer - Bold Shape",
    settings: {
      layerCount: 2,
      minRegionPercent: 1.2,
      optTolerance: 0.85,
      turdSize: 10,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "black",
      maxTraceSide: 1200,
    },
  },
  {
    id: "fine-detail",
    label: "Fine Detail - Preserve Lines",
    settings: {
      layerCount: 6,
      minRegionPercent: 0.12,
      optTolerance: 0.2,
      turdSize: 2,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 2200,
    },
  },
  {
    id: "print-then-cut-sketch",
    label: "Print Then Cut - Sketch Art",
    settings: {
      layerCount: 6,
      minRegionPercent: 0.35,
      optTolerance: 0.45,
      turdSize: 4,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "majority",
      maxTraceSide: 1600,
    },
  },
  {
    id: "colored-sketch",
    label: "Colored Sketch - More Layers",
    settings: {
      layerCount: 8,
      minRegionPercent: 0.2,
      optTolerance: 0.4,
      turdSize: 3,
      posterize: true,
      removeWhite: true,
      removeTransparent: true,
      transparent: true,
      turnPolicy: "minority",
      maxTraceSide: 1800,
    },
  },
];

const DISPLAY_PRESETS = extendLayeredPresets<Preset>(PRESETS);

const DEFAULT_PRESET_ID = "sketch-balanced";

type ServerResult = {
  svg?: string;
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
  layers?: ServerLayer[];
  palette?: string[];
};

type LayerState = {
  id: string;
  name: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  opacity: number;
  originalOpacity: number;
  pixelPercent: number;
  pathTags: string;
};

type HistoryItem = {
  svg: string;
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
  layers: LayerState[];
  settingsSnapshot: Settings;
  name?: string;
  presetLabel?: string;
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: number;
  sourcePreviewUrl?: string;
};

const OUTPUT_HISTORY_LIMIT = 10;

function getPresetLabelById(presetId: string): string {
  return (
    DISPLAY_PRESETS.find((preset) => preset.id === presetId)?.label ||
    "Custom settings"
  );
}

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
    return "Large file; updates run less frequently to keep things smooth.";
  return "";
}

/* ========================
   Page
======================== */
export default function SketchToSvgForCricut({
  loaderData,
}: Route.ComponentProps) {
  const fetcher = useHybridTraceFetcher<ServerResult>({ routeId: "sketch-to-svg-for-cricut" });

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
  const [autoMode, setAutoMode] = React.useState<AutoMode>("off");
  const [toast, setToast] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressLiveRef = React.useRef(false);
  const skipNextAutoSubmitRef = React.useRef(false);
  const retryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReplaceStampRef = React.useRef<number | null>(null);
  const lastSubmittedSourceSnapshotRef = React.useRef<OutputSourceSnapshot>({});
  const lastSubmittedSettingsRef = React.useRef<Settings>(DEFAULTS);
  const historyRef = React.useRef<HistoryItem[]>([]);

  const busy = fetcher.state !== "idle";

  React.useEffect(() => setHydrated(true), []);

  React.useEffect(() => {
    historyRef.current = history;
  }, [history]);

  React.useEffect(() => {
    return () => cleanupUnusedSourceSnapshots(historyRef.current, []);
  }, []);

  React.useEffect(() => {
    if (suppressLiveRef.current) return;
    if (!file) return;
    if (skipNextAutoSubmitRef.current) {
      skipNextAutoSubmitRef.current = false;
      return;
    }

    const mode = autoMode;
    if (mode === "off") return;

    const delay = mode === "fast" ? LIVE_FAST_MS : LIVE_MED_MS;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      submitConvert(file, settings);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only upload/auto-mode changes should trigger this effect. Presets submit
    // their computed settings directly in applyPreset, and advanced controls stay
    // manual-only until Convert or Update preview is clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, autoMode]);

  React.useEffect(() => {
    if (!fetcher.data?.svg || !fetcher.data.layers?.length) return;

    const item: HistoryItem = {
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
      layers: fetcher.data.layers.map((layer, index) => {
        const label = layer.label || layer.name || `Layer ${index + 1}`;
        return {
          id: layer.id,
          name: label,
          label,
          color: layer.color,
          originalColor: layer.originalColor || layer.color,
          visible: layer.visible ?? true,
          opacity: layer.opacity ?? 1,
          originalOpacity: layer.opacity ?? 1,
          pixelPercent: layer.pixelPercent,
          pathTags: layer.pathTags || "",
        };
      }),
      settingsSnapshot: lastSubmittedSettingsRef.current,
      name: `Output - ${getPresetLabelById(activePreset)}`,
      presetLabel: getPresetLabelById(activePreset),
      sourceFileName: lastSubmittedSourceSnapshotRef.current.sourceFileName,
      sourceMimeType: lastSubmittedSourceSnapshotRef.current.sourceMimeType,
      sourceFileSize: lastSubmittedSourceSnapshotRef.current.sourceFileSize,
      sourcePreviewUrl: lastSubmittedSourceSnapshotRef.current.sourcePreviewUrl,
    };

    const replaceStamp = pendingReplaceStampRef.current;
    pendingReplaceStampRef.current = null;

    setHistory((prev) => {
      if (replaceStamp) {
        let replaced = false;
        const next = prev.map((historyItem) => {
          if (historyItem.stamp !== replaceStamp) return historyItem;
          replaced = true;
          return mergeOutputSourceSnapshot(
            {
              ...historyItem,
              ...item,
              stamp: historyItem.stamp,
              name: historyItem.name,
            },
            historyItem,
          );
        });
        const limited = replaced
          ? next
          : trimOutputHistory([item, ...prev], prev, OUTPUT_HISTORY_LIMIT);
        cleanupUnusedSourceSnapshots([...prev, item], limited);
        return limited;
      }

      return trimOutputHistory([item, ...prev], prev, OUTPUT_HISTORY_LIMIT);
    });
    setInfo(null);
  }, [fetcher.data?.svg, fetcher.data?.width, fetcher.data?.height, activePreset]);

  React.useEffect(() => {
    if (!fetcher.data?.error) return;

    if (fetcher.data.code === "BUSY" && file) {
      const retryAfterMs = Math.max(1500, fetcher.data.retryAfterMs ?? 2500);
      setInfo("Server is busy. Retrying automatically.");

      if (retryRef.current) clearTimeout(retryRef.current);

      retryRef.current = setTimeout(() => {
        submitConvert(file, settings);
      }, retryAfterMs);

      return;
    }

    setErr(fetcher.data.error);
    cleanupUnusedSourceSnapshots(
      [lastSubmittedSourceSnapshotRef.current],
      historyRef.current,
    );
  }, [fetcher.data?.error, fetcher.data?.code, fetcher.data?.retryAfterMs]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
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
      setErr("Please choose a PNG, JPG, JPEG, or WebP image.");
      return;
    }

    suppressLiveRef.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);

    setFile(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(null);
    setSettings(DEFAULTS);
    setActivePreset(DEFAULT_PRESET_ID);
    setErr(null);
    setInfo(null);
    setDims(null);
    setOriginalFileSize(f.size);

    let chosen = f;

    try {
      if (f.size > LIVE_MED_MAX) {
        setInfo("Compressing large image locally for live layered preview.");
        chosen = await compressToTarget25MB(f);
      }

      await validateBeforeSubmit(chosen);
    } catch (e: any) {
      suppressLiveRef.current = false;
      setInfo(null);
      setErr(e?.message || "Image is too large.");
      return;
    }

    setFile(chosen);
    setAutoMode(getAutoMode(chosen.size));

    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);

    await measureAndSet(chosen);

    skipNextAutoSubmitRef.current = true;
    suppressLiveRef.current = false;

    void submitConvert(chosen, DEFAULTS);
  }

  async function submitConvert(
    fileOverride?: File | null,
    settingsOverride?: Settings,
    replaceStamp?: number | null,
  ) {
    const sourceFile = fileOverride ?? file;
    const sourceSettings = settingsOverride ?? settings;

    if (!sourceFile) {
      setErr("Choose an image first.");
      return;
    }

    try {
      await validateBeforeSubmit(sourceFile);
    } catch (e: any) {
      setErr(e?.message || "Image is too large.");
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

    setErr(null);
    lastSubmittedSettingsRef.current = sourceSettings;
    lastSubmittedSourceSnapshotRef.current =
      createOutputSourceSnapshot(sourceFile);
    pendingReplaceStampRef.current = replaceStamp ?? null;

    fd.append("presetId", activePreset);





    fetcher.submit(fd, {
      method: "POST",
      encType: "multipart/form-data",
      action:
        typeof window === "undefined"
          ? "?index"
          : `${window.location.pathname}?index`,
    });
  }

  function buildPresetSettings(
    currentSettings: Settings,
    preset: Preset,
  ): Settings {
    void currentSettings;

    return {
      ...DEFAULTS,
      ...preset.settings,
    };
  }

  function applyPreset(preset: Preset) {
    const nextSettings = buildPresetSettings(settings, preset);

    setActivePreset(preset.id);
    setSettings(nextSettings);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);

    if (file && getAutoMode(file.size) !== "off") {
      void submitConvert(file, nextSettings);
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
    setHistory((prev) =>
      prev.map((item) =>
        item.stamp === stamp
          ? {
              ...item,
              layers: updater(item.layers),
            }
          : item,
      ),
    );
  }

  function getHistoryItemSvg(item: HistoryItem): string {
    return getSketchEditedSvg(item, item.settingsSnapshot || settings);
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
                Sketch to SVG for Cricut
              </h1>

              <p className="mb-3 text-center text-sm text-slate-600">
                Convert hand sketches, pencil sketches, scanned sketches,
                lettering, signatures, and sketch-style raster artwork into
                editable layered SVG files for Cricut Design Space.
              </p>

              <PresetPicker
                presets={DISPLAY_PRESETS}
                activePreset={activePreset}
                applyPreset={applyPreset}
                defaultPresetId={DEFAULT_PRESET_ID}
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
                    "flex items-center justify-center w-full px-3.5 py-2 rounded-lg font-bold border transition-colors cursor-pointer",
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
                  {busy ? "Building sketch layers…" : "Convert Sketch to SVG"}
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
                    Original Sketch Preview:
                  </p>
                  <img
                    src={previewUrl}
                    alt="Input sketch"
                    className="relative w-full h-auto block transparent-checkerboard"
                  />
                </div>
              )}
            </div>

            <BespokeTraceOutputPanel
              history={history}
              busy={busy}
              file={file}
              downloadLabel="Download Layered SVG"
              downloadFileName="sketch-to-svg-for-cricut.svg"
              emptyTitle="Layered SVG files appear here..."
              emptyBusyTitle="Building layered SVG..."
              resultKindLabel="Layered SVG result from sketch"
              precisionOutput={true}
              fullscreenPreviewIndex={fullscreenPreviewIndex}
              setFullscreenPreviewIndex={setFullscreenPreviewIndex}
              getSvg={getHistoryItemSvg}
              onCopySvg={handleCopySvg}
              onOpenEditor={(item) => setSettings(item.settingsSnapshot)}
              renderSettings={({
                item,
                sourceAvailableForOutput,
                appearanceControls,
              }) => (
                <div className="grid gap-3">
                  {appearanceControls}
                  <LayeredAdvancedSettingsPanel
                    id={`output-settings-panel-${item.stamp}`}
                    open={true}
                    settings={settings}
                    setSettings={setSettings}
                    capabilities={routeCapabilities}
                    detectedColorItems={[item]}
                    sourceFile={sourceAvailableForOutput ? file : null}
                    removeColorsEnabled={
                      sourceAvailableForOutput &&
                      !(
                        file &&
                        (file.type === "image/svg+xml" ||
                          /\.svg$/i.test(file.name || ""))
                      )
                    }
                    outputLayerItems={item.layers}
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
                                opacity: layer.originalOpacity,
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
                          opacity: layer.originalOpacity,
                        })),
                      )
                    }
                    buttonDisabled={buttonDisabled || busy || !sourceAvailableForOutput}
                    helpHref="#advanced-settings-help"
                    liveSectionDescription="These settings edit this output card directly. Copy and download use the current visible SVG."
                    livePreviewLead={
                      <div className="rounded-xl border border-slate-200 bg-white p-2">
                        <p className="m-0 mb-2 text-[13px] font-bold text-slate-900">
                          Layer colors
                        </p>
                        <LayerControls
                          layers={item.layers}
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
                                opacity: layer.originalOpacity,
                              })),
                            )
                          }
                        />
                      </div>
                    }
                    convertSectionDescription={
                      sourceAvailableForOutput
                        ? "These settings retrace the source image for this output only. Unapplied changes apply after Update preview."
                        : item.sourceFileName
                          ? `Update preview needs the original source file (${item.sourceFileName}). Copy and download still use the saved SVG.`
                          : "Choose the original source image to retrace this output."
                    }
                    hideOutputLayerStyling={true}
                    onUpdatePreview={() =>
                      void submitConvert(file, settings, item.stamp)
                    }
                  />
                </div>
              )}
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
            svg: getBespokeTraceOutputSvg(item, getHistoryItemSvg, true),
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
    throw new Error("File too large. Max 30 MB per image.");
  }

  const { w, h } = await getImageSize(file);

  if (!w || !h) throw new Error("Could not read image dimensions.");

  const mp = (w * h) / 1_000_000;

  if (w > MAX_SIDE || h > MAX_SIDE || mp > MAX_MP) {
    throw new Error(
      `Image too large: ${w}×${h} (~${mp.toFixed(
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

function getSketchEditedSvg(item: HistoryItem, settings: Settings) {
  if (
    /\bdata-layer-id\s*=/i.test(item.svg) ||
    /\bdata-fill-layer-id\s*=/i.test(item.svg) ||
    /\bdata-stroke-layer-id\s*=/i.test(item.svg)
  ) {
    return getSharedEditedSvg(item.svg, item.layers);
  }

  return buildClientLayeredSvg({
    width: item.width,
    height: item.height,
    layers: item.layers,
    transparent: settings.transparent,
    bgColor: settings.bgColor,
  });
}

function buildClientLayeredSvg({
  width,
  height,
  layers,
  transparent,
  bgColor,
}: {
  width: number;
  height: number;
  layers: LayerState[];
  transparent: boolean;
  bgColor: string;
}) {
  const bg = transparent
    ? ""
    : `<rect x="0" y="0" width="${width}" height="${height}" fill="${sanitizeClientColor(
        bgColor,
        "#ffffff",
      )}" />`;

  const body = layers
    .filter((layer) => layer.visible)
    .map((layer, index) => {
      const color = sanitizeClientColor(layer.color, layer.originalColor);
      const safeId = escapeClientAttr(layer.id || `layer-${index + 1}`);
      const safeName = escapeClientAttr(
        layer.label || layer.name || `Layer ${index + 1}`,
      );
      const opacity =
        Number.isFinite(layer.opacity) && layer.opacity < 1
          ? ` opacity="${Math.max(0, Math.min(1, layer.opacity))}"`
          : "";

      return `<g id="${safeId}" data-layer-id="${safeId}" data-layer-label="${safeName}" data-layer-color="${color}" data-layer-name="${safeName}" fill="${color}"${opacity}>${layer.pathTags}</g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Layered SVG from sketch for Cricut">${bg}${body}</svg>`;
}

function sanitizeClientColor(input: string, fallback: string) {
  const value = String(input || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  return fallback || "#000000";
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
        These edits update this specific result. Hide unwanted sketch fragments
        or recolor each SVG group before downloading.
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
  const latestColorRef = React.useRef(layer.color);
  const commitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setDraftColor(layer.color);
    latestColorRef.current = layer.color;
  }, [layer.color]);

  React.useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  function commitColor(color = latestColorRef.current) {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (color !== layer.color) {
      onLayerChange(layer.id, { color });
    }
  }

  function scheduleColorCommit(color: string) {
    latestColorRef.current = color;
    setDraftColor(color);

    if (commitTimerRef.current) return;

    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      commitColor(latestColorRef.current);
    }, 120);
  }

  function resetLayer() {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    latestColorRef.current = layer.originalColor;
    setDraftColor(layer.originalColor);
    onLayerChange(layer.id, {
      color: layer.originalColor,
      visible: true,
    });
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
          onChange={(e) => scheduleColorCommit(e.target.value)}
          onBlur={() => commitColor()}
          onMouseUp={() => commitColor()}
          onPointerUp={() => commitColor()}
          onTouchEnd={() => commitColor()}
          className="w-10 h-8 rounded-md border border-slate-200 bg-white cursor-pointer"
          title="Change layer color"
        />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">
            Layer {index + 1}
          </div>
          <div className="text-xs text-slate-500">
            {draftColor.toUpperCase()}  -  {layer.pixelPercent}% of traced pixels
          </div>
        </div>

        <button
          type="button"
          onClick={resetLayer}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
function LayeredSvgPreview({
  width,
  height,
  layers,
  transparent,
  bgColor,
}: {
  width: number;
  height: number;
  layers: LayerState[];
  transparent: boolean;
  bgColor: string;
}) {
  const safeWidth = Math.max(1, Math.round(width || 1));
  const safeHeight = Math.max(1, Math.round(height || 1));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      role="img"
      aria-label="Layered SVG result from sketch"
      className="max-w-full h-auto"
    >
      {!transparent && (
        <rect
          x="0"
          y="0"
          width={safeWidth}
          height={safeHeight}
          fill={sanitizeClientColor(bgColor, "#ffffff")}
        />
      )}

      {layers.map((layer) => (
        <LayeredSvgPreviewGroup key={layer.id} layer={layer} />
      ))}
    </svg>
  );
}

const LayeredSvgPreviewGroup = React.memo(function LayeredSvgPreviewGroup({
  layer,
}: {
  layer: LayerState;
}) {
  if (!layer.visible) return null;

  const color = sanitizeClientColor(layer.color, layer.originalColor);
  const safeId = escapeClientAttr(layer.id);
  const safeName = escapeClientAttr(layer.name);

  return (
    <g id={safeId} data-layer-name={safeName} fill={color}>
      <LayeredSvgPathTags pathTags={layer.pathTags} />
    </g>
  );
});

const LayeredSvgPathTags = React.memo(function LayeredSvgPathTags({
  pathTags,
}: {
  pathTags: string;
}) {
  return <g dangerouslySetInnerHTML={{ __html: pathTags }} />;
});

/* ========================
   SEO sections
======================== */
function SeoSections() {
  const faqs = [
    {
      q: "Can I convert a sketch to SVG for Cricut?",
      a: "Yes. Upload a sketch, scanned sketch, signature, handwriting image, or simple sketch-style artwork. The converter creates SVG groups that you can preview, recolor, hide, and download.",
    },
    {
      q: "Does this only accept sketch files?",
      a: "No. The page is optimized for sketch-style use cases, but you can upload PNG, JPG, JPEG, or WebP raster images.",
    },
    {
      q: "Why does my sketch create too many tiny Cricut pieces?",
      a: "Tiny pieces usually come from paper texture, pencil shading, scanner dust, shadows, compression artifacts, or noisy edges. Raise speckle removal, use fewer layers, or increase minimum layer size.",
    },
    {
      q: "What preset should I use for a pencil sketch?",
      a: "Start with Pencil Sketch - Clean Layers. If the sketch has paper texture, try Scanned Sketch - Remove Speckles or Notebook Sketch - Paper Cleanup.",
    },
    {
      q: "Can I recolor each sketch layer?",
      a: "Yes. Each conversion result includes layer controls that let you recolor or hide individual SVG layers before downloading.",
    },
    {
      q: "Is this good for vinyl?",
      a: "Use Sketch to Vinyl - Fewer Pieces or Shadow Layer - Bold Shape. These presets reduce small fragments and make the SVG more practical for cutting and weeding.",
    },
    {
      q: "Should I remove the white background?",
      a: "Yes for most paper sketches and scanned sketches. Keep it off only if white areas are part of the actual design.",
    },
    {
      q: "Does this sketch to SVG for Cricut page have usage limits?",
      a: "Only backend sketch conversion work is rate limited. Preview rendering, layer recoloring, layer visibility changes, copying SVG, and browser download generation are not rate limited because they do not use server conversion compute. Backend conversions allow up to 120 conversions per minute, 400 conversions every 5 minutes, 1500 conversions per hour, and 3000 conversions per day for the same connection and browser profile.",
    },
    {
      q: "Is this affiliated with Cricut?",
      a: "No. iLoveSVG is independent and is not affiliated with Cricut. Cricut is mentioned only to describe common craft file workflows.",
    },
  ];

  return (
    <section className="bg-white border-t border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 py-8 text-slate-800">
        <article className="max-w-none">
          <header className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Sketch to layered Cricut SVG
              </p>

              <h2 className="text-2xl md:text-3xl font-bold leading-tight text-sky-950">
                Convert sketches and scanned sketch artwork into SVG files for
                Cricut
              </h2>

              <p className="text-slate-600">
                This sketch to SVG converter is built for Cricut users who start
                with hand sketches, pencil sketches, ink line art, scanned
                artwork, handwriting, signatures, coloring page art, or simple
                raster designs. It separates visible artwork into editable SVG
                groups so you can recolor, hide, cut, or clean up the result.
              </p>

              <p className="text-slate-600">
                Sketch images often contain paper texture, shadows, scanner
                dust, or faint pencil marks. The presets on this page are tuned
                for sketch cleanup, line preservation, vinyl simplification,
                sticker outlines, and fewer unwanted Cricut pieces.
              </p>

              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    k: "Sketch-focused presets",
                    v: "Pencil, ink, scan, vinyl, and lettering modes",
                  },
                  {
                    k: "Editable SVG groups",
                    v: "Recolor or hide detected sketch layers",
                  },
                  {
                    k: "Cleanup controls",
                    v: "Reduce speckles, paper texture, and tiny fragments",
                  },
                  {
                    k: "Flexible uploads",
                    v: "Use PNG, JPG, JPEG, or WebP images",
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
              Best uses for this sketch to SVG converter
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Pencil sketches",
                "Ink sketches",
                "Scanned artwork",
                "Hand lettering",
                "Signatures",
                "Coloring page art",
                "Sticker outlines",
                "Vinyl decals",
                "Kids sketches",
                "Simple craft art",
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
                  For hand-sketched artwork
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use pencil, ink, or scan cleanup presets when you want to keep
                  the original sketch character while removing background noise.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="text-sm font-semibold">
                  For Cricut cuts and vinyl
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Use fewer layers, stronger speckle removal, and a larger
                  minimum layer size when the design needs to be cut, weeded, or
                  assembled.
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
                How to convert a sketch to SVG for Cricut
              </h3>
              <span className="text-xs text-slate-500">
                Upload → choose preset → edit layers → download SVG
              </span>
            </div>

            <ol className="mt-4 grid gap-3">
              {[
                {
                  title: "Upload a sketch or scan",
                  body: "Use PNG, JPG, JPEG, or WebP. High-contrast images with dark lines on a light background convert best.",
                },
                {
                  title: "Choose a sketch-specific preset",
                  body: "Use pencil presets for faint sketches, scan presets for paper texture, vinyl presets for fewer pieces, and lettering presets for signatures or handwriting.",
                },
                {
                  title: "Adjust layer count and cleanup",
                  body: "Use fewer layers for cut projects. Increase speckle removal and minimum layer size when the SVG has tiny unwanted pieces.",
                },
                {
                  title: "Recolor or hide layers",
                  body: "Use the layer controls inside each result card to adjust each SVG group before downloading.",
                },
                {
                  title: "Download the SVG",
                  body: "Upload the SVG into Cricut Design Space and use it for Cricut pen projects, cutting, stickers, decals, or layered craft projects.",
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
              Which sketch SVG preset should you use?
            </h3>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Sketch - Balanced Layers",
                  body: "Best first try for most sketches and scanned sketch artwork.",
                },
                {
                  title: "Pencil Sketch - Clean Layers",
                  body: "Best for faint pencil lines where the sketch needs extra cleanup.",
                },
                {
                  title: "Scanned Sketch - Remove Speckles",
                  body: "Best for paper texture, scanner dust, and noisy scan backgrounds.",
                },
                {
                  title: "Hand Lettering - Smooth",
                  body: "Best for names, quotes, signatures, and handwritten designs.",
                },
                {
                  title: "Sketch to Vinyl - Fewer Pieces",
                  body: "Best when the sketch needs to become a practical vinyl or HTV cut file.",
                },
                {
                  title: "Sticker Art - Clean Outlines",
                  body: "Best for extracting bold, clean outlines from sketches or simple sketch-style artwork.",
                },
                {
                  title: "Coloring Page - Bold Lines",
                  body: "Best for black-line art and simplified cut-friendly outlines.",
                },
                {
                  title: "Fine Detail - Preserve Lines",
                  body: "Best when detail matters more than simple cutting. Expect more pieces.",
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
              Sketch to SVG settings explained
            </h3>

            <p className="mt-2 text-sm text-slate-600 max-w-[80ch]">
              Sketch conversion is different from regular image tracing because
              paper texture, pencil shading, and scanner noise can easily become
              extra Cricut pieces. These settings control how much of the sketch
              becomes editable SVG layers.
            </p>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Layer count",
                  body: "Controls how many color or tone groups are extracted. Fewer layers are better for vinyl and simpler cut files.",
                },
                {
                  title: "Minimum layer size",
                  body: "Filters out tiny regions. Raise it when paper texture or pencil noise creates too many small shapes.",
                },
                {
                  title: "Speckle removal",
                  body: "Removes small traced islands. Higher values create cleaner files for cutting and weeding.",
                },
                {
                  title: "Curve tolerance",
                  body: "Higher values smooth rough lines and reduce nodes. Lower values preserve more sketch detail.",
                },
                {
                  title: "Remove white background",
                  body: "Useful for scans and paper sketches. Turn it off only if white is part of the artwork.",
                },
                {
                  title: "Posterize colors",
                  body: "Simplifies similar tones before tracing. Keep it on for most sketches, scans, and marker sketches.",
                },
                {
                  title: "Trace detail size",
                  body: "Higher detail can preserve more line shape, but may create larger SVGs and slower conversions.",
                },
                {
                  title: "Layer color controls",
                  body: "Each result includes controls to recolor or hide detected SVG groups before export.",
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
              How this sketch SVG converter works
            </h3>

            <div className="mt-3 grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  1. Background areas are filtered
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  The converter can ignore transparent pixels and near-white
                  paper or canvas areas so the sketch itself is easier to trace.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  2. Visible tones become layer masks
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Remaining sketch colors and tones are grouped into a smaller
                  palette, then each group is isolated as its own trace mask.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  3. The result exports as SVG groups
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Each traced group becomes an SVG layer so you can recolor,
                  hide, cut, or edit the result before downloading.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-bold text-sky-950">
              Server stability and conversion limits
            </h3>

            <div className="mt-3 grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  Backend conversion limits
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  This sketch to SVG for Cricut conversion page only rate limits
                  backend raster tracing and server-side image processing work.
                  Preview rendering, layer recoloring, layer visibility changes,
                  copy actions, and browser download generation are not rate
                  limited.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold text-sm">
                  Current backend quota
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Backend conversions allow up to 120 conversions per minute,
                  400 conversions every 5 minutes, 1500 conversions per hour,
                  and 3000 conversions per day for the same connection and
                  browser profile. If the server is busy or a limit is reached,
                  the response includes a Retry-After time.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <h3 className="text-lg font-bold text-sky-950">
              Tips for cleaner sketch SVGs
            </h3>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Use high contrast",
                  body: "Dark ink or pencil on clean white paper gives the best result. Uneven lighting creates extra layers.",
                },
                {
                  title: "Scan when possible",
                  body: "A scan usually works better than a phone photo because it avoids shadows and perspective distortion.",
                },
                {
                  title: "Simplify for vinyl",
                  body: "For vinyl or HTV, use 2 to 3 layers and stronger cleanup so the result is easier to weed.",
                },
                {
                  title: "Use more detail for Cricut pen projects",
                  body: "If the project uses Cricut pens instead of cutting, preserving more sketch detail can be useful.",
                },
                {
                  title: "Remove white carefully",
                  body: "White background removal helps most paper sketches, but it can remove intentional white design details.",
                },
                {
                  title: "Compare multiple attempts",
                  body: "Each conversion result stays in the preview area, so you can compare presets before downloading.",
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
              Sketch to SVG for Cricut FAQ
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
